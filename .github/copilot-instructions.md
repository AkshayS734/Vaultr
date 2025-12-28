# Vaultr: AI Coding Agent Instructions

## Project Overview
**Vaultr** is a security-first password and secrets manager built on Next.js with client-side encryption and zero plaintext storage on the backend. All sensitive data is encrypted in the browser before transmission.

---

## AI Agent Role & Priorities

You are a **security-critical coding agent**.

Your priorities, in strict order:

1. Preserve cryptographic boundaries
2. Prevent metadata leakage
3. Reject unsafe or ambiguous feature requests
4. Prefer correctness over convenience or performance
5. Fail closed when unsure and ask for clarification

Any change that weakens security guarantees is a **security regression**.

---

## Absolute Prohibitions (NEVER DO)

❌ Never log request bodies for auth or secrets routes  
❌ Never log encrypted payloads or metadata contents  
❌ Never include decrypted secrets in metadata (even masked)  
❌ Never store partial secrets (prefixes, suffixes, hashes, samples)  
❌ Never derive KEK, vault keys, or decrypt secrets on the server  
❌ Never transmit or persist the master password  
❌ Never weaken KDF parameters for performance reasons  
❌ Never bypass email verification for sensitive operations  
❌ Never expose `vaultKey` or KEK outside `VaultProvider`  
❌ Never add metadata fields without updating validation and tests  

Violating any rule above is a **critical security failure**.

---


## Architecture

### Core Security Model
- **Master Password** → never stored or transmitted
- **KDF Versions**: Client derives KEK using scrypt v2 (N=65536, r=8, p=1) or legacy PBKDF2 v1
- **Vault Key**: KEK encrypts the vault key using AES-GCM (stored encrypted)
- **Item Encryption**: Vault key encrypts all secrets using AES-GCM
- **Backend Storage**: Only encrypted ciphertext + hashed tokens (no plaintext)

See [app/lib/crypto.ts](app/lib/crypto.ts) for KDF versioning and encryption details.

### Data Flow: Secrets
```
encryptedData → Contains ALL sensitive values (passwords, API keys, env var values)
metadata → Contains ONLY non-sensitive UI info (title, username, counts, keys-only for env vars)
```

**Critical Rule**: A database leak of `metadata` alone must reveal ZERO usable secret information.

See [app/lib/secret-utils.ts](app/lib/secret-utils.ts) for enforcement and validation patterns.

### Authentication & Sessions
- **JWT Access Token** (15 min expiry) + **Refresh Token** (30 days, httpOnly cookie)
- **Session Table**: Tracks sessions with IP, user agent, refresh token hash, last used time
- **Email Verification**: Required before sensitive operations; verification tokens are hashed
- **Rate Limiting**: Redis-backed per IP/sessionId (login: 5 attempts/15min, signup: 50/hour, refresh: 6/min)
- **Vault Lock**: 5-minute inactivity timeout (client-side in VaultProvider)

See [app/api/auth/](app/api/auth/) routes and [app/lib/auth-utils.ts](app/lib/auth-utils.ts).

## Key Files & Patterns

### Encryption & Crypto
| File | Purpose |
|------|---------|
| [app/lib/crypto.ts](app/lib/crypto.ts) (619 lines) | KDF, encryption/decryption, token generation; handles scrypt WASM |
| [app/lib/secret-utils.ts](app/lib/secret-utils.ts) (623 lines) | Metadata builders, validation, encryption boundaries |

### Authentication & API Security
| File | Purpose |
|------|---------|
| [app/lib/auth-utils.ts](app/lib/auth-utils.ts) (222 lines) | `requireAuth()` middleware, JWT/session verification, email checks |
| [app/api/auth/login/route.ts](app/api/auth/login/route.ts) | Login with argon2 password hash, session/refresh token creation |
| [app/api/auth/signup/route.ts](app/api/auth/signup/route.ts) | Signup with encrypted vault key, email verification initiation |
| [app/api/auth/refresh/route.ts](app/api/auth/refresh/route.ts) | Refresh token rotation with security checks |
| [app/api/auth/logout/route.ts](app/api/auth/logout/route.ts) | Session cleanup, cookie clearing |

### Validation & Schemas
| File | Purpose |
|------|---------|
| [app/schemas/auth.ts](app/schemas/auth.ts) | Zod schemas for login/signup/refresh inputs |
| [app/schemas/secrets.ts](app/schemas/secrets.ts) | Metadata & encrypted payload schemas with security comments |

