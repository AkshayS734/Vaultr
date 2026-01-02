# Testing Strategy

How to test Vaultr comprehensively, from unit tests to integration tests to security validation.

## Test Coverage Overview

| Category | Current Coverage | Files | Approach |
|----------|-----------------|-------|----------|
| **Unit Tests** | 244 passing | 14 test suites | Jest + ts-jest |
| **Metadata Validation** | 35 tests | `metadata-validation.test.ts` | Zod + safety checks |
| **Crypto** | 40+ tests | `vault-zero-knowledge.test.ts` | Encryption/decryption |
| **Auth** | 30+ tests | `security-validation.test.ts` | Login, refresh, logout |
| **Password Strength** | 25+ tests | `password-strength.test.ts` | Score calculation |
| **Password Breach** | 15+ tests | `breach-route.test.ts` | HIBP checking |
| **Rate Limiting** | Embedded | Test suites | Redis/in-memory fallback |
| **Middleware Security** | 20+ tests | `middleware-bypass.test.ts` | CSRF, auth checks |

---

## Running Tests

### All Tests

```bash
npm test
```

Output:
```
PASS tests/password-strength.test.ts
PASS tests/password-generator.test.ts
...
Test Suites: 14 passed, 14 total
Tests:       244 passed, 244 total
```

### Watch Mode

```bash
npm test -- --watch
```

Runs tests on file change.

### Specific Suite

```bash
npm test -- metadata-validation
npm test -- vault-zero-knowledge
npm test -- breach-route
```

### Coverage Report

```bash
npm test -- --coverage
```

Shows line/branch coverage per file.

---

## Unit Test Categories

### 1. Metadata Safety Tests

**File**: [tests/metadata-validation.test.ts](tests/metadata-validation.test.ts)

**Goal**: Ensure plaintext secrets never leak into metadata.

**Examples**:
```typescript
test('rejects plaintext password in metadata', () => {
  const metadata = {
    title: "Bank",
    password: "my-secret"  // ← Forbidden
  }
  
  expect(() => validateMetadataSafety(metadata))
    .toThrow('password')
})

test('accepts password length (integer only)', () => {
  const metadata = {
    title: "Bank",
    passwordLength: 24  // ← Allowed
  }
  
  expect(() => validateMetadataSafety(metadata))
    .not.toThrow()
})

test('rejects password mask revealing partial secret', () => {
  const metadata = {
    title: "Bank",
    passwordMask: "MyBank••••"  // ← Forbidden (reveals prefix)
  }
  
  expect(() => validateMetadataSafety(metadata))
    .toThrow('mask')
})
```

**Coverage**:
- ✅ Forbidden fields (password, apiKey, secrets)
- ✅ Allowed fields (title, username, passwordLength)
- ✅ Partial secret detection (masks, hints)
- ✅ Nested object validation
- ✅ Array validation
- ✅ Custom field warnings

---

### 2. Cryptography Tests

**File**: [tests/vault-zero-knowledge.test.ts](tests/vault-zero-knowledge.test.ts)

**Goal**: Verify encryption/decryption works correctly; master password stays encrypted.

**Examples**:
```typescript
test('encrypts and decrypts secrets correctly', async () => {
  const plaintext = "super-secret-password"
  const vaultKey = crypto.randomBytes(32)
  const metadata = { title: "Bank" }
  
  const encrypted = encryptSecret(plaintext, vaultKey, metadata)
  const decrypted = decryptSecret(
    encrypted.ciphertext,
    vaultKey,
    encrypted.iv,
    encrypted.authTag,
    metadata
  )
  
  expect(decrypted.toString()).toBe(plaintext)
})

test('fails on tampered ciphertext', () => {
  const vaultKey = crypto.randomBytes(32)
  const encrypted = encryptSecret("secret", vaultKey)
  
  // Flip one bit
  encrypted.ciphertext[0] ^= 1
  
  expect(() => decryptSecret(
    encrypted.ciphertext,
    vaultKey,
    encrypted.iv,
    encrypted.authTag
  )).toThrow()
})

test('scrypt derivation is expensive', async () => {
  const password = "my-master-password"
  const salt = crypto.randomBytes(32)
  
  const start = Date.now()
  await deriveKEK(password, salt, 2)
  const duration = Date.now() - start
  
  expect(duration).toBeGreaterThan(50)  // At least 50ms
  expect(duration).toBeLessThan(1000)   // Less than 1 second
})
```

