import { NextResponse } from 'next/server'
import argon2 from 'argon2'
import { prisma } from '@/app/lib/prisma'
import { requireAuth } from '@/app/lib/auth-utils'
import { logAuditEvent } from '@/app/lib/audit'
import { checkPasswordReuse, storePasswordInHistory } from '@/app/lib/password-reuse'
import { checkPasswordStrength } from '@/app/lib/password-strength'
import { z } from 'zod'
import { getClientIp } from '@/app/lib/utils'
import { validateCsrf } from '@/app/lib/csrf'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
})

export async function POST(req: Request) {
  try {
    const csrfCheck = validateCsrf(req)
    if (!csrfCheck.ok) return csrfCheck.response!

    // Verify authentication and email verification
    const auth = await requireAuth(req, true)
    if (!auth.success) {
      return auth.response
    }

    const { user } = auth
    const ip = getClientIp(req)

    // Validate input
    const body = await req.json()
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { currentPassword, newPassword } = parsed.data

    // Get current user with auth hash
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { authHash: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify current password
    const isCurrentPasswordValid = await argon2.verify(currentUser.authHash, currentPassword)
    if (!isCurrentPasswordValid) {
      await logAuditEvent('LOGIN_FAILED', user.id, {
        reason: 'Password change: Invalid current password',
        ip,
        email: user.email
      })
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }

    // Check if new password is different from current
    const isSamePassword = await argon2.verify(currentUser.authHash, newPassword)
    if (isSamePassword) {
      return NextResponse.json(
        { 
          error: 'New password must be different from current password',
          warning: 'You cannot use the same password as your current one'
        },
        { status: 400 }
      )
    }

    // Enforce strong password requirements
    const strength = checkPasswordStrength(newPassword, { email: user.email })
    if (!strength.isStrong) {
      return NextResponse.json(
        {
          error: 'Password is too weak',
          requirements: strength.feedback,
        },
        { status: 400 }
      )
    }

    // Check for password reuse (warning only)
    const reuseCheck = await checkPasswordReuse(user.id, newPassword)

    // Hash new password
    const newAuthHash = await argon2.hash(newPassword)

    // Update user's auth hash
    await prisma.user.update({
      where: { id: user.id },
      data: { authHash: newAuthHash },
    })

    // Store old password in history and clean up old entries
    await storePasswordInHistory(user.id, currentUser.authHash)

    // Log successful password change
    await logAuditEvent('PASSWORD_UPDATE', user.id, {
      email: user.email,
      ip
    })

    // Log reuse detection if applicable
    if (reuseCheck.warning) {
      await logAuditEvent('PASSWORD_REUSE_DETECTED', user.id, {
        email: user.email,
        ip,
        context: 'password_change',
        warning: reuseCheck.warning
      })
    }

    const responseData: {
      message: string;
      warning?: string;
      recommendation?: string;
    } = {
      message: 'Password updated successfully',
    }

    // Include reuse warning if detected
    if (reuseCheck.warning) {
      responseData.warning = reuseCheck.warning
      responseData.recommendation = reuseCheck.recommendation
    }

    return NextResponse.json(responseData)
  } catch (err) {
    console.error('[ERR_PASSWORD_CHANGE]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}