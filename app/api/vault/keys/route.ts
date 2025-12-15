import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import cookie from 'cookie'

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const cookies = cookie.parse(cookieHeader || '')
    const sessionId = cookies.sessionId

    if (!sessionId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const session = await prisma.session.findUnique({ 
      where: { id: sessionId }, 
      select: { userId: true, expiresAt: true } 
    })

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const vault = await prisma.vault.findUnique({
      where: { userId: session.userId },
      select: { encryptedVaultKey: true, salt: true, kdfParams: true }
    })

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    return NextResponse.json(vault)
  } catch (err) {
    console.error('vault keys error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