**Coverage**:
- ✅ Encryption/decryption roundtrip
- ✅ AES-GCM authentication (tamper detection)
- ✅ KDF scrypt cost (brute-force resistant)
- ✅ IV uniqueness
- ✅ AAD (additional authenticated data)
- ✅ Legacy PBKDF2 migration

---

### 3. Authentication Tests

**File**: [tests/security-validation.test.ts](tests/security-validation.test.ts)

**Goal**: Verify login, refresh, session, and token workflows.

**Examples**:
```typescript
test('login creates session with device binding', async () => {
  const user = await createTestUser()
  
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: user.email,
      password: user.plainPassword
    }),
    headers: {
      'user-agent': 'Mozilla/5.0'
    }
  })
  
  const session = await db.session.findFirst({
    where: { userId: user.id }
  })
  
  expect(session).toBeDefined()
  expect(session?.userAgent).toBe('Mozilla/5.0')
  expect(session?.ipAddress).toBeDefined()
})

test('refresh token rotation invalidates old token', async () => {
  const session = await createTestSession()
  const oldTokenHash = session.refreshTokenHash
  
  // Refresh
  await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'cookie': `refreshToken=${session.token}` }
  })
  
  const updatedSession = await db.session.findUnique({
    where: { id: session.id }
  })
  
  expect(updatedSession?.refreshTokenHash).not.toBe(oldTokenHash)
})

test('device binding rejects stolen token from different IP', async () => {
  const session = await createTestSession()
  
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'cookie': `refreshToken=${session.token}`,
      'x-forwarded-for': '192.168.1.100'  // Different IP
    }
  })
  
  expect(response.status).toBe(401)
})
```

**Coverage**:
- ✅ Signup flow
- ✅ Login with rate limiting
- ✅ Email verification
- ✅ Token generation/validation
- ✅ Refresh token rotation
- ✅ Device binding (IP + user agent)
- ✅ Session expiry
- ✅ Logout (single + all devices)

---

### 4. Password Strength Tests

**File**: [tests/password-strength.test.ts](tests/password-strength.test.ts)

**Goal**: Verify password strength scoring is accurate and useful.

**Examples**:
```typescript
test('weak passwords score low', () => {
  const { score } = calculatePasswordStrength("password")
  expect(score).toBeLessThan(40)
})

test('long random passwords score high', () => {
  const { score } = calculatePasswordStrength("aB3$xY9@mK2#nL5!pQ7")
  expect(score).toBeGreaterThan(80)
})

test('provides actionable feedback', () => {
  const { feedback } = calculatePasswordStrength("pass")
  
  expect(feedback).toContain("too short")
  expect(feedback).toContain("special characters")
  expect(feedback).toContain("uppercase")
})

test('detects common patterns', () => {
  const { feedback } = calculatePasswordStrength("Password123")
  
  expect(feedback).toContain("random")
})
```

**Coverage**:
- ✅ Length scoring (8–20+ chars)
- ✅ Character diversity (upper, lower, digit, symbol)
- ✅ Entropy calculation
- ✅ Common pattern detection
- ✅ Feedback messages
- ✅ Edge cases (empty, very long)

---

### 5. Password Breach Tests

**File**: [tests/breach-route.test.ts](tests/breach-route.test.ts)

**Goal**: Verify HaveIBeenPwned integration without exposing full password hashes.

