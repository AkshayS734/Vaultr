/**
 * Password Strength Evaluation Module
 * 
 * NIST SP 800-63B alignment: single source of truth for password quality checks
 * (length >=12, common password denylist, identifier checks, entropy-based assessment).
 * This module provides a single source of truth for password strength validation
 * across Vaultr without external dependencies.
 * 
 * SECURITY NOTES:
 * - This runs on both client and server. Server is authoritative.
 * - Passwords are NEVER logged or stored by this module.
 * - Results are deterministic and depend only on the password and optional context.
 * - No async calls; no external APIs.
 */

// Common weak passwords and patterns to reject
const COMMON_PASSWORDS = new Set([
  'password', '123456', 'qwerty', 'abc123', 'password123', 'admin', 'letmein',
  'welcome', 'monkey', 'dragon', 'master', 'sunshine', 'princess', 'shadow',
  '123123', '654321', 'superman', 'iloveyou', '000000', '111111', 'trustno1',
  'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '123456789', '1234567890', 'pass123',
  'pass', '123', 'test123', 'test', 'admin123',
])

// Obvious keyboard patterns
const KEYBOARD_PATTERNS = [
  'qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', 'qweasd', 'asdzxc', '1234567890',
  'abcdefgh', 'abcdefghij', 'qwertyuiop', 'qwertyu', 'asdfghjkl', 'zxcvbnm',
]

// Repeating character patterns (aaa, 1111, etc.)
function hasRepeatingPattern(password: string): boolean {
  return /(.)\1{2,}/.test(password)
}

// Sequential patterns (abc, 123, etc.)
function hasSequentialPattern(password: string): boolean {
  for (let i = 0; i < password.length - 2; i++) {
    const c1 = password.charCodeAt(i)
    const c2 = password.charCodeAt(i + 1)
    const c3 = password.charCodeAt(i + 2)

    // Check if three consecutive characters are sequential
    if (c2 === c1 + 1 && c3 === c1 + 2) return true
    if (c2 === c1 - 1 && c3 === c1 - 2) return true
  }
  return false
}

// Check if password contains user's email (local part)
function containsEmailPart(password: string, email?: string): boolean {
  if (!email) return false

  const normalized = password.toLowerCase()
  const emailParts = email.toLowerCase().split('@')
  const localPart = emailParts[0]

  if (localPart.length < 3) return false
  return normalized.includes(localPart)
}

// Shannon entropy calculation (bits per character)
function calculateEntropy(password: string): number {
  // Estimate alphabet size based on character types
  let alphabetSize = 0
  if (/[a-z]/.test(password)) alphabetSize += 26
  if (/[A-Z]/.test(password)) alphabetSize += 26
  if (/[0-9]/.test(password)) alphabetSize += 10
  if (/[^a-zA-Z0-9]/.test(password)) alphabetSize += 32 // ~32 common special chars

  if (alphabetSize === 0) return 0

  // Entropy = length * log2(alphabet_size)
  const entropy = password.length * Math.log2(alphabetSize)
  return entropy
}

export interface PasswordStrengthResult {
  /**
   * Numeric score: 0 (very weak) to 5 (very strong)
   * 0-1: Very Weak, 1-2: Weak, 2-3: Fair, 3-4: Good, 4-5: Strong
   */
  score: number

  /**
   * Whether password meets minimum requirements
   * Required: score >= 3, all checks pass
   */
  isStrong: boolean

  /**
   * Array of requirement explanations
   * Show unmet requirements to users
   */
  feedback: string[]

  /**
   * Estimated entropy in bits
   * For informational purposes only; score is the authoritative measure
   */
  entropy: number
}

/**
 * Check password strength against modern security standards.
 *
 * Requirements for a strong password:
 * - Minimum 12 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character
 * - Not a common password
 * - No obvious patterns (repeating, sequential)
 * - No email address embedded
 * - Sufficient entropy (50+ bits)
 *
 * @param password - The password to check
 * @param context - Optional context for validation (e.g., user's email)
 * @returns PasswordStrengthResult with score, feedback, and strength status
 */
export function checkPasswordStrength(
  password: string,
  context?: { email?: string }
): PasswordStrengthResult {
  const feedback: string[] = []
  let score = 0

  // Check minimum length
  if (password.length < 12) {
    feedback.push('Use at least 12 characters')
  } else {
    score += 1.0
  }

  // Check for uppercase
  if (!/[A-Z]/.test(password)) {
    feedback.push('Include uppercase letters (A-Z)')
  } else {
    score += 0.75
  }

  // Check for lowercase
  if (!/[a-z]/.test(password)) {
    feedback.push('Include lowercase letters (a-z)')
  } else {
    score += 0.75
  }

  // Check for digits
  if (!/[0-9]/.test(password)) {
    feedback.push('Include numbers (0-9)')
  } else {
    score += 0.75
  }

  // Check for special characters
  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Add special characters (!@#$%^&*)')
  } else {
    score += 0.75
  }

  // Check for common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    feedback.push('Avoid common passwords')
    score = Math.max(0, score - 2) // Penalize heavily
  }

  // Check for keyboard patterns
  for (const pattern of KEYBOARD_PATTERNS) {
    if (password.toLowerCase().includes(pattern)) {
      feedback.push('Avoid keyboard patterns (qwerty, asdf, etc.)')
      score = Math.max(0, score - 1)
      break
    }
  }

  // Check for repeating characters
  if (hasRepeatingPattern(password)) {
    feedback.push('Avoid repeating characters (aaa, 111, etc.)')
    score = Math.max(0, score - 0.5)
  }

  // Check for sequential characters
  if (hasSequentialPattern(password)) {
    feedback.push('Avoid sequential characters (abc, 123, etc.)')
    score = Math.max(0, score - 0.5)
  }

  // Check if contains email
  if (containsEmailPart(password, context?.email)) {
    feedback.push('Do not use parts of your email address')
    score = Math.max(0, score - 1)
  }

  // Calculate entropy
  const entropy = calculateEntropy(password)

  // Entropy check: minimum 50 bits recommended for security
  if (entropy < 50) {
    feedback.push('Password needs more variation or length for sufficient entropy')
    // Only penalize if entropy is very low
    if (entropy < 30) {
      score = Math.max(0, score - 1)
    }
  } else {
    // Bonus for good entropy
    score = Math.min(5, score + 1.0)
  }

  // Clamp score to 0-5 range
  const finalScore = Math.max(0, Math.min(5, score))

  // Strong password: score >= 3 and no critical failures
  const isStrong = finalScore >= 3 && feedback.length === 0

  return {
    score: finalScore,
    isStrong,
    feedback,
    entropy,
  }
}

/**
 * Get human-readable strength label
 */
export function getStrengthLabel(score: number): string {
  if (score >= 4.5) return 'Very Strong'
  if (score >= 3.5) return 'Strong'
  if (score >= 2.5) return 'Fair'
  if (score >= 1.5) return 'Weak'
  return 'Very Weak'
}

/**
 * Get color class for UI display
 */
export function getStrengthColor(score: number): string {
  if (score >= 4.5) return 'bg-green-600'
  if (score >= 3.5) return 'bg-green-500'
  if (score >= 2.5) return 'bg-yellow-500'
  if (score >= 1.5) return 'bg-orange-500'
  return 'bg-red-500'
}
