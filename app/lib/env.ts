/**
 * Validate required environment variables at startup
 * Fails fast if critical config is missing
 */

const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
]

const optionalEnvVars = [
  'REDIS_URL',
  'NODE_ENV',
  'NEXT_PUBLIC_BASE_URL', // For email verification links
  'NEXT_PUBLIC_BREACH_ENDPOINT', // Client-only breach check endpoint (k-anonymity)
  'BREACH_UPSTREAM_URL', // Server-side upstream for /api/breach proxy (prefix-only)
  'SMTP_HOST',            // Email server configuration
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_SECURE',
]

/**
 * Validate JWT_SECRET has minimum entropy (32 bytes = 256 bits)
 * OWASP recommendation for cryptographic keys
 */
function validateJwtSecret(): void {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    return // Already checked in requiredEnvVars
  }

  // Check minimum length: 32 bytes base64-decoded
  // Base64 string of 32 bytes = ~43 characters (32 * 4/3)
  // For raw hex: 64 characters (32 bytes * 2)
  if (jwtSecret.length < 32) {
    console.error('  FATAL: JWT_SECRET is too weak')
    console.error('  JWT_SECRET must be at least 32 bytes (256 bits)')
    console.error('  Recommendation: Generate with: openssl rand -base64 32')
    console.error(`  Current length: ${jwtSecret.length} characters`)
    process.exit(1)
  }

  // Warn if all same character (extremely low entropy)
  const uniqueChars = new Set(jwtSecret)
  if (uniqueChars.size === 1) {
    console.warn('  ⚠️  WARNING: JWT_SECRET has extremely low entropy (all same character)')
    console.warn('  Recommendation: Regenerate with: openssl rand -base64 32')
  } else if (uniqueChars.size < 5) {
    console.warn('  ⚠️  WARNING: JWT_SECRET has low entropy (very few unique characters)')
    console.warn('  Recommendation: Regenerate with: openssl rand -base64 32')
  }
}

export function validateEnvironment(): void {
  const missing: string[] = []

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }

  if (missing.length > 0) {
    console.error(
      '  FATAL: Missing required environment variables:',
      missing.join(', ')
    )
    console.error('Please set the following variables before running the application:')
    missing.forEach((v) => {
      console.error(`  - ${v}`)
    })
    process.exit(1)
  }

  // Validate JWT_SECRET entropy
  validateJwtSecret()

  // Log optional vars status
  const unavailable = optionalEnvVars.filter((v) => !process.env[v])
  if (unavailable.length > 0) {
    console.warn(
      '⚠️  Optional environment variables not set:',
      unavailable.join(', ')
    )
  }

  console.log('✅ Environment validation passed')
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if Redis is configured
 */
export function hasRedis(): boolean {
  return !!process.env.REDIS_URL
}

/**
 * Check if email is configured
 */
export function hasEmail(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true // In development, we log emails instead of sending
  }
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  )
}
