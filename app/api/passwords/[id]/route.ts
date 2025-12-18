import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    // Verify authentication and email verification
    const auth = await requireAuth(req, true)
    if (!auth.success) {
      return auth.response
    }

    const { user } = auth

    const vault = await prisma.vault.findUnique({
      where: { userId: user.id },
      select: { id: true }
    })

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    const item = await prisma.item.findUnique({
      where: { id },
      select: { 
        id: true, 
        vaultId: true, 
        secretType: true,
        encryptedData: true, 
        iv: true,
        metadata: true,
        createdAt: true, 
        updatedAt: true 
      }
    })

    if (!item || item.vaultId !== vault.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (err) {
    console.error('get password error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    // Verify authentication and email verification
    const auth = await requireAuth(req, true)
    if (!auth.success) {
      return auth.response
    }

    const { user } = auth

    const vault = await prisma.vault.findUnique({
      where: { userId: user.id },
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
    
    // Verify authentication and email verification
    const auth = await requireAuth(req, true)
    if (!auth.success) {
      return auth.response
    }

    const { user } = auth

    const vault = await prisma.vault.findUnique({
      where: { userId: user.id },
      select: { id: true }
    })

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    const body = await req.json()
    const { encryptedData, iv, metadata, secretType } = body

    if (!encryptedData || !iv) {
      return NextResponse.json({ error: 'Missing encrypted data' }, { status: 400 })
    }

    // Validate that metadata doesn't contain sensitive data
    if (metadata) {
      const { validateMetadataSafety } = await import('@/lib/secret-utils')
      try {
        validateMetadataSafety(metadata)
      } catch (validationError) {
        console.error('Metadata validation failed:', validationError)
        return NextResponse.json({ 
          error: 'Invalid metadata: contains sensitive data' 
        }, { status: 400 })
      }
    }

    // Verify item belongs to vault
    const item = await prisma.item.findUnique({
      where: { id },
      select: { vaultId: true }
    })

    if (!item || item.vaultId !== vault.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const updateData: any = {
      encryptedData,
      iv,
    }
    
    if (metadata !== undefined) {
      updateData.metadata = metadata
    }
    
    if (secretType) {
      updateData.secretType = secretType
    }

    const updated = await prisma.item.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('update password error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
