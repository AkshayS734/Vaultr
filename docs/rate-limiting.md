# Rate Limiting

How Vaultr protects against brute-force and abuse with rate limiting.

## Overview

Rate limiting prevents:
- Brute-force login attempts
- Credential stuffing
- Account enumeration
- Token refresh spam
- Signup flooding

All backed by Redis (with graceful in-memory fallback).

---

## Limits by Endpoint

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /api/auth/login` | 5 attempts | 15 minutes | IP address |
| `POST /api/auth/signup` | 50 attempts | 1 hour | IP address |
| `POST /api/auth/refresh` | 6 attempts | 1 minute | Session ID |
| `POST /api/auth/request-verification` | 5 attempts | 1 hour | Email address |
| `POST /api/vault/password` (create) | 100 per hour | 1 hour | User ID |
| `POST /api/vault/password/:id` (update) | 100 per hour | 1 hour | User ID |
| `DELETE /api/vault/password/:id` | 50 per hour | 1 hour | User ID |

---

## Implementation

### Redis-Based Rate Limiting

```typescript
// From app/lib/redis.ts
import { createClient } from 'redis'

const redis = createClient({
  url: process.env.REDIS_URL
})

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  try {
    await redis.connect()
    
    const current = await redis.incr(key)
    
    if (current === 1) {
      // First request in window; set expiry
      await redis.expire(key, windowSeconds)
    }
    
    const remaining = Math.max(limit - current, 0)
    const retryAfter = current > limit ? windowSeconds : undefined
    
    await redis.disconnect()
    
    return {
      allowed: current <= limit,
      remaining,
      retryAfter
    }
  } catch (error) {
    // Redis unavailable; fall back to in-memory
    return checkRateLimitInMemory(key, limit, windowSeconds)
  }
}
```

### In-Memory Fallback

When Redis unavailable:

```typescript
const inMemoryStore = new Map<string, { count: number; expiresAt: number }>()

function checkRateLimitInMemory(
  key: string,
  limit: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now()
  const entry = inMemoryStore.get(key)
  
  if (!entry || entry.expiresAt < now) {
    // New window
    inMemoryStore.set(key, {
      count: 1,
      expiresAt: now + windowSeconds * 1000
    })
    return { allowed: true, remaining: limit - 1 }
  }
  
  entry.count++
  const remaining = Math.max(limit - entry.count, 0)
  
  return {
    allowed: entry.count <= limit,
    remaining,
    retryAfter: entry.count > limit ? windowSeconds : undefined
  }
}
```

**Limitation**: In-memory store is per-process (not shared across instances in production).

---

## Login Rate Limiting

### Request

```typescript
// POST /api/auth/login
export async function POST(req: Request) {
  const body = await req.json()
  
  // Get client IP
  const clientIp = getClientIp(req)
  
  // Check rate limit
  const rateLimitKey = `login:${clientIp}`
  const rateLimit = await checkRateLimit(rateLimitKey, 5, 15 * 60)
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Too many login attempts. Please try again later.',
        retryAfter: rateLimit.retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter)
        }
      }
    )
  }
  
  // Proceed with login
  const { email, password } = body
  // ... verify credentials
}
```

### Client Response

```typescript
// Frontend handling
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
})

if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '900')
  const minutes = Math.ceil(retryAfter / 60)
  
  showError(`Too many attempts. Try again in ${minutes} minutes.`)
  
  // Disable login button for retryAfter seconds
  loginButton.disabled = true
  setTimeout(() => {
    loginButton.disabled = false
  }, retryAfter * 1000)
}
```

---

## Signup Rate Limiting

Prevents signup flooding from single IP:

```typescript
// POST /api/auth/signup
export async function POST(req: Request) {
  const clientIp = getClientIp(req)
  
  // 50 signups per hour per IP
  const rateLimitKey = `signup:${clientIp}`
  const rateLimit = await checkRateLimit(rateLimitKey, 50, 60 * 60)
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many signup attempts from this IP' },
      { status: 429 }
    )
  }
  
  // Proceed with signup
  // ...
}
```

---

## Refresh Token Rate Limiting

Detects token refresh spam:

```typescript
// POST /api/auth/refresh
export async function POST(req: Request) {
  const session = getSessionFromCookie(req)
  
  // 6 refreshes per minute per session
  const rateLimitKey = `refresh:${session.id}`
  const rateLimit = await checkRateLimit(rateLimitKey, 6, 60)
  
  if (!rateLimit.allowed) {
    // Suspicious activity; revoke session
    await db.session.delete({ where: { id: session.id } })
    
    return NextResponse.json(
      { error: 'Suspicious refresh activity detected' },
      { status: 429 }
    )
  }
  
  // Proceed with refresh
  // ...
}
```

---

## Rate Limit Bypass Prevention

### Attack: Distributed IPs

**Attacker**: Uses proxies/botnet to appear as different IPs.

**Current Mitigation**:
- Rate limit per IP (slows attack)
- Account lockout after N failed logins (future)
- Email notification (future)

**Better Mitigation**:
- Check password hash first (expensive)
- Rate limit per user + per IP
- Progressive delays (5th attempt slower than 3rd)

### Attack: Rotate Sessions

**Attacker**: Creates new sessions to bypass refresh limit.

**Current Mitigation**:
- Rate limit per session ID (not per user)
- Device binding invalidates mismatched IPs

**Better Mitigation**:
- Rate limit per user (not session)
- Track cumulative refresh rate

### Implementation

```typescript
// Future: Per-user login rate limiting
async function checkLoginRateLimit(userId: string) {
  const recentAttempts = await db.auditLog.count({
    where: {
      userId,
      action: 'login_failed',
      timestamp: {
        gte: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes
      }
    }
  })
  
  if (recentAttempts >= 5) {
    return {
      allowed: false,
      message: 'Account temporarily locked due to failed login attempts',
      retryAfter: 15 * 60
    }
  }
  
  return { allowed: true }
}
```

---

## Configuration

### Environment Variables

```bash
# Redis connection (optional; in-memory fallback if missing)
REDIS_URL=redis://localhost:6379

