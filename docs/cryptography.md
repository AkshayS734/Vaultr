# Cryptography

Deep dive into Vaultr's cryptographic algorithms, implementations, and security properties.

## Overview

| Algorithm | Purpose | Standard | Implementation |
|-----------|---------|----------|-----------------|
| scrypt v2 | Key derivation from master password | IETF | WASM (via crypto.ts) |
| PBKDF2 v1 | Legacy KDF (auto-migrated) | NIST | Node.js `crypto.pbkdf2` |
| AES-256-GCM | Secret encryption | NIST | Web Crypto API |
| SHA-256 | HMAC, token hashing | NIST | Web Crypto API |
| Argon2id | Password hashing (login password) | OWASP | Node.js `argon2` package |

---

## Key Derivation Function (KDF)

### Current Standard: scrypt v2

Master password → KEK (Key Encryption Key)

```typescript
// From app/lib/crypto.ts
export async function deriveKEK(
  masterPassword: string,
  salt: Buffer,
  version: number = 2
): Promise<Buffer> {
  if (version === 2) {
    // scrypt parameters
    const N = 65536      // 2^16: CPU/memory cost
    const r = 8          // blocksize parameter
    const p = 1          // parallelization parameter
    const keyLength = 32 // 256 bits

    // Uses WASM scrypt implementation for performance
    const kek = await scryptAsync(
      masterPassword,
      salt,
      N,
      r,
      p,
      keyLength
    )
    return kek
  }
  // ... PBKDF2 v1 fallback for legacy accounts
}
```

### Parameters Explained

- **N = 65536 (2^16)**: Exponential cost parameter
  - Doubling N doubles memory and CPU time
  - Chose 65536 as minimum safe value (100–300ms per derivation)
  - If attacker has stolen database, brute-forcing master password would take years
  
- **r = 8**: Block size parameter (affects memory)
  - Standard value; balances memory/CPU cost
  
- **p = 1**: Parallelization parameter
  - Set to 1; makes parallelization attacks hard
  - p > 1 would allow GPU brute-forcing

### WASM Implementation

Scrypt is CPU-intensive; delegated to WASM:

```typescript
// Psuedocode from app/lib/crypto.ts
async function scryptAsync(
  password: string,
  salt: Buffer,
  N: number,
  r: number,
  p: number,
  keyLength: number
): Promise<Buffer> {
  // Import WASM module at runtime
  const wasmModule = await import('@scrypt-js/scrypt')
  const key = await wasmModule.scrypt(
    password,      // Master password (string)
    salt,          // Random 32-byte salt
    N, r, p,       // Parameters
    keyLength      // 32 bytes
  )
  return Buffer.from(key)
}
```

**Why WASM?**
- Pure JavaScript scrypt is too slow (~2–3 seconds)
- WASM implementation: ~100–300ms
- Acceptable for unlocking vault; still slow enough for brute-force protection

### Legacy: PBKDF2 v1

Old accounts use PBKDF2:

```typescript
const kek = crypto.pbkdf2Sync(
  masterPassword,
  salt,
  600000,           // iterations (slower than scrypt)
  32,               // key length
  'sha256'
)
```

**Migration**: On next unlock, client re-encrypts vault key with scrypt v2.

---

## Vault Key Encryption

Vault key protected with AES-256-GCM:

```typescript
// From app/lib/crypto.ts
export function encryptVaultKey(
  vaultKey: Buffer,      // 32 bytes, random
  kek: Buffer            // 32 bytes, from scrypt
): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = crypto.randomBytes(16)  // Random IV
  
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    kek,               // Key Encryption Key
    iv
  )
  
  const ciphertext = Buffer.concat([
    cipher.update(vaultKey),
    cipher.final()
  ])
  
  const authTag = cipher.getAuthTag()  // GCM authentication
  
  return { ciphertext, iv, authTag }
}

export function decryptVaultKey(
  ciphertext: Buffer,
  kek: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    kek,
    iv
  )
  
  decipher.setAuthTag(authTag)
  
  const vaultKey = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ])
  
  return vaultKey
}
```

### Security Properties

