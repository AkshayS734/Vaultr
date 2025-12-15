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
      select: { id: true }
    })

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    const items = await prisma.item.findMany({
      where: { vaultId: vault.id },
      select: { id: true, encryptedData: true, iv: true, createdAt: true, updatedAt: true }
    })

    return NextResponse.json(items)
  } catch (err) {
    console.error('get passwords error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
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
      select: { id: true }
    })

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    const body = await req.json()
    const { encryptedData, iv } = body

    if (!encryptedData || !iv) {
      return NextResponse.json({ error: 'Missing encrypted data' }, { status: 400 })
    }

    const item = await prisma.item.create({
      data: {
        vaultId: vault.id,
        encryptedData,
        iv
      }
    })

    return NextResponse.json(item)
  } catch (err) {
    console.error('create password error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
