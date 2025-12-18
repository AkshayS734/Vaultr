import { NextResponse } from 'next/server'
import argon2 from 'argon2'
import { prisma } from '@/lib/prisma'
import { hashVerificationToken } from '@/lib/crypto'
import { getClientIp, readLimitedJson } from '@/lib/utils'
import { logAuditEvent } from '@/lib/audit'
import { z } from 'zod'

const resetSchema = z.object({
  token: z.string().length(64),
  password: z.string().min(8).max(128),
})

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)

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

    // Update user password
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
