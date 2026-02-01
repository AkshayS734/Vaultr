/**
 * Rate limiting configuration for vault operations
 * Prevents abuse and DoS attacks on password/vault endpoints
 */

export const VAULT_RATE_LIMITS = {
  // Password CRUD operations - 100 requests per 5 minutes per user
  passwords: {
    max: 100,
    windowMs: 5 * 60 * 1000, // 5 minutes
    keyPrefix: 'rl:passwords',
  },
  
  // Vault key operations - 50 requests per 5 minutes per user
  vault: {
    max: 50,
    windowMs: 5 * 60 * 1000, // 5 minutes
    keyPrefix: 'rl:vault',
  },
  
  // Breach check operations - 10 requests per minute per IP
  // Lower limit to prevent HIBP API abuse
  breach: {
    max: 10,
    windowMs: 1 * 60 * 1000, // 1 minute
    keyPrefix: 'rl:breach',
  },
} as const

export type RateLimitType = keyof typeof VAULT_RATE_LIMITS