- **IV (Initialization Vector)**: Random 16 bytes; never reused with same key
- **Auth Tag**: GCM proves integrity; tampering detected immediately
- **Key**: KEK from scrypt; different for each user, derived from master password

---

## Secret Encryption

Individual secrets encrypted with vault key (also AES-256-GCM):

```typescript
export function encryptSecret(
  plaintext: Buffer,
  vaultKey: Buffer,
  aad?: Buffer  // Additional Authenticated Data (metadata)
): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    vaultKey,
    iv
  )
  
  // Include metadata in authentication (but don't encrypt it)
  if (aad) {
    cipher.setAAD(aad)
  }
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  
  const authTag = cipher.getAuthTag()
  
  return { ciphertext, iv, authTag }
}

export function decryptSecret(
  ciphertext: Buffer,
  vaultKey: Buffer,
  iv: Buffer,
  authTag: Buffer,
  aad?: Buffer
): Buffer {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    vaultKey,
    iv
  )
  
  if (aad) {
    decipher.setAAD(aad)
  }
  
  decipher.setAuthTag(authTag)
  
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ])
  
  return plaintext
}
```

### AAD (Additional Authenticated Data)

Metadata included in authentication but **not encrypted**:

```
Plaintext secret:    "my-password"
                     ↓
Encrypt with vault key (AES-GCM)
                     ↓
Ciphertext:          "a7f3d2c1..." (encrypted)
AAD (metadata):      { title, username, ... } (plaintext)
Auth Tag:            "8a2b..." (proves ciphertext + metadata not tampered)

Result stored:
{
  ciphertext: "a7f3d2c1...",
  iv: "...",
  authTag: "8a2b...",
  metadata: { title, username, ... }
}
```

**Why?** Server can search/index metadata without decrypting secrets.

---

## Token Generation & Hashing

### JWT Access Tokens

```typescript
// From app/lib/crypto.ts
export function generateAccessToken(userId: string): string {
  const payload = {
    sub: userId,                        // Subject (user ID)
    iat: Math.floor(Date.now() / 1000), // Issued at
    exp: Math.floor(Date.now() / 1000) + 15 * 60  // Expires in 15 min
  }
  
  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,  // From .env
    { algorithm: 'HS256' }
  )
  
  return token
}

export function verifyAccessToken(token: string): {
  sub: string;
  iat: number;
  exp: number;
} {
  return jwt.verify(token, process.env.JWT_SECRET) as any
}
```

**Security**:
- Signed with `HS256` (HMAC-SHA256)
- Requires `JWT_SECRET` (32+ random bytes)
- Forgery impossible without secret
- Expiry enforced (15 minutes)

### Refresh Token Hashing

Refresh token **never stored in plaintext**:

```typescript
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256')
    .update(token)
    .digest('hex')
}

// Usage:
const refreshToken = crypto.randomBytes(32).toString('hex')  // 256-bit random
const refreshTokenHash = hashRefreshToken(refreshToken)

// Store hash in database
await db.session.create({
  userId,
  refreshTokenHash,  // ← Only this stored
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
})

// Send token to user (cookie)
response.headers.append(
  'Set-Cookie',
  `refreshToken=${refreshToken}; httpOnly; secure; ...`
)
```

**Why hash?** If database leaked, attacker can't use refresh tokens directly.

---

## HMAC Integrity

Secrets protected with HMAC-SHA256:

```typescript
export function computeHMAC(data: Buffer, key?: Buffer): Buffer {
  const hmac = crypto.createHmac('sha256', key || process.env.JWT_SECRET)
  hmac.update(data)
  return hmac.digest()
}

// When storing secret:
const hmac = computeHMAC(
  Buffer.concat([
    encryptedData.ciphertext,
    encryptedData.iv,
    Buffer.from(JSON.stringify(metadata))
  ])
)

// When retrieving:
const computedHmac = computeHMAC(...)
if (!computedHmac.equals(storedHmac)) {
  throw new Error('Payload tampered with')
}
```

**Detects**: Unauthorized modification of ciphertext or metadata.

---

## Password Hashing

Login password hashed with Argon2id:

