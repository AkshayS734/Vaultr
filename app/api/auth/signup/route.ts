import { NextResponse } from 'next/server'
import argon2 from 'argon2'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import cookie from 'cookie'
import { prisma } from '../../../../lib/prisma'
import { rateLimit } from '../../../../lib/redis'
import { getClientIp, truncate, isValidEmail, isValidPassword } from '../../../../lib/utils'
import { logAuditEvent } from '../../../../lib/audit'

// Rate limit: 5 signup attempts per hour
const SIGNUP_MAX = 5
const SIGNUP_WINDOW_MS = 60 * 60 * 1000

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

    const body = await req.json()
    const { email, password } = body || {}

    if (!isValidEmail(email)) {
      await logAuditEvent('LOGIN_FAILED', null, { email, ip, userAgent: truncate(req.headers.get('user-agent'), 500), reason: 'Signup: Invalid email' })
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const passwordValidation = isValidPassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.reason || 'Invalid password' }, { status: 400 })
    }

    // Prevent duplicate accounts using normalized email
    const normalized = String(email).trim().toLowerCase()
    const existing = await prisma.user.findUnique({ where: { emailNormalized: normalized } })
    if (existing) {
      await logAuditEvent('LOGIN_FAILED', null, { email: normalized, ip, userAgent: truncate(req.headers.get('user-agent'), 500), reason: 'Signup: Account exists' })
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 })
    }

    // Hash password with argon2
    const hash = await argon2.hash(password)

    const user = await prisma.user.create({
      data: {
        email,
        emailNormalized: normalized,
        authHash: hash,
      },
      select: { id: true, email: true },
    })

    // Create refresh token + session
    const refreshToken = crypto.randomBytes(48).toString('hex')
    const refreshTokenHash = await argon2.hash(refreshToken)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const userAgent = truncate(req.headers.get('user-agent'), 500)

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
      console.error('JWT_SECRET not configured')
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

    // Log successful signup
    await logAuditEvent('SIGNUP_SUCCESS', user.id, { email: normalized, ip, sessionId: createdSession.id })

    const response = NextResponse.json({ accessToken }, { status: 201 })
    response.headers.append('Set-Cookie', refreshCookie)
    response.headers.append('Set-Cookie', sessionCookie)
    return response
  } catch (err) {
    console.error('signup error', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
