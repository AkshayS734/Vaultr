# Password Model

Comprehensive explanation of password-related concepts in Vaultr: stored secrets, recovery flows, strength analysis, and reuse detection.

## Overview

Vaultr manages **two entirely separate password systems**:

| Concept | Storage | Recovery | Encryption | Use |
|---------|---------|----------|-----------|-----|
| **Login Password** | Argon2 hash on server | Email reset → new password | Not used for encryption | Authentication only |
| **Master Password** | Never stored anywhere | Not recoverable | Sole source of encryption keys | Vault unlocking |
| **Stored Secrets** | AES-GCM encrypted | Restore from backup | Encrypted with vault key | Passwords user saves |

---

## Stored Secrets: Passwords

### Structure

Each stored password contains:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-id",
  "encryptedData": {
    "ciphertext": "hex-encoded encrypted JSON",
    "iv": "hex-encoded 16 bytes",
    "authTag": "hex-encoded 16 bytes"
  },
  "metadata": {
    "title": "Bank Account",
    "username": "john@example.com",
    "passwordLength": 24,
    "hasNotes": false,
    "category": "Finance"
  },
  "hmac": "hex-encoded HMAC-SHA256",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

### Encryption

`encryptedData` contains:

```json
{
  "password": "actual-password-string",
  "notes": "optional notes about this password",
  "website": "https://bank.example.com",
  "customFields": { "securityQuestion": "answer" }
}
```

Encrypted with AES-256-GCM using vault key; server never decrypts.

### Metadata Safety

Metadata safe for database leak (no secret information):

✅ `title` — "My Bank Password"  
✅ `username` — "john@example.com"  
✅ `passwordLength` — 24 (length only, not actual password)  
✅ `hasNotes` — true/false  

❌ `password` — Forbidden  
❌ `passwordMask` — "MyBank••••" Forbidden (reveals partial password)  
❌ `passwordHint` — Forbidden (may expose patterns)  

Validation enforced by `validateMetadataSafety()`:

```typescript
const metadata = {
  title: "My Bank",
  password: "secret-123"  // ← Throws error
}

validateMetadataSafety(metadata)
// Error: Metadata field "password" must not be stored in plaintext.
```

---

## Password Strength Analysis

### Strength Scoring

Passwords analyzed for:
1. **Length** — Longer = stronger
2. **Character diversity** — uppercase, lowercase, digits, symbols
3. **Entropy** — Randomness score
4. **Common patterns** — Dictionary words, sequential chars
5. **Breach status** — Checked against HaveIBeenPwned

### Strength Levels

| Score | Level | Color | Password Example |
|-------|-------|-------|------------------|
| 0–20 | Very Weak | Red | `password`, `123456` |
| 21–40 | Weak | Orange | `mypassword1`, `letmein` |
| 41–60 | Fair | Yellow | `Pass123!`, `correct-horse` |
| 61–80 | Strong | Light Green | `aB3$xY9@mK2`, auto-generated (12 char) |
| 81–100 | Very Strong | Green | `aB3$xY9@mK2#nL5!`, auto-generated (16+ char) |

### Calculation

```typescript
// From app/lib/password-strength.ts
export function calculatePasswordStrength(password: string): {
  score: number;
  level: 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong';
  feedback: string[];
} {
  let score = 0
  const feedback = []
  
  // Length scoring
  if (password.length < 8) {
    feedback.push('Password is too short (minimum 8 characters)')
  } else if (password.length < 12) {
    score += 20
    feedback.push('Increase length to 12+ characters')
  } else if (password.length < 16) {
    score += 30
  } else {
    score += 40
  }
  
  // Diversity scoring
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /\d/.test(password)
  const hasSymbol = /[!@#$%^&*]/.test(password)
  
  const types = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length
  score += types * 10
  
  if (!hasSymbol) feedback.push('Add special characters (!@#$%...)')
  if (!hasUpper) feedback.push('Add uppercase letters')
  if (!hasDigit) feedback.push('Add numbers')
  
  // Entropy check
  const entropy = calculateEntropy(password)
  if (entropy < 40) feedback.push('Use more random characters')
  
  // Common patterns
  if (hasCommonPattern(password)) {
    score = Math.max(score - 20, 0)
    feedback.push('Avoid common patterns (123, qwerty, etc.)')
  }
  
  return {
    score: Math.min(score, 100),
    level: getLevelFromScore(score),
    feedback
  }
}
```

### Dashboard Display

Dashboard shows password strength summary:

```
Passwords Overview
──────────────────────
Very Strong (5)  ████████████████ 50%
Strong (3)       █████████ 30%
Fair (1)         ███ 10%
Weak (1)         ███ 10%

Recommended Actions:
• 3 weak passwords should be updated
• 1 password found in breach (red flag)
```

---

## Password Reuse Detection

### Vault Reuse Check

Vaultr detects when same password stored multiple times:

```typescript
// From app/lib/vault-password-reuse.ts
export function detectVaultReuse(
  passwords: DecryptedPassword[]
): ReusedPassword[] {
  const passwordMap = new Map<string, string[]>()
  
  // Group by password hash
  for (const pwd of passwords) {
    const hash = sha256(pwd.password)
    if (!passwordMap.has(hash)) {
      passwordMap.set(hash, [])
    }
    passwordMap.get(hash)!.push(pwd.id)
  }
  
  // Find duplicates
  const reused: ReusedPassword[] = []
  for (const [hash, ids] of passwordMap.entries()) {
    if (ids.length > 1) {
      reused.push({
        passwordHash: hash,
        count: ids.length,
        titles: ids.map(id => passwords.find(p => p.id === id)?.title),
        severity: 'medium'
      })
    }
  }
  
  return reused
}
```