```typescript
import argon2 from 'argon2'

// Signup
const passwordHash = await argon2.hash(loginPassword, {
  type: argon2.argon2id,           // Memory-hard, resistant to GPU/ASIC
  memoryCost: 19456,               // ~19.5 MB
  timeCost: 2,                     // 2 iterations
  parallelism: 1                   // Single-threaded
})

// Login
const isValid = await argon2.verify(passwordHash, loginPassword)
```

**Why Argon2id?**
- Memory-hard: Resistant to brute-force (requires memory + CPU)
- OWASP recommended
- GPU/ASIC attacks expensive
- Much slower than bcrypt or PBKDF2

---

## Random Number Generation

All random values generated with `crypto.randomBytes()`:

```typescript
const salt = crypto.randomBytes(32)              // 32 bytes for KDF salt
const vaultKey = crypto.randomBytes(32)          // 32 bytes for vault encryption
const iv = crypto.randomBytes(16)                // 16 bytes for AES-GCM IV
const refreshToken = crypto.randomBytes(32)      // 32 bytes for session token
const verificationToken = crypto.randomBytes(32) // 32 bytes for email verification
```

**CSPRNG**: `crypto.randomBytes()` uses OS entropy (not predictable).

---

## Algorithm Security Analysis

### Brute-Force Attack: Master Password

```
Attacker has: database (vault key encrypted), user email
Goal: Guess master password

Per guess:
  1. Derive KEK with scrypt: 100–300ms
  2. Decrypt vault key: <1ms
  3. Check if decryption succeeds: verify HMAC on one secret

Total per guess: ~100–300ms

Guesses per second: ~3–10
Years to exhaust 10^6 guesses: 27.7–92 years
Years to exhaust 10^9 guesses (trillion): 31.7–105 years
```

**Conclusion**: Brute-force infeasible for reasonable password entropy.

### Brute-Force Attack: Vault Key

```
Attacker has: encrypted vault key
Goal: Guess vault key

Vault key: 256 random bits (2^256 possibilities)
Guesses per second: unlimited (no KDF)
Years to exhaust 2^256: 10^68 years (heat death of universe)
```

**Conclusion**: Brute-force impossible (entropy too high).

### Side-Channel Attacks

**Timing attack on HMAC?**
- Using `crypto.timingSafeEqual()` for comparison (not simple `===`)
- Prevents timing analysis of HMAC

**Cache timing on scrypt?**
- WASM scrypt has constant-time guarantees (depends on library)
- Assume side-channels negligible in browser context

---

## Key Rotation & Compromise

### Vault Key Compromise

If vault key exposed:
1. Attacker can decrypt all secrets
2. User creates new master password
3. Client derives new KEK
4. Client generates new vault key
5. Client re-encrypts all secrets with new vault key
6. Database updated
7. Old vault key destroyed

### Master Password Compromise

If master password known:
1. Attacker can unlock vault anytime
2. User cannot recover
3. **Design limitation**: Master password non-recoverable by definition
4. Mitigation: User chooses strong password, doesn't reuse

### KEK Compromise

KEK lives in browser memory only:
1. If browser compromised (XSS, malware), KEK exposed
2. Attacker can decrypt all secrets in memory
3. Mitigations: CSP, subresource integrity, code review
4. 5-minute timeout limits exposure window

---

## Compliance & Standards

- **NIST 800-132**: PBKDF2 compliant (legacy only)
- **RFC 7914**: scrypt compliant
- **FIPS 197**: AES compliant
- **FIPS 180-4**: SHA-256 compliant
- **OWASP**: Argon2id recommended
- **OWASP**: GCM mode recommended for authenticated encryption

---

## Code References

- [app/lib/crypto.ts](app/lib/crypto.ts) — All encryption/KDF implementations
- [app/lib/auth-utils.ts](app/lib/auth-utils.ts) — Token generation/validation
- [app/schemas/auth.ts](app/schemas/auth.ts) — Input validation (token formats, etc.)

---

See also:
- [Vault Architecture](./vault-architecture.md) — How secrets stored/encrypted
- [Security Model](./security-model.md) — Threat model, assumptions
- [Authentication](./authentication.md) — Token lifecycle, session management
