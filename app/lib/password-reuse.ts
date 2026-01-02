/**
 * Password reuse detection utilities for Vaultr
 * 
 * SECURITY ARCHITECTURE:
 * - Compares new password against existing hashes using argon2.verify()
 * - Stores only password hashes (never plaintext)
 * - Limits history to last 5 passwords per user
 * - Uses constant-time comparison for security
 * - Returns warnings, never blocks authentication
 * 
 * SCOPE LIMITATION (CRITICAL):
 * ============================
 * This module is ONLY for ACCOUNT AUTHENTICATION PASSWORDS.
 * 
 * ✅ USE FOR:
 * - Account login/master password changes (/api/auth/change-password)
 * - Account password resets (/api/auth/reset-password)
 * - Where server has legitimate plaintext access (during auth flow)
 * 
 * ❌ NEVER USE FOR:
 * - Vault item passwords (stored in Item.encryptedData)
 * - API keys stored in vault
 * - Environment variable secrets
 * - Any encrypted secrets (server is blind to these)
 * 
 * WHY THIS SEPARATION EXISTS:
 * - Account passwords: Server-verified (argon2 hash), reuse detection possible
 * - Vault passwords: Zero-knowledge encrypted (AES-GCM), server cannot decrypt
 * 
 * For vault password reuse detection, implement CLIENT-SIDE ONLY warnings.
 * See: docs/security/VAULT_PASSWORD_SECURITY_SUMMARY.md
 */

import argon2 from 'argon2'
import { prisma } from './prisma'

// Maximum number of previous passwords to track
const PASSWORD_HISTORY_LIMIT = 5

/**
 * Check if a password has been used before by the same user
 * 
 * @param userId - User ID to check against
 * @param newPassword - Plain text password to check
 * @returns Object with warning if reuse detected
 */
export async function checkPasswordReuse(
  userId: string,
  newPassword: string
): Promise<{ warning?: string; recommendation?: string }> {
  try {
    // Get current password hash and any stored history
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { authHash: true }
    })

    if (!user) {
      return {}
    }

    // Check against current password hash
    const isCurrentPassword = await argon2.verify(user.authHash, newPassword)
    if (isCurrentPassword) {
      return {
        warning: 'You are currently using this password',
        recommendation: 'Choose a different password to improve account security.'
      }
    }

    // Check against password history
    const historyReuse = await checkPasswordHistory(userId, newPassword)
    if (historyReuse.warning) {
      return historyReuse
    }

    return {}
  } catch (error) {
    console.error('Password reuse check failed:', error)
    // Fail open - don't block password changes if check fails
    return {}
  }
}

/**
 * Check password against stored history
 * 
 * @param userId - User ID
 * @param newPassword - Plain text password to check
 * @returns Object with warning if reuse detected in history
 */
async function checkPasswordHistory(
  userId: string,
  newPassword: string
): Promise<{ warning?: string; recommendation?: string }> {
  try {
    // Get last 5 password hashes for this user
    const passwordHistory = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_LIMIT,
      select: { passwordHash: true, createdAt: true }
    })

    // Check new password against each historical hash
    for (const entry of passwordHistory) {
      const isReused = await argon2.verify(entry.passwordHash, newPassword)
      if (isReused) {
        return {
          warning: 'You have used this password before',
          recommendation: 'Reusing passwords increases security risk. Consider choosing a unique password.'
        }
      }
    }

    return {}
  } catch (error) {
    console.error('Password history check failed:', error)
    // Fail open - don't block password changes if check fails
    return {}
  }
}

/**
 * Store password hash in history
 * 
 * @param userId - User ID
 * @param oldPasswordHash - Hash of the password being replaced
 */
export async function storePasswordInHistory(
  userId: string,
  oldPasswordHash: string
): Promise<void> {
  try {
    // Add old password to history
    await prisma.passwordHistory.create({
      data: {
        userId,
        passwordHash: oldPasswordHash,
      }
    })

    // Clean up old entries to maintain limit
    await cleanupPasswordHistory(userId)
  } catch (error) {
    console.error('[ERR_PASSWORD_HISTORY]', error instanceof Error ? error.message : String(error))
    // Don't fail the password change if history storage fails
  }
}

/**
 * Clean up old password history entries to maintain limit
 * 
 * @param userId - User ID
 */
export async function cleanupPasswordHistory(userId: string): Promise<void> {
  try {
    // Get all password history entries for this user, ordered by creation date
    const allEntries = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    })

    // If we have more than the limit, delete the oldest ones
    if (allEntries.length > PASSWORD_HISTORY_LIMIT) {
      const entriesToDelete = allEntries.slice(PASSWORD_HISTORY_LIMIT)
      
      await prisma.passwordHistory.deleteMany({
        where: {
          id: { in: entriesToDelete.map((entry) => entry.id) }
        }
      })
    }
  } catch (error) {
    console.error('Failed to cleanup password history:', error)
    // Don't fail the password change if cleanup fails
  }
}