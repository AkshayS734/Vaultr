import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { hashVerificationToken } from '../../../../lib/crypto'
import { logAuditEvent } from '../../../../lib/audit'
import { sendWelcomeEmail } from '../../../../lib/email'
import { getClientIp, truncate } from '../../../../lib/utils'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token || typeof token !== 'string' || token.length !== 64) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      )
    }

    const ip = getClientIp(req)
    const tokenHash = hashVerificationToken(token)

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, isEmailVerified: true } } },
    })

    if (!verificationToken) {
      await logAuditEvent('EMAIL_VERIFICATION_FAILED', null, {
        reason: 'Token not found',
        ip,
        userAgent: truncate(req.headers.get('user-agent'), 256),
      })
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (verificationToken.expiresAt < new Date()) {
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      })
      await logAuditEvent('EMAIL_VERIFICATION_FAILED', verificationToken.userId, {
        reason: 'Token expired',
        email: verificationToken.user.email,
        ip,
      })
      return NextResponse.json(
        { error: 'Verification token has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check if already verified
    if (verificationToken.user.isEmailVerified) {
      // Clean up the token
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      })
      return NextResponse.json(
        { message: 'Email already verified' },
        { status: 200 }
      )
    }

    // Verify the email
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { isEmailVerified: true },
      }),
      prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      }),
    ])

    await logAuditEvent('EMAIL_VERIFIED', verificationToken.userId, {
      email: verificationToken.user.email,
      ip,
    })

    // Send welcome email (don't block)
    sendWelcomeEmail(verificationToken.user.email).catch((err) => {
      console.error('Failed to send welcome email:', err)
    })

    // Redirect to a success page or return success JSON
    // For API-first approach, return JSON
    return NextResponse.json(
      {
        message: 'Email verified successfully! You can now access all features.',
        verified: true,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Email verification error:', err)
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    )
  }
}
