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
const CHUNK_COUNT = 3
const MIN_CHUNK_LENGTH = 3
const MIN_PASSWORD_LENGTH = CHUNK_COUNT * MIN_CHUNK_LENGTH // 9 characters minimum
// Ambiguous characters removed: O, 0, l, I, 1
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const NUMBERS = '23456789'
// Note: '-' is removed from symbols since it's used as the chunk separator
const SYMBOLS = '!@#$%^&*()_=+[]{};:,.<>/?'

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

function distributeLengths(totalLength: number, chunkCount: number, minPerChunk: number): number[] {
  const chunkLengths = new Array(chunkCount).fill(minPerChunk)
  let remaining = totalLength - chunkCount * minPerChunk

  // Distribute remaining characters randomly across chunks
  while (remaining > 0) {
    const randomChunk = secureRandomIndex(chunkCount)
    chunkLengths[randomChunk]++
    remaining--
  }

  return chunkLengths
}

function containsFromPool(candidate: string, pool: string): boolean {
  for (const ch of candidate) {
    if (pool.includes(ch)) return true
  }
  return false
}

export function generatePassword(options: PasswordOptions = {}): string {
  const {
    length = DEFAULT_LENGTH,
    includeUpper = true,
    includeLower = true,
    includeNumbers = true,
    includeSymbols = true,
  } = options

  // Enforce minimum total length (must fit at least 3 chars per chunk)
  const totalLength = Math.max(length, MIN_PASSWORD_LENGTH)

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

  const allowedPool = activePools.map((p) => p.chars).join('')

  if (!allowedPool.length) {
    throw new Error('No characters available for generation')
  }

  // Regenerate until all selected categories are present in the final password
  const maxAttempts = 500
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Distribute totalLength across CHUNK_COUNT chunks
    const chunkLengths = distributeLengths(totalLength, CHUNK_COUNT, MIN_CHUNK_LENGTH)
    
    // Verify distribution sums to totalLength
    const distributionSum = chunkLengths.reduce((a, b) => a + b, 0)
    if (distributionSum !== totalLength) {
      // This should not happen, but skip this attempt if it does
      console.warn(`distributeLengths mismatch: sum=${distributionSum}, expected=${totalLength}, lengths=${JSON.stringify(chunkLengths)}`)
      continue
    }
    
    const chunks: string[] = []

    // Generate each chunk using allowed pool
    for (let i = 0; i < CHUNK_COUNT; i++) {
      const chunkSize = chunkLengths[i]
      if (chunkSize < 0) {
        console.error(`Negative chunk size: chunk ${i} = ${chunkSize}`)
        continue
      }
      const chars: string[] = []
      for (let j = 0; j < chunkSize; j++) {
        const idx = secureRandomIndex(allowedPool.length)
        chars.push(allowedPool[idx])
      }
      const chunk = chars.join('')
      if (chunk.length !== chunkSize) {
        console.error(`Chunk ${i} length mismatch: expected ${chunkSize}, got ${chunk.length}`)
      }
      chunks.push(chunk)
    }

    const candidate = chunks.join('-')

    // Enforce global constraint: at least one from each selected category
    const satisfiesCategories = activePools.every((pool) => containsFromPool(candidate, pool.chars))

    if (satisfiesCategories) {
      return candidate
    }
  }

  throw new Error('Failed to generate password after multiple attempts')
}
