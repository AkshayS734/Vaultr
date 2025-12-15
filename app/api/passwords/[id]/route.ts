import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import cookie from 'cookie'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    // Verify item belongs to vault
    const item = await prisma.item.findUnique({
      where: { id },
      select: { vaultId: true }
    })

    if (!item || item.vaultId !== vault.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await prisma.item.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('delete password error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    // Verify item belongs to vault
    const item = await prisma.item.findUnique({
      where: { id },
      select: { vaultId: true }
    })

    if (!item || item.vaultId !== vault.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const updated = await prisma.item.update({
      where: { id },
      data: {
        encryptedData,
        iv
      }
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('update password error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
