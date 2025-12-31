/**
 * Tests for PasswordHealthEngine
 */
import { evaluatePasswordHealth } from '@/app/lib/password-health-engine'

// Mock vault-password-reuse to control reuse outcomes
jest.mock('@/app/lib/vault-password-reuse', () => ({
  checkVaultPasswordReuse: jest.fn(async (pw: string) => {
    if (pw === 'reusedPw') {
      return { isReused: true, matches: 1, matchingTitles: ['Item A'], matchingIds: ['id-1'] }
    }
    return { isReused: false, matches: 0, matchingTitles: [], matchingIds: [] }
  }),
}))

describe('PasswordHealthEngine', () => {
  it('calls breach checker with password (not hash prefix)', async () => {
    const password = 'StrongPassw0rd!'
    
    const breachSpy = jest.fn(async (pw: string) => {
      // Assert the full password is passed, not a hash or prefix
      expect(pw).toBe(password)
      return true
    })

    const result = await evaluatePasswordHealth(password, { 
      enableBreachCheck: true, 
      breachChecker: breachSpy 
    })
    
    expect(result.flags.breached).toBe(true)
    expect(result.warnings.some((w) => w.toLowerCase().includes('breach'))).toBe(true)
    expect(breachSpy).toHaveBeenCalledTimes(1)
    expect(breachSpy).toHaveBeenCalledWith(password)
  })

  it('scores length and diversity and sets weak flag appropriately', async () => {
    const password = 'Aa1!aaaaaaaa' // length 12, all categories
    const result = await evaluatePasswordHealth(password)
    expect(result.score).toBeGreaterThanOrEqual(60)
    expect(result.flags.weak).toBe(false)
    // Should have no diversity warnings
    expect(result.warnings.find((w) => /lowercase|uppercase|numbers|special/i.test(w))).toBeUndefined()
  })

  it('adds age flag and penalty when password is old', async () => {
    const password = 'Aa1!newer'
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) // 200 days ago
    const result = await evaluatePasswordHealth(password, { lastChangedAt: oldDate, ageThresholdDays: 180 })
    expect(result.flags.old).toBe(true)
    expect(result.warnings.some((w) => /older than 180/i.test(w))).toBe(true)
  })

  it('penalizes and flags when reuse is detected', async () => {
    const password = 'reusedPw'
    const fakeKey = { type: 'secret' } as unknown as CryptoKey
    const result = await evaluatePasswordHealth(password, {
      vaultKey: fakeKey,
      existingItems: [{ id: 'x', encryptedData: 'c', iv: 'i' }],
    })

    expect(result.flags.reused).toBe(true)
    expect(result.warnings.some((w) => /already used/i.test(w))).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('does NOT call breach check when enableBreachCheck is false', async () => {
    const password = 'StrongPassw0rd!'
    const breachSpy = jest.fn(async () => true)

    // Pass both enableBreachCheck=false AND a query function
    // The engine should NOT call the query function
    const result = await evaluatePasswordHealth(password, {
      enableBreachCheck: false,
      breachChecker: breachSpy,
    })

    // Breach flag must be false and query never called
    expect(result.flags.breached).toBe(false)
    expect(breachSpy).not.toHaveBeenCalled()
    // Score should NOT include breach penalty
    expect(result.score).toBeGreaterThan(0)
  })

  it('does NOT call breach check when no query function provided, even if enableBreachCheck is true', async () => {
    const password = 'StrongPassw0rd!'
    const result = await evaluatePasswordHealth(password, {
      enableBreachCheck: true,
      // No breachChecker provided
    })

    // Breach flag must be false when no query available
    expect(result.flags.breached).toBe(false)
    expect(result.score).toBeGreaterThan(0)
  })
})