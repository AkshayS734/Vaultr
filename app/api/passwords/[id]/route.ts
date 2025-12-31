import { NextResponse } from 'next/server'
import { Prisma, SecretType as PrismaSecretType } from '@prisma/client'
import { prisma } from '@/app/lib/prisma'
import { requireAuth } from '@/app/lib/auth-utils'
import { validateCsrf } from '@/app/lib/csrf'

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
    console.error('[ERR_GET_PASSWORD]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrfCheck = validateCsrf(req)
    if (!csrfCheck.ok) return csrfCheck.response!

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
    console.error('[ERR_DELETE_PASSWORD]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrfCheck = validateCsrf(req)
    if (!csrfCheck.ok) return csrfCheck.response!

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

    // ENCRYPTION BOUNDARY VALIDATION
    // ================================
    // CRITICAL: Validate that metadata contains ONLY non-sensitive information
    // - encryptedData: Contains ALL sensitive values (encrypted)
    // - metadata: Contains ONLY non-sensitive UI metadata (unencrypted)
    // - This validation prevents accidental secret leakage into metadata
    if (metadata) {
      const { validateMetadataSafety } = await import('@/app/lib/secret-utils')
      const { validateMetadataSecurity } = await import('@/app/schemas/secrets')
      
      try {
        // Runtime validation: Check for forbidden fields and patterns
        validateMetadataSafety(metadata)
        validateMetadataSecurity(metadata)
      } catch (validationError) {
        console.error('[ERR_METADATA_VALIDATION]', validationError instanceof Error ? validationError.message : String(validationError))
        return NextResponse.json({ 
          error: 'Invalid metadata: contains sensitive data or forbidden patterns' 
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

    const updateData: {
      encryptedData: string;
      iv: string;
      metadata?: Prisma.InputJsonValue;
      secretType?: PrismaSecretType;
    } = {
      encryptedData,
      iv,
    }
    
    if (metadata !== undefined) {
      updateData.metadata = metadata
    }
    
    if (secretType) {
      updateData.secretType = secretType as PrismaSecretType
    }

    const updated = await prisma.item.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[ERR_UPDATE_PASSWORD]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
