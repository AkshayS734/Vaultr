import { NextResponse } from 'next/server'
import cookie from 'cookie'
import argon2 from 'argon2'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../../../../lib/prisma'
import { rateLimit } from '../../../../lib/redis'

function parseIntOrDefault(v: string | undefined, def: number) {
  if (!v) return def
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : def
}

// Redis-backed rate limiter configuration
const REFRESH_MAX = 6 // max requests
const REFRESH_WINDOW_MS = 60 * 1000 // per minute

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const cookies = cookie.parse(cookieHeader || '')
    const sessionId = cookies.sessionId
    const refresh = cookies.refreshToken

    if (!sessionId || !refresh) {
      return NextResponse.json({ error: 'Missing session or refresh token' }, { status: 401 })
    }

    // rate limit by sessionId using Redis (falls back to allowing on error)
    try {
      const rlKey = `refresh:${sessionId}`
      const rl = await rateLimit(rlKey, REFRESH_WINDOW_MS, REFRESH_MAX)
      if (!rl.allowed) {
        const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
        return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
      }
    } catch (e) {
      console.warn('rateLimit check failed, allowing request', e)
    }

    const session = await prisma.session.findUnique({ where: { id: sessionId } })
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const now = new Date()
    if (session.expiresAt < now) {
      // session expired
      try { await prisma.session.delete({ where: { id: sessionId } }) } catch (e) {}
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    const ok = await argon2.verify(session.refreshTokenHash, refresh).catch(() => false)
    if (!ok) {
      // possible theft — delete session
      try { await prisma.session.delete({ where: { id: sessionId } }) } catch (e) {}
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

    // rotate refresh token
    const newRefresh = crypto.randomBytes(48).toString('hex')
    const newHash = await argon2.hash(newRefresh)
    const expiresDays = parseIntOrDefault(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 30)
    const newExpires = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000)

    await prisma.session.update({ where: { id: sessionId }, data: { refreshTokenHash: newHash, expiresAt: newExpires, lastUsedAt: new Date() } })

    const accessToken = jwt.sign({ sub: session.userId }, jwtSecret as string, { expiresIn: '15m' })

    const refreshCookie = cookie.serialize('refreshToken', newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: expiresDays * 24 * 60 * 60,
    })

    const sessionCookie = cookie.serialize('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: expiresDays * 24 * 60 * 60,
    })

    const response = NextResponse.json({ accessToken }, { status: 200 })
    response.headers.append('Set-Cookie', refreshCookie)
    response.headers.append('Set-Cookie', sessionCookie)
    return response
  } catch (err) {
    console.error('refresh error', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
