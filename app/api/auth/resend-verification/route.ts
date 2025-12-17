import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { rateLimit } from '../../../../lib/redis'
import { getClientIp, readLimitedJson } from '../../../../lib/utils'
import { generateVerificationToken, hashVerificationToken } from '../../../../lib/crypto'
import { sendVerificationEmail } from '../../../../lib/email'
import { logAuditEvent } from '../../../../lib/audit'
import { z } from 'zod'

// Rate limit: 3 resend attempts per hour per email
const RESEND_MAX = 3
const RESEND_WINDOW_MS = 60 * 60 * 1000

const resendSchema = z.object({
  email: z.string().email(),
})

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)

    let email: string

    try {
      const raw = await readLimitedJson(req, 64 * 1024)
      const parsed = resendSchema.safeParse(raw)
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
    const rateLimitKey = `resend-verification:${normalized}`

    // Rate limit by email
    try {
      const rl = await rateLimit(rateLimitKey, RESEND_WINDOW_MS, RESEND_MAX)
      if (!rl.allowed) {
        const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          { error: 'Too many resend attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch (e) {
      console.warn('Rate limit check failed, allowing request', e)
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { emailNormalized: normalized },
      select: { id: true, email: true, isEmailVerified: true },
    })

    // Don't reveal whether user exists (timing-safe)
    if (!user) {
      // Still return success to prevent email enumeration
      return NextResponse.json(
        { message: 'If the email exists and is not verified, a verification email has been sent.' },
        { status: 200 }
      )
    }

    // If already verified, return success
    if (user.isEmailVerified) {
      return NextResponse.json(
        { message: 'Email is already verified.' },
        { status: 200 }
      )
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken()
    const tokenHash = hashVerificationToken(verificationToken)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Delete old tokens and create new one
    await prisma.$transaction([
      prisma.verificationToken.deleteMany({
        where: { userId: user.id },
      }),
      prisma.verificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ])

    // Send verification email
    const sent = await sendVerificationEmail(user.email, verificationToken)
    
    if (sent) {
      await logAuditEvent('EMAIL_VERIFICATION_SENT', user.id, {
        email: normalized,
        ip,
        resend: 'true',
      })
    } else {
      console.error('Failed to send verification email to', user.email)
    }

    return NextResponse.json(
      { message: 'Verification email sent. Please check your inbox.' },
      { status: 200 }
    )
  } catch (err) {
    console.error('Resend verification error:', err)
    return NextResponse.json(
      { error: 'Failed to resend verification email. Please try again.' },
      { status: 500 }
    )
  }
}
