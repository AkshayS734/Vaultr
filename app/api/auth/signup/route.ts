import { NextResponse } from 'next/server'
import argon2 from 'argon2'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import cookie from 'cookie'
import { serializeCsrfCookie, generateCsrfToken } from '@/app/lib/csrf'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma'
import { rateLimit } from '../../../lib/redis'
import { getClientIp, truncate, readLimitedJson } from '../../../lib/utils'
import { signupSchema } from '@/app/schemas/auth'
import { logAuditEvent } from '../../../lib/audit'
import { generateVerificationToken, hashVerificationToken } from '../../../lib/crypto'
import { sendVerificationEmail } from '../../../lib/email'
import { checkPasswordStrength } from '../../../lib/password-strength'

// Rate limit: 5 signup attempts per hour
const SIGNUP_MAX = 50
const SIGNUP_WINDOW_MS = 60 * 60 * 1000

// Argon2 configuration: OWASP 2023 recommendations for password hashing
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const ARGON2_CONFIG = {
  type: argon2.argon2id, // Argon2id: balanced against side-channel + GPU attacks
  memoryCost: 48 * 1024, // 48 MiB (OWASP minimum)
  timeCost: 3, // 3 iterations (memory-hard approach preferred)
  parallelism: 1, // 1 thread (conservative, optimized for memory)
  hashLength: 32, // 32 bytes output
}
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const rateLimitKey = `signup:${ip || 'unknown'}`

    // Rate limit by IP
    try {
      const rl = await rateLimit(rateLimitKey, SIGNUP_WINDOW_MS, SIGNUP_MAX)
      if (!rl.allowed) {
        const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          { error: 'Too many signup attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch (e) {
      console.warn('Rate limit check failed, allowing request', e)
    }

    let email, password, encryptedVaultKey, salt, kdfParams;

    try {
      const raw = await readLimitedJson(req, 64 * 1024)
      const parsed = signupSchema.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
      }
      ({ email, password, encryptedVaultKey, salt, kdfParams } = parsed.data)
    } catch (e) {
      if ((e as Error).message === 'PAYLOAD_TOO_LARGE') {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
      }
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Zod already validated email/password

    // Enforce strong password requirements server-side (authoritative)
    const passwordStrength = checkPasswordStrength(password, { email })
    if (!passwordStrength.isStrong) {
      return NextResponse.json(
        {
          error: 'Password is too weak',
          requirements: passwordStrength.feedback,
        },
        { status: 400 }
      )
    }

    // Check for password reuse (warning only, don't block signup)
    // Note: For signup, we can't check against user history since user doesn't exist yet
    // This could be extended to check against common passwords or breached passwords in future

    // Prevent duplicate accounts using normalized email
    const normalized = String(email).trim().toLowerCase()
    const existing = await prisma.user.findUnique({ where: { emailNormalized: normalized }, select: { id: true } })
    if (existing) {
      // Enumeration hardening: perform expensive hash to equalize timing with successful signup
      await argon2.hash(password, ARGON2_CONFIG)
      await logAuditEvent('LOGIN_FAILED', null, { email: normalized, ip, userAgent: truncate(req.headers.get('user-agent'), 256), reason: 'Signup: Account exists' })
      return NextResponse.json(
        { error: 'Unable to process signup request' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } }
      )
    }

    // Hash password with argon2 (OWASP-compliant parameters)
    const hash = await argon2.hash(password, ARGON2_CONFIG)

    const user = await prisma.user.create({
      data: {
        email,
        emailNormalized: normalized,
        authHash: hash,
        vault: {
          create: {
            encryptedVaultKey,
            salt,
            kdfParams: kdfParams as Prisma.InputJsonValue,
          },
        },
      },
      select: { id: true, email: true },
    })

    // Create refresh token + session
    const refreshToken = crypto.randomBytes(48).toString('hex')
    const refreshTokenHash = await argon2.hash(refreshToken, ARGON2_CONFIG)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const userAgent = truncate(req.headers.get('user-agent'), 256)

    const createdSession = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        createdAt: new Date(),
        expiresAt,
        userAgent,
        ip,
        lastUsedAt: new Date(),
      },
      select: { id: true },
    })

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('[ERR_JWT_CONFIG]')
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const accessToken = jwt.sign({ sub: user.id, email: user.email }, jwtSecret as string, { expiresIn: '15m' })

    const refreshCookie = cookie.serialize('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    const sessionCookie = cookie.serialize('sessionId', createdSession.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    const csrfToken = generateCsrfToken()
    const csrfCookie = serializeCsrfCookie(csrfToken)

    // Log successful signup
    await logAuditEvent('SIGNUP_SUCCESS', user.id, { email: normalized, ip, sessionId: createdSession.id })

    // Generate and send email verification token
    try {
      const verificationToken = generateVerificationToken()
      const tokenHash = hashVerificationToken(verificationToken)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      // Delete any existing verification tokens for this user
      await prisma.verificationToken.deleteMany({
        where: { userId: user.id }
      })

      // Create new verification token
      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      })

      // Send verification email (don't block on this)
      sendVerificationEmail(user.email, verificationToken)
        .then((sent) => {
          if (sent) {
            logAuditEvent('EMAIL_VERIFICATION_SENT', user.id, { email: normalized })
          } else {
            console.error('[ERR_EMAIL] Failed to send verification email')
          }
        })
        .catch((err) => {
          console.error('[ERR_EMAIL]', err instanceof Error ? err.message : String(err))
        })
    } catch (emailError) {
      // Don't fail signup if email fails
      console.error('[ERR_EMAIL_SETUP]', emailError instanceof Error ? emailError.message : String(emailError))
    }

    const response = NextResponse.json({ accessToken }, { status: 201 })
    response.headers.append('Set-Cookie', refreshCookie)
    response.headers.append('Set-Cookie', sessionCookie)
    response.headers.append('Set-Cookie', csrfCookie)
    response.headers.set('X-CSRF-Token', csrfToken)
    return response
  } catch (err) {
    console.error('[ERR_SIGNUP]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