Used in [/dashboard](http://localhost:3000/dashboard):

```
⚠️  Password Reuse Detected
You've used the same password for 3 accounts:
• Bank Login
• Savings Account
• Investment Portal

Recommended: Generate unique password for each site
```

### Breach Reuse Check

When password found in HaveIBeenPwned:

```
🚨 Breach Alert
Your password "MyBank123" was found in a known data breach.

Used in 2 accounts:
• Bank Account
• Secondary Bank

Action: Change this password immediately on all accounts
```

---

## Generator

### Generate Random Password

Generates cryptographically secure random passwords:

```typescript
// From app/lib/password-generator.ts
export function generatePassword(options: {
  length?: number        // 8–128, default 16
  useUppercase?: boolean // default true
  useLowercase?: boolean // default true
  useNumbers?: boolean   // default true
  useSymbols?: boolean   // default true
  excludeAmbiguous?: boolean // exclude i, l, O, 0, default false
}): string {
  const DEFAULT_LENGTH = 16
  
  let chars = ''
  if (options.useLowercase) chars += 'abcdefghijklmnopqrstuvwxyz'
  if (options.useUppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (options.useNumbers) chars += '0123456789'
  if (options.useSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  if (options.excludeAmbiguous) {
    chars = chars.replace(/[iloO0]/g, '')
  }
  
  let password = ''
  const randomValues = crypto.getRandomValues(
    new Uint8Array(options.length || DEFAULT_LENGTH)
  )
  
  for (let i = 0; i < randomValues.length; i++) {
    password += chars[randomValues[i] % chars.length]
  }
  
  return password
}
```

### UI: [/generator](http://localhost:3000/generator)

```
Password Generator
──────────────────
Length: [16     ] ← Range slider
☑ Uppercase    ☑ Lowercase
☑ Numbers      ☑ Symbols
☑ Exclude ambiguous (i, l, O, 0)

Generated: aB3$xY9@mK2#nL5!

[Copy to clipboard]  [Save to vault]
```

---

## Password Health Engine

### Dashboard Summary

Dashboard shows aggregated health metrics:

```
Vault Security Summary
──────────────────────
Total Passwords:    47
Very Strong:        28 (60%)
Strong:             12 (25%)
Fair:               5 (10%)
Weak:               2 (4%)

⚠️  Issues Found
──────────────────
Reused Passwords:   3 accounts
Breached:           1 password
Weak:               2 passwords

Recommended Actions:
1. Update 1 breached password immediately
2. Change 3 reused passwords
3. Strengthen 2 weak passwords
```

### Per-Password Audit

[/secrets/passwords](http://localhost:3000/secrets/passwords) shows details:

```
Bank Login
──────────
Password Strength: Strong ███████░░ 75%
Username: john@example.com
Created: 2024-01-15

⚠️  Reused: Also used for "Secondary Bank"
🔴 Breach Status: Not found in known breaches

Actions:
[Copy]  [View]  [Edit]  [Delete]
```

---

## Password Recovery Flows

### Forgot Login Password

User forgets login password (recovery possible):

```
1. User clicks "Forgot password?" on login
   ↓
2. Server sends reset link to email
   (link contains time-limited token)
   ↓
3. User clicks link (expires in 1 hour)
   ↓
4. User enters new login password
   ↓
5. Server hashes with Argon2, stores
   ↓
6. User can log in with new password
```

**Master password unchanged** (encryption keys stay valid).

### Forgot Master Password

User forgets master password (recovery impossible):

```
Cannot be recovered:
• Master password never stored
• Vault key encrypted with master password
• Without master password, vault permanently locked
• All secrets permanently inaccessible

User options:
1. Create new account (lose old vault)
2. Wait for account deletion (30 days)
```

**This is intentional design**: Master password is non-recoverable by definition.

---

## Change Flows

### Change Login Password

User logged in, wants new login password:

```
1. User provides current login password
2. Server verifies Argon2 hash
3. User provides new login password
4. Server hashes with Argon2
5. Database updated
6. All sessions continue (login password separate from tokens)
```

Master password and vault key unchanged.

### Change Master Password

User wants different master password:

```
1. User provides current master password
2. Client derives KEK, decrypts vault key
3. User provides new master password
4. Client derives NEW KEK
5. Client encrypts vault key with NEW KEK
6. Database updated (encryptedVaultKey replaced)
```

Process:
- Decrypt vault key with old master password ✓
- Re-encrypt vault key with new master password ✓
- All secrets still encrypted with old vault key ✓

**Vault key unchanged; only its encryption changes.**

---

## Security Checklist

Before storing passwords:

- [ ] Master password used for encryption, not login
- [ ] Login password used for authentication only
- [ ] Password strength checked before storage
- [ ] Breach status checked (HIBP)
- [ ] Reuse detected and warned
- [ ] Metadata safe (no plaintext secrets)
- [ ] Encrypted with AES-GCM + vault key
- [ ] HMAC computed for integrity

---

See also:
- [Security Model](./security-model.md) — Password concepts, threat model
- [Vault Architecture](./vault-architecture.md) — How passwords encrypted/stored
- [Cryptography](./cryptography.md) — Encryption algorithms
- [API Overview](./api-overview.md) — Password API endpoints
