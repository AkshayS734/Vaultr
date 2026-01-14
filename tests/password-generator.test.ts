/**
 * Tests for password generator
 * Ensures generated passwords are chunked, respect length constraints,
 * and maintain strong randomness while preserving all enabled character categories.
 */

import { generatePassword } from '@/app/lib/password-generator'
import { checkPasswordStrength } from '@/app/lib/password-strength'

describe('generatePassword', () => {
  it('generates chunked passwords with correct total length', () => {
    const length = 16
    const pwd = generatePassword({ length })
    const parts = pwd.split('-')

    // Should have 3 chunks
    expect(parts).toHaveLength(3)

    // Total length (excluding separators) should match requested
    const totalChars = parts.reduce((sum, p) => sum + p.length, 0)
    expect(totalChars).toBe(length)

    // Each chunk should have at least 3 characters
    parts.forEach((part) => {
      expect(part.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('respects the length option', () => {
    const lengths = [9, 12, 20, 30, 64]
    lengths.forEach((length) => {
      const pwd = generatePassword({ length })
      const totalChars = pwd.split('-').reduce((sum, p) => sum + p.length, 0)
      expect(totalChars).toBe(length)
    })
  })

  it('enforces minimum length of 9 characters (3 chunks × 3 min)', () => {
    const pwd = generatePassword({ length: 5 })
    const totalChars = pwd.split('-').reduce((sum, p) => sum + p.length, 0)
    expect(totalChars).toBeGreaterThanOrEqual(9)
  })

  it('includes all requested character sets across chunks', () => {
    const pwd = generatePassword({ length: 16 })
    expect(/[A-Z]/.test(pwd)).toBe(true)
    expect(/[a-z]/.test(pwd)).toBe(true)
    expect(/[0-9]/.test(pwd)).toBe(true)
    expect(/[^a-zA-Z0-9-]/.test(pwd)).toBe(true)
  })

  it('excludes symbols when disabled while maintaining structure', () => {
    const pwd = generatePassword({ length: 16, includeSymbols: false })
    const withoutSeparators = pwd.replace(/-/g, '')
    expect(/[A-Z]/.test(withoutSeparators)).toBe(true)
    expect(/[a-z]/.test(withoutSeparators)).toBe(true)
    expect(/[0-9]/.test(withoutSeparators)).toBe(true)
    // No symbols other than structural hyphens
    expect(/[^a-zA-Z0-9]/.test(withoutSeparators)).toBe(false)
    const parts = pwd.split('-')
    expect(parts).toHaveLength(3)
  })

  it('generates strong passwords by default', () => {
    const pwd = generatePassword({ length: 16 })
    const result = checkPasswordStrength(pwd)
    expect(result.isStrong).toBe(true)
    expect(result.feedback).toHaveLength(0)
  })

  it('throws when all character sets are disabled', () => {
    expect(() => generatePassword({ includeUpper: false, includeLower: false, includeNumbers: false, includeSymbols: false })).toThrow()
  })

  it('is not predictable across invocations', () => {
    const a = generatePassword({ length: 16 })
    const b = generatePassword({ length: 16 })
    expect(a).not.toEqual(b)
  })

  it('avoids ambiguous characters by default', () => {
    const pwd = generatePassword({ length: 32 })
    expect(pwd).not.toMatch(/[O0lI1]/)
  })

  it('distributes characters across chunks randomly', () => {
    const chunkSizes: number[][] = []
    for (let i = 0; i < 20; i++) {
      const pwd = generatePassword({ length: 30 })
      const parts = pwd.split('-')
      chunkSizes.push(parts.map((p) => p.length))
    }

    // Check that chunk sizes vary across different generations
    const firstChunkSizes = chunkSizes.map((s) => s[0])
    const uniqueSizes = new Set(firstChunkSizes)
    expect(uniqueSizes.size).toBeGreaterThan(1)
  })
})
