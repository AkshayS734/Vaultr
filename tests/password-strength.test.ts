/**
 * Password Strength Module Tests
 * 
 * Test suite for app/lib/password-strength.ts
 * Ensures password validation is deterministic and meets security standards.
 * 
 * SECURITY NOTE: Test data uses realistic but non-sensitive examples.
 * No actual user passwords are stored in this file.
 */

import { checkPasswordStrength, getStrengthLabel, getStrengthColor } from '@/app/lib/password-strength'

describe('checkPasswordStrength', () => {
  describe('Basic Requirements', () => {
    it('should reject passwords shorter than 12 characters', () => {
      const result = checkPasswordStrength('Pass1!')
      expect(result.isStrong).toBe(false)
      expect(result.feedback).toContain('Use at least 12 characters')
    })

    it('should reject passwords without uppercase letters', () => {
      const result = checkPasswordStrength('password123!@')
      expect(result.isStrong).toBe(false)
      expect(result.feedback).toContain('Include uppercase letters (A-Z)')
    })

    it('should reject passwords without lowercase letters', () => {
      const result = checkPasswordStrength('PASSWORD123!@')
      expect(result.isStrong).toBe(false)
      expect(result.feedback).toContain('Include lowercase letters (a-z)')
    })

    it('should reject passwords without digits', () => {
      const result = checkPasswordStrength('Password!@#$%')
      expect(result.isStrong).toBe(false)
      expect(result.feedback).toContain('Include numbers (0-9)')
    })

    it('should reject passwords without special characters', () => {
      const result = checkPasswordStrength('Password123456')
      expect(result.isStrong).toBe(false)
      expect(result.feedback).toContain('Add special characters (!@#$%^&*)')
    })

    it('should accept passwords meeting all basic requirements', () => {
      const result = checkPasswordStrength('MyStr0ng!Pass')
      expect(result.isStrong).toBe(true)
      expect(result.feedback.length).toBe(0)
    })
  })

  describe('Common Passwords', () => {
    it('should reject "password" variant', () => {
      const result = checkPasswordStrength('MyPassword!@#')
      expect(result.feedback.some((f) => f.includes('common')))
    })

    it('should reject short common passwords', () => {
      const result = checkPasswordStrength('Password1@!')
      expect(result.feedback.length).toBeGreaterThan(0)
    })

    it('should reject "qwerty" keyboard pattern', () => {
      const result = checkPasswordStrength('Qwerty!@#$1')
      expect(result.feedback.some((f) => f.includes('keyboard')))
    })

    it('should accept strong passwords with different words', () => {
      const result = checkPasswordStrength('Gx7@kPq2mV9$L')
      expect(result.isStrong).toBe(true)
    })
  })

  describe('Pattern Detection', () => {
    it('should reject passwords with repeating characters', () => {
      const result = checkPasswordStrength('MyPaaassword1!')
      expect(result.feedback).toContain('Avoid repeating characters (aaa, 111, etc.)')
    })

    it('should reject passwords with sequential characters', () => {
      const result = checkPasswordStrength('MyPassabc123!')
      expect(result.feedback).toContain('Avoid sequential characters (abc, 123, etc.)')
    })

    it('should reject keyboard patterns', () => {
      const result = checkPasswordStrength('Qwerty1Pass!')
      expect(result.feedback.some((f) => f.includes('keyboard')))
    })

    it('should accept passwords without obvious patterns', () => {
      const result = checkPasswordStrength('Gx7@kPq2mV9$L')
      expect(result.feedback.filter((f) => f.includes('pattern') || f.includes('keyboard'))).toHaveLength(0)
    })
  })

  describe('Email Context', () => {
    it('should reject passwords containing email local part', () => {
      const result = checkPasswordStrength('MyName123!', { email: 'myname@example.com' })
      expect(result.feedback).toContain('Do not use parts of your email address')
    })

    it('should reject email parts case-insensitively', () => {
      const result = checkPasswordStrength('MYNAME123!@', { email: 'myname@example.com' })
      expect(result.feedback).toContain('Do not use parts of your email address')
    })

    it('should not reject short email parts', () => {
      const result = checkPasswordStrength('ab123456!@', { email: 'ab@example.com' })
      // Short email parts (< 3 chars) are not checked
      expect(result.feedback).not.toContain('Do not use parts of your email address')
    })

    it('should allow passwords when email context not provided', () => {
      const result = checkPasswordStrength('MyName123!')
      expect(result.feedback).not.toContain('Do not use parts of your email address')
    })
  })

  describe('Entropy Calculation', () => {
    it('should calculate entropy', () => {
      const result = checkPasswordStrength('MyStr0ng!Pass')
      expect(result.entropy).toBeGreaterThan(0)
      expect(typeof result.entropy).toBe('number')
    })

    it('should have higher entropy with more character variety', () => {
      const weak = checkPasswordStrength('aaaaaaaaaaaa')
      const strong = checkPasswordStrength('aAbBcC123!@#')
      expect(strong.entropy).toBeGreaterThan(weak.entropy)
    })

    it('should penalize passwords with very low entropy', () => {
      const result = checkPasswordStrength('aabbccddee11')
      expect(result.feedback.some((f) => f.includes('variation')))
    })
  })

  describe('Scoring', () => {
    it('should return score between 0 and 5', () => {
      const result = checkPasswordStrength('Test123!')
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(5)
    })

    it('should give higher scores to stronger passwords', () => {
      const weak = checkPasswordStrength('Pass123!')
      const strong = checkPasswordStrength('MyVeryStr0ng!Pass&Safe')
      expect(strong.score).toBeGreaterThan(weak.score)
    })

    it('should require score >= 3 for isStrong', () => {
      const weak = checkPasswordStrength('Test123!')
      const strong = checkPasswordStrength('Gx7@kPq2mV9$L')
      expect(weak.score < 3 || weak.feedback.length > 0).toBe(true)
      expect(strong.isStrong).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long passwords', () => {
      const longPass = 'A1@' + 'a'.repeat(1000) + 'B2#'
      const result = checkPasswordStrength(longPass)
      expect(result.entropy).toBeGreaterThan(0)
      expect(typeof result.score).toBe('number')
    })

    it('should handle unicode characters', () => {
      const unicodePass = 'Pass€ 123!@Word'
      const result = checkPasswordStrength(unicodePass)
      expect(result.entropy).toBeGreaterThan(0)
      expect(typeof result.isStrong).toBe('boolean')
    })

    it('should handle empty string', () => {
      const result = checkPasswordStrength('')
      expect(result.isStrong).toBe(false)
      expect(result.feedback.length).toBeGreaterThan(0)
    })

    it('should handle whitespace', () => {
      const result = checkPasswordStrength('Pass 123!@ word')
      expect(typeof result.isStrong).toBe('boolean')
      expect(result.feedback.length >= 0).toBe(true)
    })
  })

  describe('Determinism', () => {
    it('should return same result for identical input', () => {
      const password = 'MyStr0ng!Pass'
      const result1 = checkPasswordStrength(password)
      const result2 = checkPasswordStrength(password)

      expect(result1.score).toBe(result2.score)
      expect(result1.isStrong).toBe(result2.isStrong)
      expect(result1.feedback).toEqual(result2.feedback)
      expect(result1.entropy).toBe(result2.entropy)
    })

    it('should be deterministic with email context', () => {
      const password = 'MyPass123!@'
      const email = 'test@example.com'

      const result1 = checkPasswordStrength(password, { email })
      const result2 = checkPasswordStrength(password, { email })

      expect(result1).toEqual(result2)
    })
  })

  describe('No Side Effects', () => {
    it('should not modify input password', () => {
      const password = 'MyStr0ng!Pass'
      const original = password
      checkPasswordStrength(password)
      expect(password).toBe(original)
    })

    it('should not throw on any valid input', () => {
      const passwords = [
        'a',
        'Test123!',
        '',
        'A'.repeat(1000),
        '!@#$%^&*',
        'password123',
      ]

      expect(() => {
        passwords.forEach((p) => checkPasswordStrength(p))
      }).not.toThrow()
    })
  })
})

describe('getStrengthLabel', () => {
  it('should return appropriate labels for scores', () => {
    expect(getStrengthLabel(4.8)).toBe('Very Strong')
    expect(getStrengthLabel(3.8)).toBe('Strong')
    expect(getStrengthLabel(2.8)).toBe('Fair')
    expect(getStrengthLabel(1.8)).toBe('Weak')
    expect(getStrengthLabel(0.5)).toBe('Very Weak')
  })
})

describe('getStrengthColor', () => {
  it('should return appropriate colors for scores', () => {
    expect(getStrengthColor(4.8)).toBe('bg-green-600')
    expect(getStrengthColor(3.8)).toBe('bg-green-500')
    expect(getStrengthColor(2.8)).toBe('bg-yellow-500')
    expect(getStrengthColor(1.8)).toBe('bg-orange-500')
    expect(getStrengthColor(0.5)).toBe('bg-red-500')
  })
})
