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
