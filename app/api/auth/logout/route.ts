import { NextResponse } from 'next/server'
import cookie from 'cookie'
import argon2 from 'argon2'
import { prisma } from '../../../../lib/prisma'

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const cookies = cookie.parse(cookieHeader || '')
    const refresh = cookies.refreshToken
    const sessionId = cookies.sessionId

    if (sessionId) {
      // try to verify refresh token matches the session before deleting
      const s = await prisma.session.findUnique({ where: { id: sessionId } })
      if (s) {
        try {
          if (refresh && (await argon2.verify(s.refreshTokenHash, refresh))) {
            await prisma.session.delete({ where: { id: sessionId } })
          } else {
            // If no refresh or verification fails, still delete session by id
            await prisma.session.delete({ where: { id: sessionId } })
          }
        } catch (e) {
          // deletion error
          console.warn('logout: error verifying/deleting session', e)
        }
      }
    } else if (refresh) {
      // fallback: try to find session by verifying refresh token across sessions
      const sessions = await prisma.session.findMany({})
      for (const s of sessions) {
        try {
          if (await argon2.verify(s.refreshTokenHash, refresh)) {
            await prisma.session.delete({ where: { id: s.id } })
            break
          }
        } catch (e) {
          // ignore verify errors and continue
        }
      }
    }

    const clearRefresh = cookie.serialize('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    const clearSession = cookie.serialize('sessionId', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })

    return NextResponse.json({ ok: true }, { status: 200, headers: { 'Set-Cookie': [clearRefresh, clearSession] } })
  } catch (err) {
    console.error('logout error', err)
    const clearRefresh = cookie.serialize('refreshToken', '', { httpOnly: true, path: '/', maxAge: 0 })
    const clearSession = cookie.serialize('sessionId', '', { httpOnly: true, path: '/', maxAge: 0 })
    return NextResponse.json({ error: 'Logout failed' }, { status: 500, headers: { 'Set-Cookie': [clearRefresh, clearSession] } })
  }
}

export function GET() {
  // prefer POST, but support GET for convenience
  const clear = cookie.serialize('refreshToken', '', { httpOnly: true, path: '/', maxAge: 0 })
  return NextResponse.json({ ok: true }, { status: 200, headers: { 'Set-Cookie': clear } })
}
