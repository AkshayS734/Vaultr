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
  'SMTP_HOST',            // Email server configuration
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_SECURE',
]

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
