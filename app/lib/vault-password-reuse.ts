/**
 * @file app/lib/vault-password-reuse.ts
 *
 * Client-side ONLY vault password reuse detection.
 * This utility operates entirely in-memory with decrypted items.
 * It MUST NOT:
 * - Hash or fingerprint passwords
 * - Persist results to storage or database
 * - Send reuse information to the server
 * - Log detailed password information
 *
 * It implements a zero-knowledge security model where the server
 * never learns about password reuse patterns.
 */

import { decryptItem } from './crypto'

/**
 * Result of vault password reuse detection.
 * All information is derived from in-memory decryption only.
 */
export interface VaultPasswordReuseResult {
  isReused: boolean
  matches: number
  matchingTitles: string[]
  matchingIds: string[]
}

/**
 * Minimal item shape needed for reuse detection.
 * Only works with decrypted password secret types.
 */
interface VaultItem {
  id: string
  encryptedData: string
  iv: string
  secretType?: string
  metadata?: {
    title?: string
  }
}

/**
 * Check if a vault password is already used in other items.
 *
 * Algorithm:
 * 1. Accept the new password (plaintext in memory)
 * 2. Accept list of existing vault items (encrypted)
 * 3. Decrypt each item and extract the password field
 * 4. Compare new password against decrypted passwords
 * 5. Return match results (titles and IDs only)
 *
 * Security properties:
 * - NEW password is never stored, hashed, or sent anywhere
 * - Comparison happens entirely in-memory
 * - Only metadata (titles) is returned, never the actual passwords
 * - Server has no knowledge of reuse patterns
 * - Result is transient and not persisted
 *
 * @param newPassword The plaintext password to check (from form input)
 * @param vaultKey The CryptoKey for decryption (AES-256-GCM)
 * @param existingItems Array of encrypted vault items to compare against
 * @param excludeId Optional item ID to skip (for edit scenarios)
 * @returns Reuse detection result with match count and affected item titles
 */
export async function checkVaultPasswordReuse(
  newPassword: string,
  vaultKey: CryptoKey,
  existingItems: VaultItem[],
  excludeId?: string
): Promise<VaultPasswordReuseResult> {
  const matchingTitles: string[] = []
  const matchingIds: string[] = []

  try {
    // Iterate through items, decrypt, and check for password match
    for (const item of existingItems) {
      // Skip the item being edited (if provided)
      if (excludeId && item.id === excludeId) {
        continue
      }

      // Only check password type secrets
      // (Skip API keys, env vars, etc.)
      if (item.secretType && item.secretType !== 'PASSWORD') {
        continue
      }

      try {
        // Decrypt the item in-memory
        const decrypted = await decryptItem<Record<string, unknown>>(
          item.encryptedData,
          item.iv,
          vaultKey
        )

        // Extract the password field
        const existingPassword = decrypted?.password
        if (typeof existingPassword !== 'string') {
          continue
        }

        // Compare passwords
        if (existingPassword === newPassword) {
          const title =
            typeof item.metadata?.title === 'string'
              ? item.metadata.title
              : item.id

          matchingTitles.push(title)
          matchingIds.push(item.id)
        }
      } catch {
        // Decryption failed for this item
        // Skip and continue (corrupted or wrong key)
        continue
      }
    }
  } catch {
    // If any unexpected error, return empty result
    // Better to be silent than to block user action
    return {
      isReused: false,
      matches: 0,
      matchingTitles: [],
      matchingIds: [],
    }
  }

  return {
    isReused: matchingIds.length > 0,
    matches: matchingIds.length,
    matchingTitles,
    matchingIds,
  }
}

/**
 * Format reuse detection result for user display.
 * Returns a user-friendly message about password reuse.
 *
 * @param result Reuse detection result
 * @returns Human-readable message about reuse
 */
export function formatReuseWarning(result: VaultPasswordReuseResult): string {
  if (!result.isReused) {
    return ''
  }

  if (result.matches === 1) {
    return `This password is already used in: ${result.matchingTitles[0]}`
  }

  const titles = result.matchingTitles.slice(0, 2).join(', ')
  const remaining = result.matches - 2

  if (remaining > 0) {
    return `This password is used in ${result.matches} items: ${titles}, and ${remaining} more`
  }

  return `This password is used in: ${titles}`
}
