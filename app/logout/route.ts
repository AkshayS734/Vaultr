import { NextResponse } from 'next/server'
import cookie from 'cookie'
import argon2 from 'argon2'
import { prisma } from '../../lib/prisma'

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const cookies = cookie.parse(cookieHeader || '')
    const refresh = cookies.refreshToken
    const sessionId = cookies.sessionId

    if (sessionId) {
      const s = await prisma.session.findUnique({ where: { id: sessionId } })
      if (s) {
        try {
          if (refresh && (await argon2.verify(s.refreshTokenHash, refresh))) {
            await prisma.session.delete({ where: { id: sessionId } })
          } else {
            await prisma.session.delete({ where: { id: sessionId } })
          }
        } catch (e) {
          console.warn('logout: error verifying/deleting session', e)
        }
      }
    } else if (refresh) {
      const sessions = await prisma.session.findMany({})
      for (const s of sessions) {
        try {
          if (await argon2.verify(s.refreshTokenHash, refresh)) {
            await prisma.session.delete({ where: { id: s.id } })
            break
          }
        } catch (e) {
          // ignore
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

    return NextResponse.redirect(new URL('/', req.url), { headers: { 'Set-Cookie': [clearRefresh, clearSession] } })
  } catch (err) {
    console.error('logout route error', err)
    const clearRefresh = cookie.serialize('refreshToken', '', { httpOnly: true, path: '/', maxAge: 0 })
    const clearSession = cookie.serialize('sessionId', '', { httpOnly: true, path: '/', maxAge: 0 })
    return NextResponse.redirect(new URL('/', req.url), { headers: { 'Set-Cookie': [clearRefresh, clearSession] } })
  }
}
