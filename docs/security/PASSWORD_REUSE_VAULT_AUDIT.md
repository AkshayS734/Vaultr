# Password Reuse Detection: Vault Security Audit

**Audit Date:** December 28, 2025  
**Purpose:** Verify that vault password reuse detection does not violate zero-knowledge encryption principles

---

## 🔍 Audit Findings

### ✅ CONFIRMED: Zero-Knowledge Architecture Is Intact

After comprehensive code audit, **Vaultr correctly maintains zero-knowledge principles for vault passwords**:

### 1. **Vault Password Encryption Flow (SECURE ✓)**

**Client-Side (Browser):**
- User creates/edits password in vault → `buildPasswordEncryptedPayload()` creates payload
- ALL sensitive data (password, notes, etc.) → placed in `encryptedPayload`
- `encryptItem(encryptedPayload, vaultKey)` → AES-256-GCM encryption
- Only `encryptedData` (ciphertext) + `iv` sent to server

**Server-Side (Backend):**
- Receives: `{ encryptedData, iv, metadata, secretType }`
- `encryptedData` → opaque Base64 ciphertext (AES-GCM)
- Server NEVER has vault key → cannot decrypt
- Server NEVER sees plaintext passwords

**Evidence:**
- [app/lib/crypto.ts](../app/lib/crypto.ts#L540-L565): `encryptItem()` - client-side encryption only
- [app/(main)/secrets/passwords/new/page.tsx](../app/(main)/secrets/passwords/new/page.tsx#L47-L61): Encryption happens before API call
- [app/api/passwords/route.ts](../app/api/passwords/route.ts#L64-L66): Server receives only ciphertext
- [app/components/providers/VaultProvider.tsx](../app/components/providers/VaultProvider.tsx): Vault key stored only in client memory

### 2. **Password Reuse Detection (ACCOUNT PASSWORDS ONLY ✓)**

**Current Implementation:**
- `checkPasswordReuse()` in [app/lib/password-reuse.ts](../app/lib/password-reuse.ts) is used ONLY for:
  - Account authentication password changes ([change-password/route.ts](../app/api/auth/change-password/route.ts#L82))
  - Account password resets ([reset-password/route.ts](../app/api/auth/reset-password/route.ts#L106))
- Checks against `user.authHash` (argon2) and `passwordHistory` table
- Compares plaintext input against hashed account passwords using `argon2.verify()`

**NOT Used For:**
- ❌ Vault item passwords
- ❌ API keys stored in vault
- ❌ Any encrypted secrets

**Why This Is Correct:**
- Account passwords → Server must verify (argon2 hash), reuse detection possible
- Vault passwords → Server-blind (encrypted), reuse detection MUST NOT occur server-side

### 3. **Metadata Safety Validation (SECURE ✓)**

**Protection Against Leakage:**
- `validateMetadataSafety()` in [app/lib/secret-utils.ts](../app/lib/secret-utils.ts#L405-L475)
- Forbids fields: `password`, `apiKey`, `secret`, `token`, `mask`, `value`
- Rejects partial masks like `"***word"` that expose real characters
- Allows only: `passwordLength` (non-reversible), `title`, `username`, `hasNotes` (boolean)

**Server-Side Enforcement:**
- [app/api/passwords/route.ts](../app/api/passwords/route.ts#L75-L90): POST validates metadata before storage
- [app/api/passwords/[id]/route.ts](../app/api/passwords/[id]/route.ts#L123-L138): PUT validates metadata before update
- Validation errors return 400 and block save

**Evidence of Safety:**
```typescript
// SAFE metadata for password item:
{
  type: "PASSWORD",
  title: "GitHub Account",
  username: "user@example.com",
  passwordLength: 16,  // ✓ Non-reversible
  website: "github.com",
  hasNotes: true       // ✓ Boolean flag
}

// FORBIDDEN (correctly rejected):
{
  password: "actual_password",      // ❌ Real secret
  passwordMask: "***word",          // ❌ Exposes suffix
  apiKeyMask: "sk-***local"         // ❌ Exposes fragment
}
```

### 4. **No Server-Side Vault Password Inspection (SECURE ✓)**

**Searched for violations:**
```bash
grep -r "decrypt.*password" app/api/
grep -r "checkPasswordReuse.*vault" app/
grep -r "plaintext.*vault" app/
```

**Results:** ✅ No matches - server never attempts to:
- Decrypt vault passwords
- Store password fingerprints/hashes
- Check vault password reuse server-side
- Log vault password values

### 5. **Database Schema Verification (SECURE ✓)**

**`Item` table ([app/prisma/schema.prisma](../app/prisma/schema.prisma#L82-L116)):**
```prisma
model Item {
  encryptedData String  // Base64 AES-GCM ciphertext (ALL sensitive data)
  iv            String  // Base64 initialization vector
  metadata      Json?   // ONLY non-sensitive UI info
}
```

**`PasswordHistory` table (ACCOUNT PASSWORDS ONLY):**
```prisma
model PasswordHistory {
  userId       String
  passwordHash String   // argon2 hash of ACCOUNT password (not vault)
  createdAt    DateTime
}
```

**Separation Confirmed:**
- Vault passwords → `Item.encryptedData` (encrypted, server-blind)
- Account passwords → `User.authHash` + `PasswordHistory.passwordHash` (hashed, server-verified)

---

## 🎯 Threat Model Validation

| Password Type | Storage | Server Access | Reuse Detection | ✅/❌ |
|--------------|---------|---------------|-----------------|------|
| **Account password** | `User.authHash` (argon2) | Plaintext during auth | ✅ Server-side via `checkPasswordReuse()` | ✅ Correct |
| **Vault password** | `Item.encryptedData` (AES-GCM) | Ciphertext only | ❌ Server-side (impossible) | ✅ Correct |
| **Vault password** | Client memory only | N/A | 🔄 Client-side (optional, not implemented) | ⚠️ Enhancement opportunity |

---

## 🚨 Security Assertions (All Verified ✓)

### ✅ Zero-Knowledge Guarantees Maintained
- [x] Vault passwords encrypted client-side before transmission
- [x] Server never receives vault passwords in plaintext
- [x] Server cannot decrypt vault passwords (no vault key)
- [x] Metadata contains zero sensitive data (validated)
- [x] Password reuse detection only for account passwords
- [x] No logging of vault password values or events

### ✅ Encryption Boundaries Enforced
- [x] `encryptedData` contains ALL sensitive values
- [x] `metadata` contains ONLY non-sensitive UI info
- [x] Runtime validation prevents metadata leakage
- [x] API routes reject unsafe metadata
- [x] Tests validate metadata safety ([tests/metadata-validation.test.ts](../tests/metadata-validation.test.ts))

### ✅ No Violation Patterns Found
- [x] No server-side vault password decryption
- [x] No vault password fingerprints stored
- [x] No vault password hashing for comparison
- [x] No vault password reuse events logged
- [x] No plaintext exposure in logs or database

---

## 🎨 Architecture Visualization

```
┌─────────────────────────────────────────────────────────────┐
│                    ACCOUNT PASSWORDS                         │
│  (Server can verify, reuse detection possible)              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Input → argon2.hash() → User.authHash                │
│               ↓                                              │
│  checkPasswordReuse(userId, newPassword)                    │
│               ↓                                              │
│  argon2.verify(authHash, newPassword) ✓                     │
│  argon2.verify(historyHash, newPassword) ✓                  │
│               ↓                                              │
│  Store in PasswordHistory if changed                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     VAULT PASSWORDS                          │
│  (Server-blind, reuse detection MUST be client-only)       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Input → buildEncryptedPayload({password: "..."})     │
│               ↓                                              │
│  encryptItem(payload, vaultKey) → {encryptedData, iv}      │
│               ↓                                              │
│  Send to server: POST /api/passwords                        │
│               ↓                                              │
│  Server stores CIPHERTEXT only (cannot read)                │
│                                                              │
│  ❌ checkPasswordReuse() NEVER called for vault items       │
│  ✅ Server remains zero-knowledge                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 Optional Enhancement: Client-Side Reuse Warning

### Recommendation: Add Client-Side Only Detection

**Safe Implementation (does not violate zero-knowledge):**

```typescript
// In VaultProvider or password creation form (CLIENT-SIDE ONLY)
async function checkVaultPasswordReuse(
  newPassword: string,
  vaultKey: CryptoKey,
  existingItems: EncryptedItem[]
): Promise<{ isReused: boolean; matches: number }> {
  let matches = 0;
  
  for (const item of existingItems) {
    try {
      // Decrypt in memory only
      const decrypted = await decryptItem(
        item.encryptedData,
        item.iv,
        vaultKey
      );
      
      if (isPasswordEncryptedPayload(decrypted)) {
        // Simple comparison (consider adding fuzzy matching)
        if (decrypted.password === newPassword) {
          matches++;
        }
      }
    } catch {
      // Skip items that fail to decrypt
      continue;
    }
  }
  
  return { isReused: matches > 0, matches };
}
```

**UX Implementation:**
- Show warning banner: "⚠️ This password is already used in {count} other items"
- Suggest using password generator
- Allow user to proceed (warning, not blocker)
- Never send reuse data to server

**Benefits:**
- Helps users maintain unique passwords
- No server-side changes required
- No metadata or logging
- Fully client-side

**Tests to Add:**
```typescript
// tests/vault-password-reuse.test.ts
describe('Client-Side Vault Password Reuse', () => {
  it('should detect reuse across vault items in memory', ...)
  it('should NOT send reuse data to server', ...)
  it('should NOT persist reuse warnings', ...)
  it('should clear data from memory after check', ...)
})
```

---

## 📋 Action Items

### ✅ COMPLETED (Current State)
- [x] Vault passwords encrypted end-to-end (client → server → database)
- [x] Server-side reuse detection correctly limited to account passwords only
- [x] Metadata validation prevents sensitive data leakage
- [x] Zero-knowledge architecture verified and intact
- [x] No security violations found

### 🔄 OPTIONAL ENHANCEMENTS (Safe to Implement)
- [ ] Add client-side vault password reuse warning (non-blocking)
- [ ] Implement fuzzy password matching (e.g., "Password123" vs "password123")
- [ ] Add breach detection via Have I Been Pwned API (k-anonymity)
- [ ] Client-side password strength indicator for vault items
- [ ] Export test suite to verify zero-knowledge guarantees

### ❌ PROHIBITED ACTIONS (Never Implement)
- ❌ Do NOT add server-side vault password reuse checks
- ❌ Do NOT store vault password hashes or fingerprints
- ❌ Do NOT log vault password values or reuse events
- ❌ Do NOT decrypt vault data on server for any reason
- ❌ Do NOT add metadata fields that could leak secrets

---

## 🔐 Security Conclusion

**VERDICT: ✅ SECURE - No Violations Detected**

Vaultr's password reuse detection is **correctly implemented** and **does not compromise** the zero-knowledge architecture:

1. **Account passwords** (authentication) → Server-side reuse detection ✅
2. **Vault passwords** (encrypted secrets) → No server-side detection ✅
3. **Encryption boundaries** → Properly enforced ✅
4. **Metadata safety** → Validated and secure ✅

The distinction between account passwords and vault passwords is **architecturally sound** and **properly maintained** throughout the codebase.

---

**Audit Sign-Off:**  
AI Security Audit - December 28, 2025  
No security violations found. Zero-knowledge guarantees intact.