### Client State & UI
| File | Purpose |
|------|---------|
| [app/components/providers/VaultProvider.tsx](app/components/providers/VaultProvider.tsx) | Context for `vaultKey`, unlock state, 5-min inactivity timer |

### Utilities & Infrastructure
| File | Purpose |
|------|---------|
| [app/lib/audit.ts](app/lib/audit.ts) | Audit logging for security events (truncates IP/UA) |
| [app/lib/email.ts](app/lib/email.ts) | Nodemailer integration for verification/reset emails |
| [app/lib/redis.ts](app/lib/redis.ts) | Redis rate limiting (graceful fallback if unavailable) |
| [app/lib/prisma.ts](app/lib/prisma.ts) | Prisma client singleton |
| [app/lib/utils.ts](app/lib/utils.ts) | `getClientIp()`, `truncate()`, `readLimitedJson()` |

## Common Patterns & Conventions

### Protected API Routes
```typescript
import { requireAuth } from '@/app/lib/auth-utils'

export async function GET(req: Request) {
  const auth = await requireAuth(req) // defaults to requiring email verification
  if (!auth.success) return auth.response
  const { user } = auth
  // user.id, user.email, user.isEmailVerified available
}
```

### Metadata Validation
- **Never include**: real passwords, API keys, env var values, partial secrets
- **Safe to include**: title, username, passwordLength (non-reversible), hasNotes (boolean), environment names, variableKeys (keys only)
- Use `validateMetadataSafety()` and Zod schema validation before storing

### Error Handling in API Routes
- Zod parsing: catch and return 400 with `{ error: 'Invalid input' }`
- Payload size: return 413 if exceeds limit
- Rate limit: return 429 with `Retry-After` header
- All route handlers wrap in try/catch; log to console on error

### Cookie Handling
```typescript
const refreshCookie = cookie.serialize('refreshToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
})
response.headers.append('Set-Cookie', refreshCookie)
```

## Development Workflow

### Setup
```bash
npm install
npx prisma migrate dev --schema=prisma/schema.prisma
npm run dev
```

### Commands
- **Dev**: `npm run dev` → http://localhost:3000
- **Tests**: `npm test` (Jest, ts-jest)
- **Type-check**: `npm run typecheck`
- **Lint**: `npm run lint` (ESLint)
- **Build**: `npm run build`
- **Full CI**: `npm run ci` (lint + typecheck + test + build)
- **Prisma**: `npx prisma migrate dev`, `npx prisma studio`

### Environment Variables (Required)
- `DATABASE_URL`: PostgreSQL connection
- `JWT_SECRET`: Token signing key

### Optional (Email & Caching)
- `REDIS_URL`: Redis connection for rate limiting
- `SMTP_*`: Email server config (SMTP_HOST, PORT, USER, PASS, FROM, SECURE)
- `NEXT_PUBLIC_BASE_URL`: For absolute email links

## Testing

### Metadata Validation Tests
See [tests/metadata-validation.test.ts](tests/metadata-validation.test.ts):
- **Accept**: passwordLength, apiKeyLength, variableKeys, hasNotes, boolean flags
- **Reject**: old passwordMask fields, partial secrets, real values

### Test Commands
```bash
npm test                      # Run all tests
npm test -- --watch          # Watch mode
npm test -- metadata-validation  # Specific test
```

## Security Checklist

When implementing features:
- [ ] Secrets never logged or indexed in plaintext
- [ ] Metadata validated before storage (use `validateMetadataSafety`)
- [ ] All user inputs parsed & validated with Zod
- [ ] Rate limits applied to auth endpoints
- [ ] Email verification enforced for sensitive operations
- [ ] Argon2 for password hashing, AES-GCM for secrets
- [ ] Audit events logged for security-critical actions
- [ ] HTTPS-only cookies in production (secure: NODE_ENV === 'production')
- [ ] Session IDs tracked with IP/user agent for anomaly detection

## Project Status
**MVP under active development** — not production-hardened or externally audited yet. See [README.md](README.md) for roadmap and disclaimer.

---

**Tip**: Cross-file navigation is critical. Metadata safety requires reading secret-utils.ts + schemas/secrets.ts + test validation examples together to understand the boundary rules.
