import { NextResponse } from 'next/server'
import { requireAuth } from '@/app/lib/auth-utils'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if (!auth.success) return auth.response

  return NextResponse.json({
    ok: true,
    user: auth.user,
  })
}
