        import { NextResponse } from 'next/server'
import { rateLimit } from '@/app/lib/redis'
import { getClientIp } from '@/app/lib/utils'
import { VAULT_RATE_LIMITS } from '@/app/lib/vault-rate-limit'

/**
 * HIBP k-Anonymity Breach Proxy
 * 
 * SECURITY INVARIANTS:
 * - Accepts ONLY GET with `prefix` of exactly 5 hex chars (SHA-1 prefix)
 * - Forwards prefix to HIBP-compatible upstream: ${BREACH_UPSTREAM_URL}/{prefix}
 * - Returns RAW TEXT response (suffix:count lines)
 * - Client performs suffix matching (true k-anonymity)
 * - No logging, no parsing, no persistence, no analytics
 * - Fail-open on any error (returns empty string)
 * 
 * HIBP RESPONSE FORMAT (text/plain):
 * SUFFIX:COUNT
 * SUFFIX:COUNT
 * ...
 * 
 * Add-Padding header ensures constant response size (prevents timing attacks)
 */

export async function GET(req: Request) {
  try {
    // Rate limit: 10 breach checks per minute per IP (prevent HIBP API abuse)
    const ip = getClientIp(req)
    const rateLimitKey = `${VAULT_RATE_LIMITS.breach.keyPrefix}:${ip || 'unknown'}`
    
    try {
      const rl = await rateLimit(rateLimitKey, VAULT_RATE_LIMITS.breach.windowMs, VAULT_RATE_LIMITS.breach.max)
      if (!rl.allowed) {
        const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
        return new NextResponse('', { 
          status: 429,
          headers: { 
            'Content-Type': 'text/plain',
            'Retry-After': String(retryAfter)
          }
        })
      }
    } catch (e) {
      console.warn('[BREACH] Rate limit check failed, allowing request', e)
    }
    const url = new URL(req.url)
    const raw = url.searchParams.get('prefix') || ''
    const prefix = raw.toUpperCase().trim()

    // Strict validation: exactly 5 hex chars
    if (!/^[0-9A-F]{5}$/.test(prefix)) {
      return new NextResponse('', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    const upstream = process.env.BREACH_UPSTREAM_URL
    if (!upstream) {
      // No upstream configured → fail-open (empty response)
      return new NextResponse('', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    // Build HIBP-compatible URL: https://api.pwnedpasswords.com/range/{PREFIX}
    const upstreamUrl = `${upstream.replace(/\/$/, '')}/${prefix}`

    const res = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { 
        'Add-Padding': 'true',
        'User-Agent': 'Vaultr-Password-Manager'
      },
      cache: 'no-store',
      redirect: 'error',
    })

    if (!res.ok) {
      // Fail-open: upstream error
      return new NextResponse('', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    // Return raw text response (no parsing on server)
    const text = await res.text()
    return new NextResponse(text, { 
      status: 200,
      headers: { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  } catch {
    // Fail-open on any unexpected error
    return new NextResponse('', { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}