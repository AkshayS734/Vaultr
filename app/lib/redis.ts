    import Redis from 'ioredis'

    let redisClient: Redis | null = null
    let lastOutageLogAt = 0
    const OUTAGE_LOG_INTERVAL_MS = 60_000

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
    * Fail-open: if Redis unavailable or errors, allow the request.
    */
    export async function checkRateLimit(key: string, windowMs: number, limit: number): Promise<RateLimitInfo> {
      const redis = getRedisClient()
      if (!redis || redis.status !== 'ready') {
        return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs }
      }

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
          console.warn('[redis] checkRateLimit error, bypassing:', err instanceof Error ? err.message : String(err))
          lastOutageLogAt = now
        }
        return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs }
      }
    }

    /**
    * Consume a rate limit token (increment) on failure only.
    * Sets the window expiry when creating the counter.
    * Fail-open: swallow errors and do not affect request outcome.
    */
    export async function consumeRateLimit(key: string, windowMs: number): Promise<void> {
      const redis = getRedisClient()
      if (!redis || redis.status !== 'ready') return
      try {
        const count = await redis.incr(key)
        if (count === 1) {
          await redis.pexpire(key, windowMs)
        }
      } catch (err) {
        const now = Date.now()
        if (now - lastOutageLogAt > OUTAGE_LOG_INTERVAL_MS) {
          console.warn('[redis] consumeRateLimit error:', err instanceof Error ? err.message : String(err))
          lastOutageLogAt = now
        }
        // Fail-open: do nothing
      }
    }

    /**
    * Legacy combined rateLimit helper used by existing routes.
    * Performs INCR and returns allowance info. Fail-open on Redis outage.
    */
    export async function rateLimit(key: string, windowMs: number, limit: number): Promise<RateLimitInfo> {
      const redis = getRedisClient()
      if (!redis || redis.status !== 'ready') {
        return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs }
      }
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
          console.warn('[redis] rateLimit error, bypassing:', err instanceof Error ? err.message : String(err))
          lastOutageLogAt = now
        }
        return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs }
      }
    }

