/**
 * Audit: no existing password generator found in codebase; introducing a single secure, reusable generator here.
 */

import crypto from 'crypto'

type PasswordOptions = {
  length?: number
  includeUpper?: boolean
  includeLower?: boolean
  includeNumbers?: boolean
  includeSymbols?: boolean
}

const DEFAULT_LENGTH = 16
// Ambiguous characters removed: O, 0, l, I, 1
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const NUMBERS = '23456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>/?'

function getRandomValues(byteLength: number): Uint8Array {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(byteLength)
    globalThis.crypto.getRandomValues(arr)
    return arr
  }
  // Fallback to Node.js crypto for server-side rendering
  return new Uint8Array(crypto.randomBytes(byteLength))
}

function secureRandomIndex(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0
  const maxByte = 256 - (256 % maxExclusive)
  let idx = 0
  do {
    idx = getRandomValues(1)[0]
  } while (idx >= maxByte)
  return idx % maxExclusive
}

function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars
}

export function generatePassword(options: PasswordOptions = {}): string {
  const {
    length = DEFAULT_LENGTH,
    includeUpper = true,
    includeLower = true,
    includeNumbers = true,
    includeSymbols = true,
  } = options

  const pools: Array<{ chars: string; enabled: boolean }> = [
    { chars: UPPER, enabled: includeUpper },
    { chars: LOWER, enabled: includeLower },
    { chars: NUMBERS, enabled: includeNumbers },
    { chars: SYMBOLS, enabled: includeSymbols },
  ]

  const activePools = pools.filter((p) => p.enabled)
  if (activePools.length === 0) {
    throw new Error('At least one character set must be enabled')
  }

  if (length < activePools.length) {
    throw new Error('Length must be at least the number of enabled character sets')
  }

  const allChars = activePools.map((p) => p.chars).join('')
  const passwordChars: string[] = []

  // Ensure at least one from each enabled set
  for (const pool of activePools) {
    const idx = secureRandomIndex(pool.chars.length)
    passwordChars.push(pool.chars[idx])
  }

  // Fill remaining characters
  while (passwordChars.length < length) {
    const idx = secureRandomIndex(allChars.length)
    passwordChars.push(allChars[idx])
  }

  // Shuffle to avoid predictable placement
  shuffle(passwordChars)

  return passwordChars.join('')
}
