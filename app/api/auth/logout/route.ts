import { NextResponse } from 'next/server'
import cookie from 'cookie'
import argon2 from 'argon2'
import { prisma } from '../../../lib/prisma'
import { logAuditEvent } from '../../../lib/audit'
import { validateCsrf, serializeCsrfCookie } from '@/app/lib/csrf'
import { requireAuth } from '@/app/lib/auth-utils'

export async function POST(req: Request) {
  try {
    // Verify user is authenticated
    const auth = await requireAuth(req, false)
    if (!auth.success) return auth.response

    const csrfCheck = validateCsrf(req)
    if (!csrfCheck.ok) return csrfCheck.response!

    const cookieHeader = req.headers.get('cookie') || ''
    const cookies = cookie.parse(cookieHeader || '')
    const refresh = cookies.refreshToken
    const sessionId = cookies.sessionId

    if (sessionId) {
      // Delete session by ID (simple case)
      try {
        // Verify that the refresh token matches before deletion (security check)
        const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { refreshTokenHash: true, userId: true } })
        if (session && refresh) {
          const tokenMatches = await argon2.verify(session.refreshTokenHash, refresh).catch(() => false)
          if (tokenMatches) {
            await prisma.session.delete({ where: { id: sessionId } })
            // Log the logout
            await logAuditEvent('LOGOUT', session.userId, { sessionId })
          } else {
            // Token mismatch - still delete the session but don't trust the token
            await prisma.session.delete({ where: { id: sessionId } })
          }
        } else if (session) {
          // No refresh token provided, but session exists - delete it
          await prisma.session.delete({ where: { id: sessionId } })
          await logAuditEvent('LOGOUT', session.userId, { sessionId })
        }
      } catch (e) {
        console.warn('logout: error deleting session', e)
      }
    }

    const clearRefresh = cookie.serialize('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })
    const clearSession = cookie.serialize('sessionId', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })

    const clearCsrf = serializeCsrfCookie('')

    const response = NextResponse.json({ ok: true }, { status: 200 })
    response.headers.append('Set-Cookie', clearRefresh)
    response.headers.append('Set-Cookie', clearSession)
    response.headers.append('Set-Cookie', clearCsrf)
    return response
  } catch (err) {
    console.error('[ERR_LOGOUT]', err instanceof Error ? err.message : String(err))
    const clearRefresh = cookie.serialize('refreshToken', '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' })
    const clearSession = cookie.serialize('sessionId', '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' })
    const clearCsrf = serializeCsrfCookie('')
    const response = NextResponse.json({ error: 'Logout failed' }, { status: 500 })
    response.headers.append('Set-Cookie', clearRefresh)
    response.headers.append('Set-Cookie', clearSession)
    response.headers.append('Set-Cookie', clearCsrf)
    return response
  }
}
