import Redis from 'ioredis'

let redisClient: Redis | null = null
let redisError: Error | null = null

/**
 * Lazy-initialize Redis connection only when needed.
 * Returns null if Redis is not configured or unavailable.
 * Errors are cached to prevent repeated connection attempts.
 */
function getRedisClient(): Redis | null {
  if (redisError) {
    return null // Previous init failed; don't retry
  }

  if (redisClient) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    redisError = new Error('REDIS_URL not configured')
    return null
  }

  try {
    redisClient = new Redis(redisUrl, {
      retryStrategy: () => null, // Fail fast on connection errors
      maxRetriesPerRequest: 1,
    })

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err.message)
      redisError = err
    })

    return redisClient
  } catch (err) {
    redisError = err instanceof Error ? err : new Error(String(err))
    return null
  }
}

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number }

/**
 * Rate limit using Redis.
 * If Redis is unavailable, returns allowed=false to fail closed (deny request).
 * This prevents rate-limit bypass if Redis is down.
 */
export async function rateLimit(key: string, windowMs: number, limit: number): Promise<RateLimitResult> {
  const redis = getRedisClient()
  
  if (!redis) {
    // Fail closed: if Redis is unavailable, reject the request
    console.warn(`Rate limit check failed for key "${key}": Redis unavailable`)
    return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs }
  }

  try {
    // Use INCR to increment count atomically
    const count = await redis.incr(key)
    if (count === 1) {
      // First increment — set expiry
      await redis.pexpire(key, windowMs)
    }

    const ttl = await redis.pttl(key)
    const remaining = Math.max(0, limit - count)
    const resetAt = Date.now() + (ttl > 0 ? ttl : 0)
    return { allowed: count <= limit, remaining, resetAt }
  } catch (err) {
    console.error('Rate limit check failed:', err)
    // Fail closed on error
    return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs }
  }
}

