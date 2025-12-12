import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import cookie from 'cookie'
import { logAuditEvent } from '../../../../../lib/audit'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieHeader = req.headers.get('cookie') || ''
    const cookies = cookie.parse(cookieHeader || '')
    const sessionId = cookies.sessionId

    if (!sessionId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const current = await prisma.session.findUnique({ where: { id: sessionId } })
    if (!current) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const target = await prisma.session.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    if (target.userId !== current.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.session.delete({ where: { id } })

    // Log the session deletion
    await logAuditEvent('SESSION_DELETE', current.userId, { sessionId: id, targetUserId: target.userId })

    // If deleting current session, clear cookies
    if (id === sessionId) {
      const clearRefresh = cookie.serialize('refreshToken', '', { httpOnly: true, path: '/', maxAge: 0 })
      const clearSession = cookie.serialize('sessionId', '', { httpOnly: true, path: '/', maxAge: 0 })
      const response = NextResponse.json({ ok: true }, { status: 200 })
      response.headers.append('Set-Cookie', clearRefresh)
      response.headers.append('Set-Cookie', clearSession)
      return response
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('session delete error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
