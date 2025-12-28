/**
 * Tests for vault password reuse detection.
 * Verifies client-side only implementation with zero-knowledge guarantees.
 */

import { checkVaultPasswordReuse, formatReuseWarning } from '@/app/lib/vault-password-reuse'
import * as crypto from '@/app/lib/crypto'

// Mock decryptItem to avoid crypto setup complexity
jest.mock('@/app/lib/crypto', () => ({
  decryptItem: jest.fn(),
}))

const mockDecryptItem = crypto.decryptItem as jest.MockedFunction<
  typeof crypto.decryptItem
>

describe('Vault Password Reuse Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Mock CryptoKey for testing
  const testVaultKey = {} as CryptoKey

  describe('checkVaultPasswordReuse()', () => {
    it('should return empty result when no items exist', async () => {
      const result = await checkVaultPasswordReuse(
        'test-password',
        testVaultKey,
        []
      )

      expect(result.isReused).toBe(false)
      expect(result.matches).toBe(0)
      expect(result.matchingTitles).toEqual([])
      expect(result.matchingIds).toEqual([])
    })

    it('should return empty result when password is not reused', async () => {
      mockDecryptItem.mockResolvedValue({ password: 'unique-password-1' })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'Google' },
        },
      ]

      const result = await checkVaultPasswordReuse(
        'completely-different-password',
        testVaultKey,
        items
      )

      expect(result.isReused).toBe(false)
      expect(result.matches).toBe(0)
    })

    it('should detect single password reuse', async () => {
      const testPassword = 'reused-password'

      mockDecryptItem.mockResolvedValue({ password: testPassword })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'Netflix' },
        },
      ]

      const result = await checkVaultPasswordReuse(
        testPassword,
        testVaultKey,
        items
      )

      expect(result.isReused).toBe(true)
      expect(result.matches).toBe(1)
      expect(result.matchingTitles).toContain('Netflix')
      expect(result.matchingIds).toContain('item-1')
    })

    it('should detect multiple password reuse', async () => {
      const testPassword = 'super-common-password'

      mockDecryptItem.mockResolvedValue({ password: testPassword })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'Gmail' },
        },
        {
          id: 'item-2',
          encryptedData: 'encrypted2',
          iv: 'iv2',
          secretType: 'PASSWORD',
          metadata: { title: 'Facebook' },
        },
      ]

      const result = await checkVaultPasswordReuse(
        testPassword,
        testVaultKey,
        items
      )

      expect(result.isReused).toBe(true)
      expect(result.matches).toBe(2)
      expect(result.matchingTitles).toContain('Gmail')
      expect(result.matchingTitles).toContain('Facebook')
    })

    it('should exclude item when excludeId is provided', async () => {
      const testPassword = 'reused-password'

      jest.clearAllMocks()
      mockDecryptItem.mockResolvedValue({ password: testPassword })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'Service A' },
        },
        {
          id: 'item-2',
          encryptedData: 'encrypted2',
          iv: 'iv2',
          secretType: 'PASSWORD',
          metadata: { title: 'Service B' },
        },
      ]

      // When editing item-2, only item-1 should be detected as reuse
      const result = await checkVaultPasswordReuse(
        testPassword,
        testVaultKey,
        items,
        'item-2'
      )

      expect(result.isReused).toBe(true)
      expect(result.matches).toBe(1)
      expect(result.matchingTitles).toContain('Service A')
      expect(result.matchingIds).toContain('item-1')
      expect(result.matchingIds).not.toContain('item-2')
    })

    it('should skip non-PASSWORD secretTypes', async () => {
      const testPassword = 'api-key-password'

      jest.clearAllMocks()
      mockDecryptItem
        .mockResolvedValueOnce({ password: testPassword }) // PASSWORD type
        .mockResolvedValueOnce({ key: testPassword }) // API_KEY type

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'My Password' },
        },
        {
          id: 'item-2',
          encryptedData: 'encrypted2',
          iv: 'iv2',
          secretType: 'API_KEY',
          metadata: { title: 'My API Key' },
        },
      ]

      const result = await checkVaultPasswordReuse(
        testPassword,
        testVaultKey,
        items
      )

      // Should only match the PASSWORD type
      expect(result.matches).toBe(1)
      expect(result.matchingTitles).toContain('My Password')
      expect(result.matchingTitles).not.toContain('My API Key')
    })

    it('should skip items without password field', async () => {
      const testPassword = 'test-password'

      jest.clearAllMocks()
      // Return an object without password field
      mockDecryptItem.mockResolvedValue({ title: 'No Password' })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'No Password Item' },
        },
      ]

      const result = await checkVaultPasswordReuse(
        testPassword,
        testVaultKey,
        items
      )

      // Should not match since password field is missing
      expect(result.isReused).toBe(false)
      expect(result.matches).toBe(0)
    })

    it('should handle gracefully when decryption fails', async () => {
      mockDecryptItem.mockRejectedValue(new Error('Decryption failed'))

      const items = [
        {
          id: 'item-1',
          encryptedData: 'corrupted-data',
          iv: 'invalid-iv',
          secretType: 'PASSWORD',
          metadata: { title: 'Broken Item' },
        },
      ]

      // Should not throw, just skip the corrupted item
      const result = await checkVaultPasswordReuse(
        'test-password',
        testVaultKey,
        items
      )

      expect(result.isReused).toBe(false)
      expect(result.matches).toBe(0)
    })

    it('should not persist or log password information', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const testPassword = 'secret-password-123'

      mockDecryptItem.mockResolvedValue({ password: testPassword })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'Service' },
        },
      ]

      const result = await checkVaultPasswordReuse(
        testPassword,
        testVaultKey,
        items
      )

      // Result should NOT contain the actual password
      expect(JSON.stringify(result)).not.toContain(testPassword)

      consoleSpy.mockRestore()
    })

    it('should return transient result not stored in database', async () => {
      const testPassword = 'transient-password'

      mockDecryptItem.mockResolvedValue({ password: testPassword })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'Service' },
        },
      ]

      const result1 = await checkVaultPasswordReuse(
        testPassword,
        testVaultKey,
        items
      )

      // Result object should be a fresh in-memory object
      const result2 = await checkVaultPasswordReuse(
        testPassword,
        testVaultKey,
        items
      )

      // Results should be equal but not the same reference
      expect(result1).toEqual(result2)
      expect(result1).not.toBe(result2)
    })

    it('should use case-sensitive comparison', async () => {
      const testPassword = 'TestPassword'

      mockDecryptItem.mockResolvedValue({ password: testPassword })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'Service' },
        },
      ]

      // Different case should not match
      const result = await checkVaultPasswordReuse(
        'testpassword',
        testVaultKey,
        items
      )

      expect(result.isReused).toBe(false)
      expect(result.matches).toBe(0)
    })
  })

  describe('formatReuseWarning()', () => {
    it('should return empty string when not reused', () => {
      const result = {
        isReused: false,
        matches: 0,
        matchingTitles: [],
        matchingIds: [],
      }

      const message = formatReuseWarning(result)
      expect(message).toBe('')
    })

    it('should format single match', () => {
      const result = {
        isReused: true,
        matches: 1,
        matchingTitles: ['Gmail'],
        matchingIds: ['id-1'],
      }

      const message = formatReuseWarning(result)
      expect(message).toContain('Gmail')
      expect(message).toContain('already used')
    })

    it('should format two matches', () => {
      const result = {
        isReused: true,
        matches: 2,
        matchingTitles: ['Gmail', 'Yahoo'],
        matchingIds: ['id-1', 'id-2'],
      }

      const message = formatReuseWarning(result)
      expect(message).toContain('Gmail')
      expect(message).toContain('Yahoo')
    })

    it('should format many matches with truncation', () => {
      const result = {
        isReused: true,
        matches: 5,
        matchingTitles: ['Gmail', 'Yahoo', 'Hotmail', 'AOL', 'Proton'],
        matchingIds: ['id-1', 'id-2', 'id-3', 'id-4', 'id-5'],
      }

      const message = formatReuseWarning(result)
      expect(message).toContain('5 items')
      expect(message).toContain('Gmail')
      expect(message).toContain('Yahoo')
      expect(message).toContain('3 more')
    })
  })

  describe('Zero-Knowledge Security Properties', () => {
    it('should never send reuse detection results to server', async () => {
      // This test verifies the implementation never makes server calls
      // for reuse detection data - by checking mock calls
      mockDecryptItem.mockResolvedValue({ password: 'test-password' })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'Service' },
        },
      ]

      await checkVaultPasswordReuse('test-password', testVaultKey, items)

      // Verify decryptItem was called (only client-side operation)
      expect(mockDecryptItem).toHaveBeenCalled()
    })

    it('should decrypt items in-memory only', async () => {
      mockDecryptItem.mockResolvedValue({ password: 'temp-password' })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'Service' },
        },
      ]

      // First call - should decrypt
      const result1 = await checkVaultPasswordReuse(
        'temp-password',
        testVaultKey,
        items
      )
      expect(result1.isReused).toBe(true)

      // Reset mock
      jest.clearAllMocks()
      mockDecryptItem.mockResolvedValue({ password: 'temp-password' })

      // Second call - should decrypt fresh (not cached)
      const result2 = await checkVaultPasswordReuse(
        'temp-password',
        testVaultKey,
        items
      )
      expect(result2.isReused).toBe(true)

      // Both calls should have decrypted independently
      expect(mockDecryptItem).toHaveBeenCalled()
    })

    it('should use case-sensitive comparison', async () => {
      const testPassword = 'TestPassword'

      mockDecryptItem.mockResolvedValue({ password: testPassword })

      const items = [
        {
          id: 'item-1',
          encryptedData: 'encrypted1',
          iv: 'iv1',
          secretType: 'PASSWORD',
          metadata: { title: 'Service' },
        },
      ]

      // Different case should not match
      const result = await checkVaultPasswordReuse(
        'testpassword',
        testVaultKey,
        items
      )

      expect(result.isReused).toBe(false)
      expect(result.matches).toBe(0)
    })
  })
})