**Examples**:
```typescript
test('sends only first 5 chars of hash to HIBP', async () => {
  const password = "MyPassword123"
  
  // Mock HIBP API
  let requestedPrefix: string | null = null
  
  mockHibpApi.onRequest((req) => {
    requestedPrefix = req.url.pathname.split('/')[1]
  })
  
  await checkBreachStatus(password)
  
  expect(requestedPrefix?.length).toBe(5)
})

test('detects breached password', async () => {
  mockHibpApi.registerBreachedHash("password123")
  
  const result = await checkBreachStatus("password123")
  
  expect(result.breached).toBe(true)
})

test('accepts safe password', async () => {
  const result = await checkBreachStatus("aB3$xY9@mK2#nL5!")
  
  expect(result.breached).toBe(false)
})
```

**Coverage**:
- ✅ K-anonymity (5-char prefix only)
- ✅ Breach detection
- ✅ Hash-matching
- ✅ Network failure handling
- ✅ Rate limit handling

---

### 6. Rate Limiting Tests

**File**: Tests embedded in auth routes

**Goal**: Verify rate limits work across multiple requests.

**Examples**:
```typescript
test('enforces login rate limit', async () => {
  const email = "attacker@example.com"
  
  // First 5 attempts succeed (rejected for wrong password)
  for (let i = 0; i < 5; i++) {
    const res = await login(email, "wrong-password")
    expect(res.status).toBe(401)
  }
  
  // 6th attempt blocked
  const res6 = await login(email, "wrong-password")
  expect(res6.status).toBe(429)
  expect(res6.headers.get('retry-after')).toBeDefined()
})

test('rate limit resets after window', async () => {
  const email = "user@example.com"
  
  // Hit limit
  for (let i = 0; i < 6; i++) {
    await login(email, "wrong")
  }
  
  // Wait 15 minutes
  jest.useFakeTimers()
  jest.advanceTimersByTime(15 * 60 * 1000)
  
  // Can attempt again
  const res = await login(email, "wrong")
  expect(res.status).not.toBe(429)
})
```

**Coverage**:
- ✅ Per-IP rate limiting
- ✅ Per-session rate limiting
- ✅ Window expiry
- ✅ Redis fallback

---

### 7. Middleware Security Tests

**File**: [tests/middleware-bypass.test.ts](tests/middleware-bypass.test.ts)

**Goal**: Prevent auth/CSRF middleware bypasses.

**Examples**:
```typescript
test('rejects requests without auth token', async () => {
  const response = await fetch('/api/vault/passwords')
  
  expect(response.status).toBe(401)
})

test('rejects expired access tokens', async () => {
  const expiredToken = generateAccessToken(userId, { expiresIn: '-1s' })
  
  const response = await fetch('/api/vault/passwords', {
    headers: { 'authorization': `Bearer ${expiredToken}` }
  })
  
  expect(response.status).toBe(401)
})

test('rejects CSRF without matching token', async () => {
  const session = await createTestSession()
  
  const response = await fetch('/api/vault/password', {
    method: 'POST',
    headers: {
      'cookie': `csrfToken=${session.csrfToken}`,
      'x-csrf-token': 'different-token'  // Mismatch
    }
  })
  
  expect(response.status).toBe(403)
})

test('accepts CSRF with matching token', async () => {
  const session = await createTestSession()
  
  const response = await fetch('/api/vault/password', {
    method: 'POST',
    headers: {
      'cookie': `csrfToken=${session.csrfToken}`,
      'x-csrf-token': session.csrfToken  // Match
    }
  })
  
  expect(response.status).not.toBe(403)
})
```

**Coverage**:
- ✅ Auth token validation
- ✅ Token expiry
- ✅ CSRF double-submit
- ✅ Middleware ordering
- ✅ Bypass prevention

---

## Integration Tests

### Database Tests

```typescript
test('transaction atomicity: vault key encrypted before commit', async () => {
  await db.$transaction(async (tx) => {
    const user = await createTestUser(tx)
    
    // Simulate failure mid-transaction
    throw new Error('Simulated error')
  }).catch(() => {})
  
  // Transaction rolled back; user not created
  const user = await db.user.findUnique({ where: { email } })
  expect(user).toBeUndefined()
})
```

### API Integration

