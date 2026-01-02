/**
 * Item 4.6: Client-side breach check hook for vault passwords
 * 
 * SECURITY INVARIANTS:
 * - Uses HIBP k-anonymity check (5-char prefix only sent to server)
 * - Advisory only: warns user but doesn't block password save
 * - Plaintext password never logged or persisted
 * - Runs on password change (client-side only)
 * - Graceful degradation: If breach check fails, allow save anyway (fail-open)
 */

'use client'

import { useState, useCallback } from 'react'
import { checkPasswordBreach } from '@/app/lib/password-breach'

export interface BreachCheckResult {
  isBreached: boolean
  isChecking: boolean
  error: string | null
}

/**
 * Hook for checking if a password appears in HIBP breach database
 * Usage: const { isBreached, isChecking } = useBreachCheck()
 *        await checkPassword(password)
 */
export function useBreachCheck() {
  const [isBreached, setIsBreached] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkPassword = useCallback(async (password: string): Promise<BreachCheckResult> => {
    // Skip empty passwords
    if (!password || password.length === 0) {
      setIsBreached(false)
      setError(null)
      return { isBreached: false, isChecking: false, error: null }
    }

    setIsChecking(true)
    setError(null)

    try {
      // Check against HIBP using k-anonymity
      const breached = await checkPasswordBreach(password, '/api/breach')
      setIsBreached(breached)

      return {
        isBreached: breached,
        isChecking: false,
        error: null,
      }
    } catch (err) {
      // Fail-open: error during check, allow user to proceed
      console.warn('[BREACH_CHECK] Error during breach check:', err)
      setError('Unable to check breach status')
      setIsBreached(false)

      return {
        isBreached: false,
        isChecking: false,
        error: 'Breach check unavailable',
      }
    } finally {
      setIsChecking(false)
    }
  }, [])

  return {
    isBreached,
    isChecking,
    error,
    checkPassword,
  }
}

/**
 * Get user-friendly warning message for breached password
 */
export function getBreachWarning(isBreached: boolean): string {
  if (!isBreached) return ''
  return 'This password has appeared in known security breaches. We recommend using a unique password instead.'
}