# Rate limit overrides (optional)
RATE_LIMIT_LOGIN=5
RATE_LIMIT_LOGIN_WINDOW=900         # 15 minutes
RATE_LIMIT_SIGNUP=50
RATE_LIMIT_SIGNUP_WINDOW=3600        # 1 hour
RATE_LIMIT_REFRESH=6
RATE_LIMIT_REFRESH_WINDOW=60         # 1 minute
```

### Dynamic Configuration

```typescript
// app/lib/redis.ts
const LIMITS = {
  login: {
    max: parseInt(process.env.RATE_LIMIT_LOGIN || '5'),
    window: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW || '900')
  },
  signup: {
    max: parseInt(process.env.RATE_LIMIT_SIGNUP || '50'),
    window: parseInt(process.env.RATE_LIMIT_SIGNUP_WINDOW || '3600')
  },
  refresh: {
    max: parseInt(process.env.RATE_LIMIT_REFRESH || '6'),
    window: parseInt(process.env.RATE_LIMIT_REFRESH_WINDOW || '60')
  }
}
```

---

## Monitoring & Alerts

### Logging Rate Limit Hits

```typescript
if (!rateLimit.allowed) {
  // Log for monitoring
  console.warn('Rate limit exceeded', {
    endpoint: '/api/auth/login',
    key: clientIp,
    limit: 5,
    window: '15m',
    timestamp: new Date()
  })
  
  // Send alert if many hits
  if (rateLimit.remaining < 0) {
    alertSecurityTeam({
      type: 'RATE_LIMIT_SPAM',
      ip: clientIp,
      endpoint: '/api/auth/login'
    })
  }
}
```

### Redis Metrics

```bash
# Monitor Redis memory
redis-cli INFO memory

# Check active keys
redis-cli KEYS "login:*"
redis-cli KEYS "signup:*"
redis-cli KEYS "refresh:*"

# Get rate limit for specific IP
redis-cli GET "login:192.168.1.1"
```

---

## Testing Rate Limits

### Unit Tests

```typescript
test('login rate limit blocks after 5 attempts', async () => {
  const ip = '127.0.0.1'
  
  // First 5 attempts succeed (rejected for wrong password)
  for (let i = 0; i < 5; i++) {
    const res = await login('user@example.com', 'wrong', { ip })
    expect(res.status).toBe(401)
  }
  
  // 6th attempt blocked
  const res6 = await login('user@example.com', 'wrong', { ip })
  expect(res6.status).toBe(429)
})

test('rate limit resets after window', async () => {
  const ip = '127.0.0.1'
  
  // Hit limit
  for (let i = 0; i < 6; i++) {
    await login('user@example.com', 'wrong', { ip })
  }
  
  // Advance time
  jest.useFakeTimers()
  jest.advanceTimersByTime(15 * 60 * 1000)
  
  // Can attempt again
  const res = await login('user@example.com', 'wrong', { ip })
  expect(res.status).not.toBe(429)
})
```

---

## Best Practices

### 1. Use Consistent Keys

```typescript
// ✅ Good: Predictable format
const key = `login:${clientIp}`

// ❌ Bad: Inconsistent
const key = `attempt-${clientIp}-login`
```

### 2. Set Expiry on New Keys

```typescript
// ✅ Good: Set expiry
if (current === 1) {
  await redis.expire(key, windowSeconds)
}

// ❌ Bad: Never expires
await redis.incr(key)
```

### 3. Return Useful Information

```typescript
// ✅ Good: Client can display info
return {
  allowed: current <= limit,
  remaining: Math.max(limit - current, 0),
  retryAfter: current > limit ? windowSeconds : undefined
}

// ❌ Bad: Only boolean
return current <= limit
```

### 4. Log Violations

```typescript
// ✅ Good: Track for security analysis
if (!rateLimit.allowed) {
  console.warn('Rate limit exceeded', { key, limit, window })
  await createAuditLog(userId, 'rate_limit_exceeded', { key })
}
```

---

## Future Improvements

- [ ] Per-user rate limiting (not just per-IP)
- [ ] Adaptive rate limiting (increase delays on repeated failures)
- [ ] Account lockout (after N failed attempts)
- [ ] Email notification on suspicious activity
- [ ] Captcha on too many failed attempts
- [ ] IP reputation checking (block known attacker IPs)
- [ ] Metrics dashboard (chart rate limit hits)

---

See also:
- [Authentication](./authentication.md) — Login flow, device binding
- [Security Model](./security-model.md) — Threat model
- [Environment Variables](./environment-variables.md) — Rate limit configuration
