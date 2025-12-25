import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { generateVerificationToken, hashVerificationToken } from '@/app/lib/crypto'
import { sendPasswordResetEmail } from '@/app/lib/email'
import { getClientIp, readLimitedJson } from '@/app/lib/utils'
import { rateLimit } from '@/app/lib/redis'
import { logAuditEvent } from '@/app/lib/audit'
import { z } from 'zod'

const forgotSchema = z.object({
  email: z.string().email(),
})

// Rate limit: 5 password reset attempts per hour (keyed by email + IP)
const FORGOT_MAX = 5
const FORGOT_WINDOW_MS = 60 * 60 * 1000

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)

    let email: string

    try {
      const raw = await readLimitedJson(req, 64 * 1024)
      const parsed = forgotSchema.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
      }
      ({ email } = parsed.data)
    } catch (e) {
      if ((e as Error).message === 'PAYLOAD_TOO_LARGE') {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
      }
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const normalized = String(email).trim().toLowerCase()
    const rateLimitKey = `forgot:${normalized}:${ip || 'unknown'}`

    // Rate limit by normalized email + IP
    try {
      const rl = await rateLimit(rateLimitKey, FORGOT_WINDOW_MS, FORGOT_MAX)
      if (!rl.allowed) {
        const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          { message: 'Too many password reset requests. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch (e) {
      console.warn('Rate limit check failed, allowing request', e)
    }

    // Find user (don't reveal if exists for security)
    const user = await prisma.user.findUnique({
      where: { emailNormalized: normalized },
      select: { id: true, email: true },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      await logAuditEvent('PASSWORD_RESET_REQUESTED', null, {
        reason: 'User not found',
        email: normalized,
        ip,
      })
      return NextResponse.json(
        { message: 'If an account exists with this email, a password reset link has been sent.' },
        { status: 200 }
      )
    }

    // Clean up old reset tokens
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: new Date() },
      },
    })

    // Generate new reset token
    const resetToken = generateVerificationToken()
    const tokenHash = hashVerificationToken(resetToken)

    // Store token hash with 24-hour expiry
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    // Send email (don't block)
    sendPasswordResetEmail(user.email, resetToken).catch((err) => {
      console.error('Failed to send password reset email:', err)
    })

    await logAuditEvent('PASSWORD_RESET_REQUESTED', user.id, {
      email: user.email,
      ip,
    })

    return NextResponse.json(
      { message: 'Password reset link has been sent to your email. It will expire in 24 hours.' },
      { status: 200 }
    )
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

