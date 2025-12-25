import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { requireAuth } from '@/app/lib/auth-utils'

export async function GET(req: Request) {
  try {
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

    const items = await prisma.item.findMany({
      where: { vaultId: vault.id },
      select: { 
        id: true, 
        secretType: true,
        encryptedData: true, 
        iv: true,
        metadata: true,
        createdAt: true, 
        updatedAt: true 
      }
    })

    return NextResponse.json(items)
  } catch (err) {
    console.error('get passwords error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
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
        console.error('Metadata validation failed:', validationError)
        return NextResponse.json({ 
          error: 'Invalid metadata: contains sensitive data or forbidden patterns' 
        }, { status: 400 })
      }
    }

    const item = await prisma.item.create({
      data: {
        vaultId: vault.id,
        secretType: secretType || 'PASSWORD', // Default to PASSWORD for backward compatibility
        encryptedData,
        iv,
        metadata: metadata || null,
      }
    })

    return NextResponse.json(item)
  } catch (err) {
    console.error('create password error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
