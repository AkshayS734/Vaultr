import crypto from 'crypto'
import cookie from 'cookie'

const CSRF_COOKIE = 'csrfToken'

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function serializeCsrfCookie(token: string) {
  const isClearing = token === ''
  return cookie.serialize(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: isClearing ? 0 : 30 * 24 * 60 * 60,
  })
}

export function parseCsrfTokens(req: Request) {
  const cookieHeader = req.headers.get('cookie') || ''
  const cookies = cookie.parse(cookieHeader)
  return cookies[CSRF_COOKIE]
}

export function validateCsrf(req: Request) {
  const method = req.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { ok: true }
  }

  const cookieToken = parseCsrfTokens(req)
  const headerToken = req.headers.get('x-csrf-token') || ''

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'CSRF validation failed' }), { status: 403, headers: { 'Content-Type': 'application/json' } }) }
  }

  return { ok: true }
}
