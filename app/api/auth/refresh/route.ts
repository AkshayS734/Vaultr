import { NextResponse } from 'next/server'
import cookie from 'cookie'
import argon2 from 'argon2'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../../../../lib/prisma'
import { rateLimit } from '../../../../lib/redis'
import { truncate, getClientIp } from '@/lib/utils'

function parseIntOrDefault(v: string | undefined, def: number) {
  if (!v) return def
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : def
}

// Redis-backed rate limiter configuration
const REFRESH_MAX = 6 // max requests
const REFRESH_WINDOW_MS = 60 * 1000 // per minute
const MAX_REFRESH_LIFETIME_DAYS = parseIntOrDefault(process.env.MAX_REFRESH_LIFETIME_DAYS, 30)
const DEFAULT_REFRESH_DAYS = parseIntOrDefault(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 30)

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const cookies = cookie.parse(cookieHeader || '')
    const sessionId = cookies.sessionId
    const refresh = cookies.refreshToken
    const ip = getClientIp(req)
    const userAgent = truncate(req.headers.get('user-agent'), 256)

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

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        refreshTokenHash: true,
        expiresAt: true,
        createdAt: true,
        userAgent: true,
        ip: true,
        user: { select: { isEmailVerified: true, deletedAt: true } },
      },
    })
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const now = new Date()
    if (session.expiresAt < now) {
      // session expired
      try { await prisma.session.delete({ where: { id: sessionId } }) } catch {}
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    const ok = await argon2.verify(session.refreshTokenHash, refresh).catch(() => false)
    if (!ok) {
      // possible theft — delete session
      try { await prisma.session.delete({ where: { id: sessionId } }) } catch {}
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    }

    // Enforce device binding: if stored userAgent/IP mismatch, revoke session
    if (session.userAgent && userAgent && session.userAgent !== userAgent) {
      try { await prisma.session.delete({ where: { id: sessionId } }) } catch {}
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (session.ip && ip && session.ip !== ip) {
      try { await prisma.session.delete({ where: { id: sessionId } }) } catch {}
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Validate user state to prevent refresh on deleted/unverified accounts
    if (!session.user || session.user.deletedAt) {
      try { await prisma.session.delete({ where: { id: sessionId } }) } catch {}
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (!session.user.isEmailVerified) {
      try { await prisma.session.delete({ where: { id: sessionId } }) } catch {}
      return NextResponse.json({ error: 'Email not verified' }, { status: 403 })
    }

    // Enforce absolute refresh lifetime from session creation to prevent indefinite extension
    const absoluteExpiry = new Date(session.createdAt.getTime() + MAX_REFRESH_LIFETIME_DAYS * 24 * 60 * 60 * 1000)
    if (absoluteExpiry <= now) {
      try { await prisma.session.delete({ where: { id: sessionId } }) } catch {}
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

    // Rotate refresh token and session ID (single use, prevents fixation)
    const newRefresh = crypto.randomBytes(48).toString('hex')
    const newHash = await argon2.hash(newRefresh)

    const relativeExpiry = new Date(Date.now() + DEFAULT_REFRESH_DAYS * 24 * 60 * 60 * 1000)
    const newExpires = new Date(Math.min(relativeExpiry.getTime(), absoluteExpiry.getTime()))

    // Atomic rotation: create new session then delete old one
    const newSession = await prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          userId: session.userId,
          refreshTokenHash: newHash,
          createdAt: session.createdAt, // preserve original creation time for absolute lifetime
          expiresAt: newExpires,
          userAgent: userAgent || null,
          ip: ip || null,
          lastUsedAt: new Date(),
        },
        select: { id: true },
      })

      await tx.session.delete({ where: { id: sessionId } })
      return created
    })

    const accessToken = jwt.sign({ sub: session.userId }, jwtSecret as string, { expiresIn: '15m' })

    const refreshCookie = cookie.serialize('refreshToken', newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor((newExpires.getTime() - Date.now()) / 1000),
    })

    const sessionCookie = cookie.serialize('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor((newExpires.getTime() - Date.now()) / 1000),
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
