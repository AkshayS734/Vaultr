import { NextResponse } from 'next/server'
import argon2 from 'argon2'
import { prisma } from '@/app/lib/prisma'
import { hashVerificationToken } from '@/app/lib/crypto'
import { getClientIp, readLimitedJson } from '@/app/lib/utils'
import { rateLimit } from '@/app/lib/redis'
import { logAuditEvent } from '@/app/lib/audit'
import { z } from 'zod'
import { checkPasswordStrength } from '@/app/lib/password-strength'

const resetSchema = z.object({
  token: z.string().length(64),
  // NIST SP 800-63B: enforce min length >= 12 for password resets
  password: z.string().min(12).max(128),
})

// Rate limit: 5 password reset attempts per hour (keyed by IP)
const RESET_MAX = 5
const RESET_WINDOW_MS = 60 * 60 * 1000

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const rateLimitKey = `reset:${ip || 'unknown'}`

    // Rate limit by IP
    try {
      const rl = await rateLimit(rateLimitKey, RESET_WINDOW_MS, RESET_MAX)
      if (!rl.allowed) {
        const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          { error: 'Too many password reset attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch (e) {
      console.warn('Rate limit check failed, allowing request', e)
    }

    let token: string
    let password: string

    try {
      const raw = await readLimitedJson(req, 64 * 1024)
      const parsed = resetSchema.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
      }
      ({ token, password } = parsed.data)
    } catch (e) {
      if ((e as Error).message === 'PAYLOAD_TOO_LARGE') {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
      }
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const tokenHash = hashVerificationToken(token)

    // Find the password reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    })

    if (!resetToken) {
      await logAuditEvent('PASSWORD_RESET_FAILED', null, {
        reason: 'Token not found',
        ip,
      })
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      })
      await logAuditEvent('PASSWORD_RESET_FAILED', resetToken.userId, {
        reason: 'Token expired',
        email: resetToken.user.email,
        ip,
      })
      return NextResponse.json(
        { error: 'Password reset link has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // NIST SP 800-63B: server-side authoritative strength enforcement (entropy + denylist + identifier checks)
    const strength = checkPasswordStrength(password, { email: resetToken.user.email })
    if (!strength.isStrong) {
      return NextResponse.json(
        {
          error: 'Password is too weak',
          requirements: strength.feedback,
        },
        { status: 400 }
      )
    }

    // Update user password after strength validation
    const newAuthHash = await argon2.hash(password)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { authHash: newAuthHash },
      }),
      prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      }),
      // Invalidate all sessions for security
      prisma.session.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ])

    await logAuditEvent('PASSWORD_RESET_COMPLETED', resetToken.userId, {
      email: resetToken.user.email,
      ip,
    })

    return NextResponse.json(
      {
        message: 'Password has been reset successfully. Please sign in with your new password.',
        verified: true,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Password reset error:', err)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

