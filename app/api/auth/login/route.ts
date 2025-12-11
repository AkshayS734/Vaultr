import { NextResponse } from 'next/server'
import argon2 from 'argon2'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import cookie from 'cookie'
import { prisma } from '../../../../lib/prisma'
import { rateLimit } from '../../../../lib/redis'
import { getClientIp, truncate, isValidEmail } from '../../../../lib/utils'

// Rate limit: 5 failed attempts per 15 minutes
const LOGIN_MAX = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

export async function POST(req: Request) {
  try {
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

    const body = await req.json()
    const { email, password } = body || {}

    if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }

    const normalized = String(email).trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { emailNormalized: normalized } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const verified = await argon2.verify(user.authHash, password)
    if (!verified) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

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

    const response = NextResponse.json({ accessToken }, { status: 200 })
    response.headers.append('Set-Cookie', refreshCookie)
    response.headers.append('Set-Cookie', sessionCookie)
    return response
  } catch (err) {
    console.error('login error', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
