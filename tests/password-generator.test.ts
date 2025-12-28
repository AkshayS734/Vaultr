/**
 * Tests for password generator
 * Ensures generated passwords are strong, configurable, and unpredictable.
 */

import { generatePassword } from '@/app/lib/password-generator'
import { checkPasswordStrength } from '@/app/lib/password-strength'

describe('generatePassword', () => {
  it('generates strong passwords by default', () => {
    const pwd = generatePassword()
    const result = checkPasswordStrength(pwd)
    expect(pwd.length).toBeGreaterThanOrEqual(16)
    expect(result.isStrong).toBe(true)
    expect(result.feedback).toHaveLength(0)
  })

  it('respects length option', () => {
    const pwd = generatePassword({ length: 24 })
    expect(pwd.length).toBe(24)
  })

  it('includes requested character sets', () => {
    const pwd = generatePassword({ includeSymbols: false })
    expect(/[A-Z]/.test(pwd)).toBe(true)
    expect(/[a-z]/.test(pwd)).toBe(true)
    expect(/[0-9]/.test(pwd)).toBe(true)
    expect(/[^a-zA-Z0-9]/.test(pwd)).toBe(false)
  })

  it('throws when all character sets are disabled', () => {
    expect(() => generatePassword({ includeUpper: false, includeLower: false, includeNumbers: false, includeSymbols: false })).toThrow()
  })

  it('is not predictable across invocations', () => {
    const a = generatePassword()
    const b = generatePassword()
    expect(a).not.toEqual(b)
  })

  it('avoids ambiguous characters by default', () => {
    const pwd = generatePassword({ length: 64 })
    expect(pwd).not.toMatch(/[O0lI1]/)
  })
})
