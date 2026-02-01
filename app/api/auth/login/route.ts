import { NextResponse } from 'next/server'
import argon2 from 'argon2' // Still needed for login password verification
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import cookie from 'cookie'
import { serializeCsrfCookie, generateCsrfToken } from '@/app/lib/csrf'
import { prisma } from '../../../lib/prisma'
import { checkRateLimit, consumeRateLimit } from '../../../lib/redis'
import { getClientIp, truncate } from '@/app/lib/utils'
import { loginSchema } from '@/app/schemas/auth'
import { logAuditEvent } from '../../../lib/audit'

// Rate limit: 5 failed attempts per 15 minutes
const LOGIN_MAX = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

// Dummy hash for timing attack mitigation
// This is a pre-computed argon2 hash of a random password
// Used to ensure consistent timing even when user doesn't exist
const DUMMY_HASH = '$argon2id$v=19$m=48128,t=1,p=1$fakesalt123456789ABCD$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

export async function POST(req: Request) {
  try {
    let email: string
    let password: string
    const ip = getClientIp(req)

    try {
      const contentLength = req.headers.get('content-length')

      if (contentLength && Number(contentLength) > 64 * 1024) {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
      }

      const raw = await req.json()
      const parsed = loginSchema.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
      }
      ({ email, password } = parsed.data)
    } catch (e) {
      if ((e as Error).message === 'PAYLOAD_TOO_LARGE') {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
      }
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    // Zod already validated email/password

    const normalized = String(email).trim().toLowerCase()
    const rateLimitKey = `login:${ip || 'unknown'}:${normalized}`

    // Check rate limit based on composite key (IP + normalizedEmail)
    const rl = await checkRateLimit(rateLimitKey, LOGIN_WINDOW_MS, LOGIN_MAX)
    if (!rl.allowed) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many failed login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter), 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } }
      )
    }
    
    // Timing attack mitigation: Always perform password verification (even for non-existent users)
    // Query user without early rejection
    const user = await prisma.user.findUnique({ 
      where: { emailNormalized: normalized }, 
      select: { id: true, email: true, authHash: true, isEmailVerified: true, deletedAt: true } 
    })
    
    // Determine which hash to verify: real hash if user exists, dummy hash if not
    // This ensures consistent timing regardless of whether user exists
    const hashToVerify = user?.authHash ?? DUMMY_HASH
    const userExists = !!user
    const userDeleted = user?.deletedAt ? true : false
    const emailVerified = user?.isEmailVerified ?? false
    
    // Always verify password (takes same time regardless of user existence)
    let verified = false
    try {
      verified = await argon2.verify(hashToVerify, password)
    } catch {
      verified = false
    }
    
    // Add random jitter (100-300ms) to mask Argon2 timing variance and obscure user existence
    // Increased from 10-50ms to better protect against statistical timing attacks
    const jitterMs = Math.random() * 200 + 100
    await new Promise(resolve => setTimeout(resolve, jitterMs))
    
    // Now determine what error to return (all paths taken same time to reach here)
    if (!userExists) {
      await consumeRateLimit(rateLimitKey, LOGIN_WINDOW_MS)
      await logAuditEvent('LOGIN_FAILED', null, { email: normalized, ip, userAgent: truncate(req.headers.get('user-agent'), 256), reason: 'User not found' })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } })
    }

    // Reject deleted accounts to prevent reactivation with stale sessions
    if (userDeleted) {
      await consumeRateLimit(rateLimitKey, LOGIN_WINDOW_MS)
      await logAuditEvent('LOGIN_FAILED', user!.id, { email: normalized, ip, userAgent: truncate(req.headers.get('user-agent'), 256), reason: 'User deleted' })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } })
    }
    
    if (!verified) {
      await consumeRateLimit(rateLimitKey, LOGIN_WINDOW_MS)
      await logAuditEvent('LOGIN_FAILED', user!.id, { email: normalized, ip, userAgent: truncate(req.headers.get('user-agent'), 256), reason: 'Invalid password' })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } })
    }

    // Check if email is verified (for password manager security)
    if (!emailVerified) {
      await consumeRateLimit(rateLimitKey, LOGIN_WINDOW_MS)
      await logAuditEvent('LOGIN_FAILED', user!.id, { 
        email: normalized, 
        ip, 
        userAgent: truncate(req.headers.get('user-agent'), 256), 
        reason: 'Email not verified' 
      })
      return NextResponse.json({ 
        error: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED'
      }, { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } })
    }

    // Create refresh token + session
    const refreshToken = crypto.randomBytes(48).toString('hex')
    // Use SHA-256 for refresh token (fast, secure for high-entropy random tokens)
    // Argon2 is overkill here - refresh tokens are cryptographically random (384 bits)
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const userAgent = truncate(req.headers.get('user-agent'), 256)

    const createdSession = await prisma.session.create({
      data: {
        userId: user!.id,
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
      return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } })
    }

    const accessToken = jwt.sign({ sub: user!.id, email: user!.email }, jwtSecret as string, { expiresIn: '15m' })

    const refreshCookie = cookie.serialize('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    const sessionCookie = cookie.serialize('sessionId', createdSession.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    const csrfToken = generateCsrfToken()
    const csrfCookie = serializeCsrfCookie(csrfToken)

    // Log successful login
    await logAuditEvent('LOGIN_SUCCESS', user!.id, { email: normalized, ip, sessionId: createdSession.id })

    const response = NextResponse.json({ accessToken }, { status: 200 })
    response.headers.set('Content-Type', 'application/json; charset=utf-8')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.append('Set-Cookie', refreshCookie)
    response.headers.append('Set-Cookie', sessionCookie)
    response.headers.append('Set-Cookie', csrfCookie)
    response.headers.set('X-CSRF-Token', csrfToken)
    return response
  } catch (err) {
    console.error('[ERR_LOGIN]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } })
  }
}
