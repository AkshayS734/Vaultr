import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { requireAuth } from '@/app/lib/auth-utils'
import { validateCsrf } from '@/app/lib/csrf'
import { rateLimit } from '@/app/lib/redis'
import { VAULT_RATE_LIMITS } from '@/app/lib/vault-rate-limit'

export async function GET(req: Request) {
  try {
    // Verify authentication and email verification
    const auth = await requireAuth(req, true)
    if (!auth.success) {
      return auth.response
    }

    const { user } = auth

    // Rate limit: 100 password operations per 5 minutes per user
    const rlKey = `${VAULT_RATE_LIMITS.passwords.keyPrefix}:${user.id}`
    const rl = await rateLimit(rlKey, VAULT_RATE_LIMITS.passwords.windowMs, VAULT_RATE_LIMITS.passwords.max)
    if (!rl.allowed) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many password requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

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
    console.error('[ERR_GET_PASSWORDS]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const csrfCheck = validateCsrf(req)
    if (!csrfCheck.ok) return csrfCheck.response!

    // SECURITY ARCHITECTURE NOTE:
    // ===========================
    // This endpoint handles VAULT PASSWORDS (zero-knowledge encrypted secrets).
    // 
    // Password reuse detection is NOT applied here because:
    // 1. Server receives only encryptedData (AES-GCM ciphertext)
    // 2. Server has no vault key (derived from master password client-side)
    // 3. Server CANNOT decrypt vault passwords (zero-knowledge by design)
    // 
    // Password reuse detection is ONLY applied to:
    // - Account authentication passwords (/api/auth/change-password)
    // - Where server has legitimate plaintext access via argon2.verify()
    // 
    // For vault password reuse warnings, implement CLIENT-SIDE ONLY detection.
    // See: docs/security/VAULT_PASSWORD_SECURITY_SUMMARY.md
    
    // Verify authentication and email verification
    const auth = await requireAuth(req, true)
    if (!auth.success) {
      return auth.response
    }

    const { user } = auth

    // Rate limit: 100 password operations per 5 minutes per user
    const rlKey = `${VAULT_RATE_LIMITS.passwords.keyPrefix}:${user.id}`
    const rl = await rateLimit(rlKey, VAULT_RATE_LIMITS.passwords.windowMs, VAULT_RATE_LIMITS.passwords.max)
    if (!rl.allowed) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many password requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

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
    console.error('[ERR_CREATE_PASSWORD]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
