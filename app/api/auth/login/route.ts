import { NextResponse } from 'next/server'
import argon2 from 'argon2'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import cookie from 'cookie'
import { prisma } from '../../../../lib/prisma'
import { rateLimit } from '../../../../lib/redis'
import { getClientIp, truncate, readLimitedJson } from '@/lib/utils'
import { loginSchema } from '@/schemas/auth'
import { logAuditEvent } from '../../../../lib/audit'

// Rate limit: 5 failed attempts per 15 minutes
const LOGIN_MAX = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

export async function POST(req: Request) {
  try {
    let email: string
    let password: string
    const ip = getClientIp(req)
    const rateLimitKey = `login:${ip || 'unknown'}`

    // Rate limit by IP
    try {
      const rl = await rateLimit(rateLimitKey, LOGIN_WINDOW_MS, LOGIN_MAX)
      if (!rl.allowed) {
        const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          { error: 'Too many failed login attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch (e) {
      console.warn('Rate limit check failed, allowing request', e)
    }

    try {
      const raw = await readLimitedJson(req, 64 * 1024)
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
    const user = await prisma.user.findUnique({ where: { emailNormalized: normalized }, select: { id: true, email: true, authHash: true } })
    if (!user) {
      await logAuditEvent('LOGIN_FAILED', null, { email: normalized, ip, userAgent: truncate(req.headers.get('user-agent'), 256), reason: 'User not found' })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const verified = await argon2.verify(user.authHash, password)
    if (!verified) {
      await logAuditEvent('LOGIN_FAILED', user.id, { email: normalized, ip, userAgent: truncate(req.headers.get('user-agent'), 256), reason: 'Invalid password' })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Create refresh token + session
    const refreshToken = crypto.randomBytes(48).toString('hex')
    const refreshTokenHash = await argon2.hash(refreshToken)
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

    // Log successful login
    await logAuditEvent('LOGIN_SUCCESS', user.id, { email: normalized, ip, sessionId: createdSession.id })

    const response = NextResponse.json({ accessToken }, { status: 200 })
    response.headers.append('Set-Cookie', refreshCookie)
    response.headers.append('Set-Cookie', sessionCookie)
    return response
  } catch (err) {
    console.error('login error', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
