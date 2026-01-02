import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { requireAuth } from '@/app/lib/auth-utils'
import { rateLimit } from '@/app/lib/redis'
import { getClientIp } from '@/app/lib/utils'

// Rate limit: 5 requests per minute per IP (prevent salt harvesting)
const VAULT_KEYS_MAX = 5
const VAULT_KEYS_WINDOW_MS = 60 * 1000

export async function GET(req: Request) {
  try {
    // Rate limit by IP to prevent salt harvesting attacks
    const ip = getClientIp(req)
    const rateLimitKey = `vault_keys:${ip || 'unknown'}`
    
    try {
      const rl = await rateLimit(rateLimitKey, VAULT_KEYS_WINDOW_MS, VAULT_KEYS_MAX)
      if (!rl.allowed) {
        const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch (e) {
      console.warn('Rate limit check failed, allowing request', e)
    }

    // Verify authentication and email verification
    const auth = await requireAuth(req, true)
    if (!auth.success) {
      return auth.response
    }

    const { user } = auth

    const vault = await prisma.vault.findUnique({
      where: { userId: user.id },
      select: { encryptedVaultKey: true, salt: true, kdfParams: true }
    })

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    return NextResponse.json(vault)
  } catch (err) {
    console.error('[ERR_VAULT_KEYS]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
