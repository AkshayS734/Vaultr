# Vault Architecture

How Vaultr stores, encrypts, and retrieves secrets while maintaining zero-knowledge on the backend.

## Data Model Overview

### Core Tables

#### `users`
```sql
id              UUID PRIMARY KEY
email           VARCHAR UNIQUE
emailNormalized VARCHAR UNIQUE  -- lowercase for uniqueness checks
authHash        VARCHAR (Argon2)
isEmailVerified BOOLEAN
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
lastLoginAt     TIMESTAMP
deletedAt       TIMESTAMP  -- soft-delete marker
```

**Security**: `authHash` is one-way (Argon2); login password never stored plaintext.
**Relations**: Has one Vault (stores encrypted vault key and KDF params).

#### `vaults`
```sql
id                UUID PRIMARY KEY
userId            UUID FOREIGN KEY UNIQUE
encryptedVaultKey STRING (Base64 encoded, AES-GCM encrypted)
salt              STRING (Base64 encoded, 16 bytes)
kdfParams         JSONB {
                    version: 1 or 2,
                    algorithm: "PBKDF2" or "scrypt-browser-v1",
                    iterations/N/r/p: params
                  }
createdAt         TIMESTAMP
updatedAt         TIMESTAMP
deletedAt         TIMESTAMP  -- soft-delete marker
```

**Security**: Vault key encrypted with KEK (derived from master password on client).
**KDF Versioning**: v1 = PBKDF2 (legacy), v2 = scrypt (current default).

#### `items` (encrypted passwords, API keys, env vars)
```sql
id            UUID PRIMARY KEY
vaultId       UUID FOREIGN KEY  -- references vaults(id)
secretType    ENUM (PASSWORD, API_KEY, ENV_VARS)
encryptedData STRING (Base64 encoded, AES-GCM ciphertext)
iv            STRING (Base64 encoded, 12 bytes)
metadata      JSONB {
                title, username, passwordLength,
                apiKeyLength, variableKeys, hasNotes, etc.
              }
createdAt     TIMESTAMP
updatedAt     TIMESTAMP
deletedAt     TIMESTAMP  -- soft-delete marker
```

**Security**: 
- `encryptedData` contains ALL sensitive values (passwords, API keys, env var values)
- `metadata` contains ONLY non-sensitive UI info (NO secrets, NO partial secrets, NO masks)
- Database leak of metadata alone MUST reveal ZERO usable secrets
- Validated with `validateMetadataSafety()` before storage

#### `sessions`
```sql
id             UUID PRIMARY KEY
userId         UUID FOREIGN KEY
refreshTokenHash VARCHAR (SHA256)
ipAddress      VARCHAR (truncated for privacy)
userAgent      VARCHAR (truncated)
expiresAt      TIMESTAMP
createdAt      TIMESTAMP
lastUsedAt     TIMESTAMP
```

**Security**: Session binding by IP + user agent; token hash prevents database leak from exposing tokens.

#### `audit_logs`
```sql
id             UUID PRIMARY KEY
userId         UUID FOREIGN KEY
action         VARCHAR (login, secret_created, etc.)
details        JSONB (IPs/tokens truncated)
timestamp      TIMESTAMP
```

---

## Encryption Flow: Create Secret

### Step 1: Client-Side Encryption

User fills form in browser:
```
Title:    "Bank Account"
Username: "john@example.com"
Password: "super-secret-password-123"
```

Browser encrypts with vault key (already in memory):

```typescript
// Pseudocode
const secretText = "super-secret-password-123"
const plaintext = JSON.stringify({
  password: secretText,
  // ... other secret fields
})

const { ciphertext, iv, authTag } = encryptAES256GCM(
  key: vaultKey,        // 32 bytes, from KEK decryption
  plaintext: plaintext, // JSON with all secret data
  aad: metadata         // Authenticated but not encrypted
)

const encryptedData = {
  ciphertext,
  iv,
  authTag
}
```

### Step 2: Metadata Building

Only non-secret info included:

```typescript
const metadata = {
  title: "Bank Account",
  username: "john@example.com",
  passwordLength: 24,        // Integer only, not the password itself
  hasNotes: false,
  category: "Finance"
}

// Validation: Ensure metadata is safe
validateMetadataSafety(metadata) // Throws if password/key/secret found
```

### Step 3: HMAC Integrity Check

Compute HMAC over entire encrypted payload:

```typescript
const hmac = sha256(
  encryptedData.ciphertext +
  encryptedData.iv +
  JSON.stringify(metadata)
)
```

### Step 4: HTTP POST to /api/passwords

Browser sends:

```json
{
  "encryptedData": {
    "ciphertext": "hex string (encrypted blob)",
    "iv": "hex string (16 bytes)",
    "authTag": "hex string (16 bytes)"
  },
  "metadata": {
    "title": "Bank Account",
    "username": "john@example.com",
    "passwordLength": 24,
    "hasNotes": false,
    "category": "Finance"
  },
  "hmac": "hex string"
}
```

### Step 5: Server-Side Validation

Server receives (does NOT decrypt):

```typescript
// 1. Validate metadata safety
validateMetadataSafety(metadata)
// → Throws if any forbidden fields detected

// 2. Validate HMAC
const computedHmac = sha256(
  request.encryptedData.ciphertext +
  request.encryptedData.iv +
  JSON.stringify(request.metadata)
)
if (computedHmac !== request.hmac) {
  throw new Error("Payload tampered with")
}

// 3. Store encrypted blob
await db.secrets.create({
  userId: auth.userId,
  encryptedData: request.encryptedData,
  metadata: request.metadata,
  hmac: request.hmac
})
```

**Result**: Plaintext never seen by server; only encrypted blob stored.

---

## Decryption Flow: Retrieve Secret

