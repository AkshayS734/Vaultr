# Security Model

Complete explanation of Vaultr's security design, assumptions, and password concepts.

## Key Principles

1. **Zero-knowledge architecture**: Backend never sees plaintext secrets
2. **Client-side encryption**: All secrets encrypted in browser before transmission
3. **Master password never stored**: Used only for client-side key derivation
4. **Metadata isolation**: Metadata contains only non-sensitive UI info
5. **Fail closed**: When unsure, reject requests rather than granting access

---

## Password Concepts (CRITICAL)

Vaultr uses **TWO distinct password types**. Confusing them is a security failure.

### 1. Login Password

- **Purpose**: Authentication only (prove you are who you claim)
- **Storage**: Hashed with Argon2 on server (one-way)
- **Recovery**: Email reset link; user chooses new password
- **Transmission**: HTTPS only, not used for encryption
- **Examples**:
  - Sign up with email + login password
  - Reset via forgot-password email flow
  - Can change anytime on settings page

**NOT used for vault encryption.**

### 2. Master Password

- **Purpose**: Client-side encryption key derivation (unlock vault)
- **Storage**: NEVER stored, NEVER transmitted
- **Recovery**: NOT possible; leads to permanent vault loss
- **Transmission**: NEVER sent to server, processed only in browser
- **Examples**:
  - Set on signup (different from login password)
  - Used each time you unlock vault after inactivity
  - Changed only by re-encrypting entire vault
  - User must memorize or store in password manager

**ONLY used for vault encryption; cannot be reset.**

### Visual Distinction in UI

```
Sign Up                           Unlock Vault
─────────────────────────────────────────────────
Email         [your@email.com]    Master Password: [••••••]
Login Password:    [•••••••] →     Button: "Unlock"
Master Password:   [•••••••]

After forgot-password flow →
  User sets NEW login password
  (Master password unchanged)
```

---

## Encryption Boundaries

### Client-Side (Browser)

```
Master Password
    ↓
Scrypt KDF (N=65536, r=8, p=1)
    ↓
Key Encryption Key (KEK)
    ↓
[Decrypt stored vault key from backend]
    ↓
Vault Key
    ↓
[Encrypt/Decrypt individual secrets with AES-GCM]
```

**Secrets encrypted here**: passwords, API keys, env var values, notes

### Server (Node.js / PostgreSQL)

```
Encrypted vault key (never decrypted)
Encrypted secrets (never decrypted)
Metadata (non-sensitive only)
Audit logs (PII redacted)
```

### Data Flow: Add New Password

```
User's browser:
  1. User enters password text + title
  2. Vault key (already in memory) encrypts password
  3. Metadata built (title, passwordLength, etc.)
  4. Payload = { encryptedData, metadata, hmac }

  ↓ HTTPS POST /api/passwords

Server receives:
  5. Validate HMAC (detect tampering)
  6. Validate metadata (reject if contains real password)
  7. Store encrypted blob + metadata
  8. NO decryption attempted
```

---

## Key Derivation

### scrypt v2 (Current Standard)

Used on signup and every unlock:

```
KEK = scrypt(
  password = master password
  salt = random 32 bytes (stored in database)
  N = 65536 (2^16, expensive but necessary)
  r = 8
  p = 1
  keyLength = 32 bytes
)
```

**Cost**: ~100–300ms per derivation (intentional; prevents brute force)

### PBKDF2 v1 (Legacy)

Old accounts may use:
```
KEK = PBKDF2-SHA256(
  password = master password
  salt = random 32 bytes
  iterations = 600,000
  keyLength = 32 bytes
)
```

Migrated to scrypt v2 automatically on next unlock.

---

## Vault Key Encryption

The vault key itself is encrypted and stored:

```
vault_key (random 32 bytes) ─→ Encrypted with AES-GCM(KEK)
                                    ↓
                         ciphertext + IV + tag
                                    ↓
                         Stored in database
```

If someone steals the database:
- Vault key still encrypted (useless without KEK)
- KEK can only be derived from master password
- Master password never stored (useless without it)

---

## Secret Encryption

Each secret encrypted with vault key:

```
Secret (password, API key, etc.)
  ↓
AES-GCM(vault_key, plaintext, AAD=metadata)
  ↓
ciphertext + IV + authTag
  ↓
Stored in database along with metadata
```

**Authentication**: GCM tag proves data not tampered; metadata included in AAD

---

## Session Security

### Token Lifecycle

1. **Login**
   - User provides email + login password
   - Server verifies Argon2 hash
   - Server generates JWT (15 min) + refresh token
   - Refresh token stored in httpOnly cookie

2. **Access Token**
   - Valid for 15 minutes
   - Claims: `{ sub: userId, iat, exp }`
   - Signed with `JWT_SECRET`

3. **Refresh Token**
   - Valid for 30 days
   - Stored httpOnly, Secure, SameSite=Strict
   - Hashed with SHA256 before storage
   - Rotation: new refresh token on each refresh

