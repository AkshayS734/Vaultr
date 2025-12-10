import { NextResponse } from 'next/server'
import argon2 from 'argon2'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import cookie from 'cookie'
import { prisma } from '../../../../lib/prisma'

function isValidEmail(email: unknown) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password } = body || {}

    if (!isValidEmail(email) || typeof password !== 'string') {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Prevent duplicate accounts
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 })
    }

    // Hash password with argon2
    const hash = await argon2.hash(password)
    const salt = crypto.randomBytes(16).toString('hex')

    const normalized = String(email).trim().toLowerCase()

    const user = await prisma.user.create({
      data: {
        email,
        emailNormalized: normalized,
        authSalt: salt,
        authHash: hash,
      },
      select: { id: true, email: true },
    })

    // Create refresh token + session
    const refreshToken = crypto.randomBytes(48).toString('hex')
    const refreshTokenHash = await argon2.hash(refreshToken)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const userAgent = req.headers.get('user-agent') || null
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null

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

    const accessToken = jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: '15m' })

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

    return NextResponse.json({ accessToken }, { status: 201, headers: { 'Set-Cookie': [refreshCookie, sessionCookie] } })
  } catch (err: any) {
    console.error('signup error', err)
    const isDev = process.env.NODE_ENV !== 'production'
    const message = isDev ? (err?.message || String(err)) : 'Invalid request'
    const payload: any = { error: message }
    if (isDev && err?.stack) payload.stack = err.stack
    return NextResponse.json(payload, { status: 500 })
  }
}

export function GET() {
  return NextResponse.json({ message: 'Auth signup endpoint' })
}
