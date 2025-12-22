import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
export const redis = new Redis(redisUrl)

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number }

// rateLimit key: increments a counter with expiry windowMs
export async function rateLimit(key: string, windowMs: number, limit: number): Promise<RateLimitResult> {
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
}