4. **Session Table**
   - Tracks IP, user agent, last used time
   - Mismatch detected → session invalidated
   - Enables "logout all" and device binding

### Attack Mitigations

| Attack | Mitigation |
|--------|-----------|
| Token theft via XSS | httpOnly cookie, no localStorage |
| CSRF | Double-submit CSRF tokens on state-changing routes |
| Session hijacking | Device binding (IP + user agent) |
| Replay attacks | Short expiry, rotation, timestamps |
| Brute-force login | Rate limiting (5 attempts / 15 min per IP) |

---

## Email Verification

Sensitive operations (logout all, settings changes) require email verification:

1. User requests sensitive operation
2. Server generates verification token (32 bytes, hashed with SHA256)
3. Email sent with token in link
4. Token valid for 10 minutes
5. User clicks link → token validated → operation approved

**Example**: "Logout all devices" requires email verification.

---

## Rate Limiting

Protects against brute force and abuse:

| Endpoint | Limit | Window | Storage |
|----------|-------|--------|---------|
| POST /auth/login | 5 attempts | 15 minutes | Redis or in-memory |
| POST /auth/signup | 50 attempts | 1 hour | Redis or in-memory |
| POST /auth/refresh | 6 attempts | 1 minute | Redis or in-memory |

If Redis unavailable, falls back to in-memory (single-process only).

---

## Metadata Safety

**Rule**: A database leak of metadata alone must reveal ZERO usable secret information.

### Safe Metadata Fields

✅ `title` — "My bank password"  
✅ `username` — "john@example.com"  
✅ `passwordLength` — 24 (non-reversible)  
✅ `hasNotes` — true/false (boolean)  
✅ `category` — "Finance" (env var context)  
✅ `variableKeys` — ["API_KEY", "DB_HOST"] (variable names only, not values)  

### Forbidden Metadata Fields

❌ `password` — Never  
❌ `passwordMask` — "MyBank••••" → reveals partial password  
❌ `apiKey` or `apiKeyMask` → Reveals even partial key  
❌ `secretValue` or sample → Leaks secret  
❌ `passwordHint` → Can expose character patterns  

If you try to store forbidden fields, `validateMetadataSafety()` throws:

```
Error: Metadata field "password" must not be stored in plaintext.
Ensure this is not sensitive data.
```

---

## Vault Lock

Auto-locks after 5 minutes of inactivity:

1. User navigates to `/unlock`
2. Enters master password (not login password)
3. Client derives KEK, decrypts vault key
4. Vault key kept in memory for 5 minutes
5. Timer resets on each action
6. Closes browser tab? Vault key cleared from memory

**No server interaction**: Lock entirely client-side.

---

## Breach Checking

Passwords checked against HaveIBeenPwned (HIBP) database:

1. Hash password locally with SHA-1
2. Send only first 5 characters to HIBP
3. HIBP returns list of matching hashes (without revealing your password)
4. Check if full hash matches
5. Mark password as "breached" if found

Uses k-anonymity pattern; HIBP never sees full hash.

---

## Threat Model

### Adversaries

1. **Network eavesdropper**
   - Mitigated: HTTPS only; no secrets in requests
   
2. **Server breach (database stolen)**
   - Attacker gets: encrypted secrets, encrypted vault key, user emails
   - Cannot decrypt without master password
   - Master password never stored

3. **Insider at hosting provider**
   - Can see traffic but cannot decrypt (TLS)
   - Can see database but cannot decrypt (master password not stored)

4. **Attacker with user's computer**
   - Can extract vault key from browser memory (5-min window)
   - Cannot extract master password (user input only)
   - Cannot extract login password (never stored locally)

5. **Phishing attacker**
   - Can trick user into revealing master password
   - Mitigation: Education, never request master password via email

### Assumptions

- **HTTPS enforced** (production only; TLS prevents eavesdropping)
- **Master password is strong** (user's responsibility)
- **JavaScript not compromised** (no XSS framework vulnerabilities; see CSP)
- **Browser crypto APIs trustworthy** (Web Crypto API)
- **PostgreSQL + Node.js not backdoored**

### Out of Scope

- Recovering master password (impossible by design)
- Protecting against malware on user's computer
- Protecting against shoulder surfing
- Protecting against user sharing master password

---

## Security Checklist for Development

Before submitting a PR:

- [ ] No plaintext secrets logged or indexed
- [ ] Metadata validated with `validateMetadataSafety()`
- [ ] All user inputs validated with Zod schemas
- [ ] Rate limits applied to auth endpoints
- [ ] Email verification enforced for sensitive operations
- [ ] Argon2 used for password hashing
- [ ] AES-GCM used for secret encryption
- [ ] Audit events logged for security actions
- [ ] HTTPS-only cookies in production
- [ ] CSRF tokens validated on state-changing routes

---

See also:
- [Threat Model](./threat-model.md) — Detailed attack scenarios
- [Cryptography](./cryptography.md) — Algorithm details and code
- [Authentication](./authentication.md) — Session and token lifecycle
- [Vault Architecture](./vault-architecture.md) — Data storage and retrieval
