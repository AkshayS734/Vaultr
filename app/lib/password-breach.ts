/**
 * HIBP k-Anonymity Breach Check (Client-Side)
 * 
 * SECURITY REQUIREMENTS:
 * - Uses SHA-1 ONLY for breach detection (HIBP requirement)
 * - SHA-1 must NOT be used for storage, auth, reuse, or encryption
 * - Plaintext password never leaves client memory
 * - Only 5-char prefix sent to server
 * - Suffix matching performed CLIENT-SIDE (true k-anonymity)
 * - Fail-open on any error (returns false)
 * - No logging, no caching, no retries
 * 
 * HIBP K-ANONYMITY FLOW:
 * 1. Hash password with SHA-1 → hex (uppercase)
 * 2. Split: prefix = first 5 chars, suffix = remaining chars
 * 3. Send prefix to /api/breach
 * 4. Parse text response: SUFFIX:COUNT\n...
 * 5. Match suffix case-insensitively
 * 6. Ignore padded entries (count === 0)
 * 7. Return true only if exact suffix match exists
 */

/**
 * Derive SHA-1 hash (hex, uppercase) for HIBP breach check
 * CRITICAL: This is ONLY for breach detection. Never use SHA-1 elsewhere.
 */
async function deriveSha1Hex(password: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(password)
  const digest = await (globalThis?.crypto?.subtle as SubtleCrypto).digest('SHA-1', data)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex.toUpperCase()
}

/**
 * Check if password is breached using HIBP k-anonymity API
 * 
 * @param password - Plaintext password (never logged or persisted)
 * @param endpoint - Internal proxy endpoint (e.g., '/api/breach')
 * @returns true if breached, false if safe or on error
 */
export async function checkPasswordBreach(password: string, endpoint: string): Promise<boolean> {
  try {
    // 1. Hash with SHA-1 (HIBP requirement)
    const sha1Hex = await deriveSha1Hex(password)
    
    // 2. Split into prefix (5 chars) and suffix (remaining)
    const prefix = sha1Hex.slice(0, 5)
    const suffix = sha1Hex.slice(5)

    // 3. Send only prefix to server
    const url = `${endpoint}?prefix=${prefix}`
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'text/plain' },
      cache: 'no-store',
    })

    if (!res.ok) {
      // Fail-open: server error
      return false
    }

    // 4. Parse text response (SUFFIX:COUNT lines)
    const text = await res.text()
    if (!text || text.trim() === '') {
      // Empty response = not found
      return false
    }

    // 5. Check if our suffix exists in the response
    const lines = text.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const [responseSuffix, countStr] = trimmed.split(':')
      if (!responseSuffix || !countStr) continue

      // Ignore padded entries (HIBP padding has count=0)
      const count = parseInt(countStr, 10)
      if (count === 0) continue

      // Case-insensitive exact match
      if (responseSuffix.toUpperCase() === suffix) {
        return true
      }
    }

    // No match found
    return false
  } catch {
    // Fail-open on any error (network, parsing, etc.)
    return false
  }
}

/**
 * Factory: Create a breach check callback for PasswordHealthEngine
 * 
 * This returns a function that accepts a PASSWORD (not a hash prefix)
 * and performs the full HIBP k-anonymity check.
 */
export function makeBreachChecker(endpoint: string): (password: string) => Promise<boolean> {
  return async (password: string) => {
    return await checkPasswordBreach(password, endpoint)
  }
}