### Step 1: Client Requests Secrets

Browser authenticated with JWT; calls `/api/passwords`:

```
GET /api/passwords
Authorization: Bearer <jwt_token>
```

### Step 2: Server Returns Encrypted Blob

Server authenticates JWT, returns:

```json
{
  "secrets": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "encryptedData": {
        "ciphertext": "hex string",
        "iv": "hex string",
        "authTag": "hex string"
      },
      "metadata": {
        "title": "Bank Account",
        "username": "john@example.com",
        "passwordLength": 24,
        "hasNotes": false
      }
    }
  ]
}
```

**Server does NOT decrypt. Sends ciphertext directly to browser.**

### Step 3: Client Decrypts

Browser has vault key in memory (from unlock); decrypts locally:

```typescript
const secret = secrets[0]

const plaintext = decryptAES256GCM(
  key: vaultKey,
  ciphertext: secret.encryptedData.ciphertext,
  iv: secret.encryptedData.iv,
  authTag: secret.encryptedData.authTag,
  aad: secret.metadata
)

// plaintext is original JSON: { password: "super-secret-password-123", ... }
const decrypted = JSON.parse(plaintext)

console.log(decrypted.password) // "super-secret-password-123"
```

### Step 4: Display in UI

Decrypted password shown in UI (masked by default, revealed on click).

---

## Vault Key Derivation & Storage

### Initial Setup (Signup)

```
Master Password (user input, never stored)
  ↓
Scrypt KDF → Key Encryption Key (KEK) [32 bytes, ephemeral]
  ↓
Generate random vault key [32 bytes]
  ↓
Encrypt vault key with KEK → ciphertext + IV + tag
  ↓
Store in database under users.encryptedVaultKey
```

### Unlock (After Inactivity or Browser Close)

```
User enters master password
  ↓
Scrypt KDF with stored salt → Key Encryption Key (KEK)
  ↓
Decrypt encryptedVaultKey with KEK
  ↓
Extract vault key [32 bytes]
  ↓
Load into memory for 5 minutes
```

### Key Lifecycle

| State | Location | Security |
|-------|----------|----------|
| Master password | User's head (never anywhere else) | Memorization/password manager |
| KEK | Browser memory during unlock (temp) | Cleared when browser closed |
| Vault key | Browser memory after unlock | Cleared after 5 min inactivity |
| Encrypted vault key | Database | Useless without KEK/master password |

---

## Secret Lifecycle

### 1. Create
- Client encrypts with vault key
- Server stores ciphertext + metadata
- Server never decrypts

### 2. Read
- Server returns ciphertext + metadata
- Client decrypts with vault key
- Password shown masked or revealed

### 3. Edit
- Client decrypts old ciphertext
- User modifies plaintext
- Client encrypts new ciphertext
- Server replaces old with new

### 4. Delete
- Client sends DELETE request with secret ID
- Server verifies ownership (JWT)
- Server deletes row
- Ciphertext permanently lost

### 5. Backup / Export
- Client reads all encrypted data from database
- Client decrypts all with vault key
- Client exports plaintext (user's computer only)
- Server never exports

---

## Metadata Structure

### Passwords
```json
{
  "title": "String",
  "username": "String or null",
  "passwordLength": "Number",
  "hasNotes": "Boolean",
  "category": "String (optional)"
}
```

### API Keys
```json
{
  "title": "String",
  "service": "String (AWS, GitHub, etc.)",
  "apiKeyLength": "Number",
  "hasNotes": "Boolean",
  "category": "String (optional)"
}
```

### Environment Variables
```json
{
  "variableName": "String (KEY_NAME)",
  "environment": "String (dev, staging, prod)",
  "variableLength": "Number",
  "hasNotes": "Boolean"
}
```

**Validation**: Zod schema + `validateMetadataSafety()` function.

---

## Database Integrity

### HMAC Verification

Each secret has HMAC preventing tampering:

```
If attacker modifies ciphertext in database:
  → HMAC no longer matches
  → Client detects and rejects
```

### Transaction Safety

Vault key encryption uses Prisma transactions:

```typescript
await db.$transaction(async (tx) => {
  // Update vault key atomically
  await tx.users.update({
    where: { id: userId },
    data: { encryptedVaultKey: newEncrypted }
  })
})
```

If interrupted (power loss, network), transaction rolls back.

---

## Zero-Knowledge Guarantee

**Claim**: "A database leak reveals zero usable secrets."

**Proof**:
1. All secret values in `encryptedData` (ciphertext, keyed with vault key)
2. Vault key itself encrypted with KEK
3. KEK derived from master password
4. Master password never stored anywhere
5. Therefore: Attacker needs master password to decrypt anything

**Attack chain to extract a password**:
```
1. Steal database          ✓ Get encryptedVaultKey, encryptedData
2. Extract ciphertext      ✓ Have hex bytes
3. Decrypt with KEK?       ✗ Don't have KEK
4. Derive KEK?             ✗ Need scrypt (expensive, non-parallelizable)
5. Brute-force password?   ✗ Would take years per guess (scrypt N=65536)
6. Steal from browser?     ✗ 5-min window; only if user online
```

---

## Performance Considerations

### Encryption/Decryption
- Client-side; browser handles AES-GCM
- ~1ms per secret (Web Crypto API)

### Key Derivation
- Scrypt: ~100–300ms per unlock (intentional; prevents brute force)
- Cached in memory; no re-derivation during session

### Database Queries
- Secrets indexed by `userId` + `id`
- Metadata searchable (title, username)
- No decryption on server (O(1) complexity)

---

See also:
- [Cryptography](./cryptography.md) — Algorithm details and code examples
- [Security Model](./security-model.md) — Threat model and password concepts
- [Authentication](./authentication.md) — Session and token lifecycle
