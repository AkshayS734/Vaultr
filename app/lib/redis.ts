    import Redis from 'ioredis'

    let redisClient: Redis | null = null
    let lastOutageLogAt = 0
    const OUTAGE_LOG_INTERVAL_MS = 60_000

    // In-memory fallback rate limiter (used when Redis is unavailable)
    // Key: rate limit key, Value: { count, expiresAt }
    const inMemoryRateLimiter = new Map<string, { count: number; expiresAt: number }>()

    /**
     * Cleanup expired in-memory rate limit entries (runs periodically)
     * Prevents memory leak from accumulating old keys
     */
    function cleanupExpiredRateLimits() {
      const now = Date.now()
      for (const [key, value] of inMemoryRateLimiter.entries()) {
        if (value.expiresAt < now) {
          inMemoryRateLimiter.delete(key)
        }
      }
    }

    // Run cleanup every 60 seconds
    setInterval(cleanupExpiredRateLimits, 60 * 1000)

    /**
    * Get a shared Redis client. Creates once and reuses.
    * Allows ioredis to handle reconnection automatically.
    */
    function getRedisClient(): Redis | null {
      if (redisClient) return redisClient

      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) return null

      try {
        const client = new Redis(redisUrl, {
          // Use ioredis defaults for reconnection; keep requests lightweight
          maxRetriesPerRequest: 3,
          // Enable ready check to avoid sending commands too early
          enableReadyCheck: true,
        })

        client.on('error', (err) => {
          const now = Date.now()
          if (now - lastOutageLogAt > OUTAGE_LOG_INTERVAL_MS) {
            // Throttled outage log
            console.warn('[redis] outage or error:', err?.message ?? String(err))
            lastOutageLogAt = now
          }
        })

        redisClient = client
        return redisClient
      } catch (err) {
        const now = Date.now()
        if (now - lastOutageLogAt > OUTAGE_LOG_INTERVAL_MS) {
          console.warn('[redis] init failed:', err instanceof Error ? err.message : String(err))
          lastOutageLogAt = now
        }
        return null
      }
    }

    export type RateLimitInfo = { allowed: boolean; remaining: number; resetAt: number }

    /**
    * Read-only rate limit check. Does not increment counters.
    * Uses Redis if available, falls back to in-memory limiter.
    */
    export async function checkRateLimit(key: string, windowMs: number, limit: number): Promise<RateLimitInfo> {
      const redis = getRedisClient()
      
      // Try Redis first
      if (redis && redis.status === 'ready') {
        try {
          const [countStr, ttl] = await Promise.all([
            redis.get(key),
            redis.pttl(key),
          ])
          const count = countStr ? parseInt(countStr, 10) : 0
          const remaining = Math.max(0, limit - count)
          const resetAt = ttl > 0 ? Date.now() + ttl : Date.now() + windowMs
          return { allowed: count < limit, remaining, resetAt }
        } catch (err) {
          const now = Date.now()
          if (now - lastOutageLogAt > OUTAGE_LOG_INTERVAL_MS) {
            console.warn('[redis] checkRateLimit error, falling back to in-memory:', err instanceof Error ? err.message : String(err))
            lastOutageLogAt = now
          }
        }
      }

      // Fallback to in-memory rate limiter
      const now = Date.now()
      const entry = inMemoryRateLimiter.get(key)
      
      if (!entry || entry.expiresAt < now) {
        // No entry or expired, allow and return new limit
        return { allowed: true, remaining: limit, resetAt: now + windowMs }
      }
      
      const count = entry.count
      const remaining = Math.max(0, limit - count)
      return { allowed: count < limit, remaining, resetAt: entry.expiresAt }
    }

    /**
    * Consume a rate limit token (increment) on failure only.
    * Sets the window expiry when creating the counter.
    * Uses Redis if available, falls back to in-memory limiter.
    */
    export async function consumeRateLimit(key: string, windowMs: number): Promise<void> {
      const redis = getRedisClient()
      
      // Try Redis first
      if (redis && redis.status === 'ready') {
        try {
          const count = await redis.incr(key)
          if (count === 1) {
            await redis.pexpire(key, windowMs)
          }
          return
        } catch (err) {
          const now = Date.now()
          if (now - lastOutageLogAt > OUTAGE_LOG_INTERVAL_MS) {
            console.warn('[redis] consumeRateLimit error, falling back to in-memory:', err instanceof Error ? err.message : String(err))
            lastOutageLogAt = now
          }
        }
      }

      // Fallback to in-memory rate limiter
      const now = Date.now()
      const entry = inMemoryRateLimiter.get(key)
      
      if (!entry || entry.expiresAt < now) {
        // Create new entry
        inMemoryRateLimiter.set(key, { count: 1, expiresAt: now + windowMs })
      } else {
        // Increment existing entry
        entry.count++
      }
    }

    /**
    * Legacy combined rateLimit helper used by existing routes.
    * Performs INCR and returns allowance info. 
    * Uses Redis if available, falls back to in-memory limiter.
    */
    export async function rateLimit(key: string, windowMs: number, limit: number): Promise<RateLimitInfo> {
      const redis = getRedisClient()
      
      // Try Redis first
      if (redis && redis.status === 'ready') {
        try {
          const count = await redis.incr(key)
          if (count === 1) {
            await redis.pexpire(key, windowMs)
          }
          const ttl = await redis.pttl(key)
          const remaining = Math.max(0, limit - count)
          const resetAt =
            ttl > 0
              ? Date.now() + ttl
              : ttl === -1
                ? Date.now() + windowMs
                : Date.now() + windowMs
          return { allowed: count < limit, remaining, resetAt }
        } catch (err) {
          const now = Date.now()
          if (now - lastOutageLogAt > OUTAGE_LOG_INTERVAL_MS) {
            console.warn('[redis] rateLimit error, falling back to in-memory:', err instanceof Error ? err.message : String(err))
            lastOutageLogAt = now
          }
        }
      }

      // Fallback to in-memory rate limiter
      const now = Date.now()
      let entry = inMemoryRateLimiter.get(key)
      
      if (!entry || entry.expiresAt < now) {
        // Create new entry
        entry = { count: 1, expiresAt: now + windowMs }
        inMemoryRateLimiter.set(key, entry)
      } else {
        // Increment existing entry
        entry.count++
      }
      
      const remaining = Math.max(0, limit - entry.count)
      return { allowed: entry.count <= limit, remaining, resetAt: entry.expiresAt }
    }

    /**
    * Health check helper: returns 'ok' if Redis is configured and reachable, otherwise 'degraded' or 'not_configured'
    */
    export async function checkRedisHealth(): Promise<'ok' | 'degraded' | 'not_configured'> {
      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) return 'not_configured'
      const redis = getRedisClient()
      if (!redis) return 'degraded'
      if (redis.status !== 'ready') return 'degraded'
      try {
        const pong = await redis.ping()
        return pong ? 'ok' : 'degraded'
      } catch (err) {
        const now = Date.now()
        if (now - lastOutageLogAt > OUTAGE_LOG_INTERVAL_MS) {
          console.warn('[redis] ping failed:', err instanceof Error ? err.message : String(err))
          lastOutageLogAt = now
        }
        return 'degraded'
      }
    }