```typescript
test('end-to-end: signup → verify → unlock → create secret', async () => {
  // 1. Signup
  const signupRes = await fetch('/api/auth/signup', { ... })
  const { userId } = await signupRes.json()
  
  // 2. Verify email
  const verifyToken = getTokenFromEmail()
  await fetch('/verify-email?token=' + verifyToken)
  
  // 3. Unlock
  const unlockRes = await fetch('/unlock', { ... })
  expect(unlockRes.ok).toBe(true)
  
  // 4. Create secret
  const secretRes = await fetch('/api/vault/password', {
    method: 'POST',
    body: JSON.stringify({
      encryptedData: { ... },
      metadata: { ... }
    })
  })
  expect(secretRes.ok).toBe(true)
})
```

---

## Security Test Patterns

### 1. Negative Tests

Always test that invalid inputs are rejected:

```typescript
test('rejects invalid email format', () => {
  expect(() => signupSchema.parse({
    email: "not-an-email",
    password: "valid",
    masterPassword: "valid"
  })).toThrow()
})
```

### 2. Boundary Tests

Test edge cases and limits:

```typescript
test('accepts minimum password length', () => {
  const result = signupSchema.safeParse({
    email: "user@example.com",
    password: "Pass@1",  // 6 chars (if 6 is min)
    masterPassword: "MPass@1"
  })
  expect(result.success).toBe(true)
})

test('rejects password exceeding max length', () => {
  const longPassword = "a".repeat(1001)  // Over 1000 char limit
  const result = signupSchema.safeParse({
    email: "user@example.com",
    password: longPassword,
    masterPassword: "valid"
  })
  expect(result.success).toBe(false)
})
```

### 3. Timing Attack Prevention

```typescript
test('HMAC comparison is constant-time', () => {
  const validHmac = computeHMAC(data)
  const invalidHmac = crypto.randomBytes(32)
  
  // Both comparisons take same time (within margin)
  const validStart = Date.now()
  const validMatch = timingSafeEqual(validHmac, validHmac)
  const validTime = Date.now() - validStart
  
  const invalidStart = Date.now()
  const invalidMatch = timingSafeEqual(invalidHmac, validHmac)
  const invalidTime = Date.now() - invalidStart
  
  expect(Math.abs(validTime - invalidTime)).toBeLessThan(10) // Within 10ms
})
```

### 4. Privilege Escalation Prevention

```typescript
test('user cannot access another user\'s secrets', async () => {
  const user1 = await createTestUser()
  const user2 = await createTestUser()
  
  const secret = await createTestSecret(user1)
  
  // User2 tries to access user1's secret
  const response = await fetch(`/api/vault/secret/${secret.id}`, {
    headers: { 'authorization': `Bearer ${user2.token}` }
  })
  
  expect(response.status).toBe(404)  // Or 403 (Forbidden)
})
```

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npx prisma migrate deploy
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage
      - run: npm run build
```

---

## Test Development Checklist

Before shipping a feature:

- [ ] Unit tests written (>80% coverage)
- [ ] Edge cases tested
- [ ] Negative cases tested (invalid input rejected)
- [ ] Security tests added (auth, crypto, CSRF)
- [ ] Integration tests pass
- [ ] `npm run ci` passes (lint → typecheck → test → build)
- [ ] Metadata safety validated
- [ ] Rate limiting tested
- [ ] Database transactions atomic
- [ ] Error cases handled (no leaking stack traces)

---

## Common Test Utilities

### Test Helpers

From [tests/helpers](tests/):

```typescript
// Create test user with plain password
async function createTestUser() {
  const plainPassword = "Test@123456"
  const passwordHash = await argon2.hash(plainPassword)
  return db.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      passwordHash,
      scryptSalt: crypto.randomBytes(32),
      kdfVersion: 2,
      encryptedVaultKey: { /* ... */ }
    }
  })
}

// Create test session
async function createTestSession(userId: string) {
  const refreshToken = crypto.randomBytes(32).toString('hex')
  return db.session.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent'
    }
  })
}
```

---

See also:
- [Contributing](./contributing.md) — Code review checklist
- [API Overview](./api-overview.md) — Endpoint testing
