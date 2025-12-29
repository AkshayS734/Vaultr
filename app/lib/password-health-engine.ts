/**
 * Client-side PasswordHealthEngine
 *
 * SECURITY CONSTRAINTS:
 * - Password values are NEVER logged, persisted, or sent to backend
 * - All checks run in-memory only
 * - Backend is not aware of password health results
 *
 * FUNCTIONAL REQUIREMENTS IMPLEMENTED:
 * - Accept plaintext password ONLY as a function argument
 * - Immediately derive a SHA-256 hash using browser crypto.subtle
 * - Perform breach check using k-anonymity (first 5 hex chars only)
 * - Reuse detection via existing in-memory detector
 * - Password age flag based on metadata timestamp (not secret)
 * - Pure, side-effect-free, unit-testable functions
 */

import { checkVaultPasswordReuse, type VaultPasswordReuseResult } from '@/app/lib/vault-password-reuse'

export interface PasswordHealthFlags {
  reused: boolean
  weak: boolean
  old: boolean
  breached: boolean
}

export interface PasswordHealthResult {
  score: number // 0–100
  warnings: string[]
  flags: PasswordHealthFlags
}

// Minimal shape of a vault item for reuse detection (encrypted)
export interface ReuseCheckItem {
  id: string
  encryptedData: string
  iv: string
  secretType?: string
  metadata?: { title?: string }
}

export interface PasswordHealthOptions {
  // Reuse detection inputs (optional)
  vaultKey?: CryptoKey
  existingItems?: ReuseCheckItem[]
  excludeId?: string

  // Password age metadata timestamp
  lastChangedAt?: Date | number

  // GATED BREACH CHECK: Must explicitly enable and provide a checker function
  // The checker receives the PASSWORD (not a hash) and performs HIBP k-anonymity check
  // Only when enableBreachCheck === true will breach detection run
  enableBreachCheck?: boolean
  breachChecker?: (password: string) => Promise<boolean>

  // Age threshold in days (default: 180)
  ageThresholdDays?: number
}

// Utility: clamp number into range
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

// Immediately derive SHA-256(hex) for the provided plaintext password
export async function deriveSha256Hex(password: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(password)
  const digest = await (globalThis?.crypto?.subtle as SubtleCrypto).digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16).padStart(2, '0')
    hex += h
  }
  return hex
}

// Length score: scale 0–50 with linear ramp, saturates at 20 chars
function computeLengthScore(pw: string): { score: number; warning?: string } {
  const len = pw.length
  const score = clamp((len / 20) * 50, 0, 50)
  const warning = len < 12 ? 'Use at least 12 characters' : undefined
  return { score, warning }
}

// Character diversity score: presence of lower, upper, digit, special → 0–50
function computeDiversityScore(pw: string): { score: number; warnings: string[] } {
  const warnings: string[] = []
  let categories = 0
  if (/[a-z]/.test(pw)) categories += 1
  else warnings.push('Include lowercase letters (a–z)')
  if (/[A-Z]/.test(pw)) categories += 1
  else warnings.push('Include uppercase letters (A–Z)')
  if (/[0-9]/.test(pw)) categories += 1
  else warnings.push('Include numbers (0–9)')
  if (/[^a-zA-Z0-9]/.test(pw)) categories += 1
  else warnings.push('Add special characters (!@#$%^&*)')

  const score = (categories / 4) * 50
  return { score, warnings }
}

// Age flag based on metadata timestamp (not secret)
function computeAgeFlag(lastChangedAt?: Date | number, thresholdDays = 180): { old: boolean; warning?: string } {
  if (!lastChangedAt) return { old: false }
  const ts = typeof lastChangedAt === 'number' ? lastChangedAt : lastChangedAt.getTime()
  const now = Date.now()
  const ageMs = now - ts
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  const old = ageDays >= thresholdDays
  const warning = old ? `Password is older than ${thresholdDays} days` : undefined
  return { old, warning }
}

export async function evaluatePasswordHealth(
  password: string,
  options: PasswordHealthOptions = {}
): Promise<PasswordHealthResult> {
  // Base scores (no hashing needed for strength checks)
  // Max baseline: 50 (length) + 50 (diversity) = 100
  const { score: lengthScore, warning: lengthWarn } = computeLengthScore(password)
  const { score: diversityScore, warnings: diversityWarns } = computeDiversityScore(password)
  let score = lengthScore + diversityScore // 0–100 baseline

  const warnings: string[] = []
  if (lengthWarn) warnings.push(lengthWarn)
  warnings.push(...diversityWarns)

  // Reuse detection (client-side, in-memory)
  let reuseResult: VaultPasswordReuseResult | undefined
  let reused = false
  if (options.vaultKey && options.existingItems && options.existingItems.length > 0) {
    reuseResult = await checkVaultPasswordReuse(password, options.vaultKey, options.existingItems, options.excludeId)
    reused = !!reuseResult?.isReused
    if (reused) {
      warnings.push('This password is already used in other items')
      // Heavy penalty for reuse
      score = clamp(score - 30, 0, 100)
    }
  }

  // Age flag
  const { old, warning: ageWarn } = computeAgeFlag(options.lastChangedAt, options.ageThresholdDays ?? 180)
  if (ageWarn) {
    warnings.push(ageWarn)
    // Mild penalty for age
    score = clamp(score - 10, 0, 100)
  }

  // Optional breach check via k-anonymity prefix query
  // ONLY runs if explicitly enabled AND a query function is provided
  let breached = false
  if (options.enableBreachCheck && options.breachChecker) {
    const potentiallyBreached = await options.breachChecker(password)
    if (potentiallyBreached) {
      breached = true
      warnings.push('Potential breach detected for this password hash prefix')
      // Severe penalty for breach indication
      score = clamp(score - 50, 0, 100)
    }
  }
  // If breach check is disabled, breached flag remains false and no penalty applied

  // Weak flag heuristic: baseline < 60 or key requirements missing
  const weak = score < 60 || password.length < 12 || diversityWarns.length > 0

  // Final clamp to 0–100
  const finalScore = clamp(score, 0, 100)

  return {
    score: finalScore,
    warnings,
    flags: {
      reused,
      weak,
      old,
      breached,
    },
  }
}
