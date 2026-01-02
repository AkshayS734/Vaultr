# CSRF Protection

How Vaultr prevents Cross-Site Request Forgery attacks.

## Overview

CSRF attacks trick authenticated users into making unintended requests. Vaultr uses **double-submit CSRF token** pattern to prevent this.

---

## Attack Example

### Without CSRF Protection

```
Attacker's site (attacker.com):
  <img src="https://vaultr.app/api/vault/password/delete?id=123" />

User is logged into Vaultr, visits attacker.com:
  1. Browser sends GET with user's Vaultr cookies
  2. Vaultr sees authenticated user
  3. Password with ID 123 deleted (user didn't intend this!)
```

### With CSRF Protection

```
POST /api/vault/password/delete

Request headers:
  Cookie: csrfToken=abc123xyz
  X-CSRF-Token: abc123xyz  ← Must match cookie

Vaultr checks:
  Cookie csrfToken == Header X-CSRF-Token?
  
If attacker.com tries to make request:
  1. Can include cookies (browser auto-includes)
  2. Cannot include custom headers (CORS policy blocks)
  3. Request fails (token mismatch)
```

---

## Double-Submit CSRF Token Pattern

### 1. Get CSRF Token

Browser requests CSRF token before making state-changing requests:

```typescript
// GET /api/auth/csrf-token
export async function GET(req: Request) {
  const token = crypto.randomBytes(32).toString('hex')
  
  // Store in cookie (httpOnly=false so JavaScript can read)
  const response = NextResponse.json({ token })
  
  response.headers.append(
    'Set-Cookie',
    cookie.serialize('csrfToken', token, {
      httpOnly: false,  // ← JavaScript must read it
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60  // 1 hour
    })
  )
  
  return response
}
```

### 2. Set Header & Submit Form

Client reads CSRF token from cookie, includes in request header:

```typescript
// Frontend code
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrfToken='))
  ?.split('=')[1]

const response = await fetch('/api/vault/password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken  // ← Custom header
  },
  body: JSON.stringify({
    encryptedData: { ... },
    metadata: { ... }
  })
})
```

### 3. Server Validates Token

```typescript
// POST /api/vault/password
export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (!auth.success) return auth.response
  
  // Extract token from cookie
  const cookieToken = req.cookies.get('csrfToken')?.value
  
  // Extract token from header
  const headerToken = req.headers.get('x-csrf-token')
  
  // Validate match
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json(
      { error: 'CSRF validation failed' },
      { status: 403 }
    )
  }
  
  // Token valid; proceed with request
  const body = await req.json()
  // ... create secret
}
```

---

## Token Security

### Generation

```typescript
const token = crypto.randomBytes(32).toString('hex')
// Result: 64-character hex string (256 bits of entropy)
```

### Storage

| Location | httpOnly | Secure | SameSite |
|----------|----------|--------|----------|
| **Cookie** | false | true (prod) | strict |
| **Header** | N/A (JS) | N/A (JS) | N/A (JS) |

**Why httpOnly=false?**
- JavaScript needs to read CSRF token from cookie
- XSS vulnerability can still steal token (but then attacker can make requests directly)
- SameSite=strict prevents cross-site access

### Expiry

CSRF token expires with session (1 hour in example above).

If token expired:
```
POST /api/vault/password
Headers: X-CSRF-Token: old-token

Response: 403 Forbidden (CSRF validation failed)

Client refreshes token:
  GET /api/auth/csrf-token
  Returns new token
  
Retry POST with new token:
  Success
```

---

## Protected Endpoints

CSRF protection required on all **state-changing** requests:

| Method | Endpoint | CSRF? | Reason |
|--------|----------|-------|--------|
| POST | /api/vault/password | ✅ | Creates secret |
| PUT | /api/vault/password/:id | ✅ | Updates secret |
| DELETE | /api/vault/password/:id | ✅ | Deletes secret |
| POST | /api/auth/logout | ✅ | Ends session |
| POST | /api/auth/logout-all | ✅ | Ends all sessions |
| POST | /api/vault/password/export | ✅ | Exports secrets |
| GET | /api/vault/passwords | ❌ | Reads only |
| GET | /api/auth/csrf-token | ❌ | Generates token |

---

## Protection Against CSRF Bypasses

### 1. Attacker Tries GET Request

**Attack**: Attacker makes `<img>` tag with GET request.

```html
<img src="https://vaultr.app/api/vault/password?action=delete&id=123" />
```

**Prevention**:
- ✅ Only GET requests are state-changing (should use POST/DELETE)
- ✅ Server rejects GET on sensitive endpoints
- ✅ Client only makes POST for state changes

### 2. Attacker Tries to Omit CSRF Token

**Attack**: Attacker doesn't include CSRF token header.

```javascript
fetch('https://vaultr.app/api/vault/password', {
  method: 'POST',
  body: JSON.stringify({ ... })
  // No X-CSRF-Token header
})
```

**Prevention**:
- ✅ Server rejects requests without matching token
- ✅ Browser Same-Origin Policy prevents cross-site requests anyway

### 3. Attacker Tries to Predict Token

**Attack**: Attacker guesses CSRF token value.

```javascript
const guessedToken = "0000000000..."  // 256-bit random = impossible to guess
```

**Prevention**:
- ✅ Token is cryptographically random (256 bits)
- ✅ Brute-forcing 2^256 possibilities is infeasible
- ✅ Token expires after 1 hour

### 4. Attacker Tries CORS to Bypass Header Validation

**Attack**: Attacker tries to send custom headers cross-origin.

```javascript
// attacker.com
fetch('https://vaultr.app/api/vault/password', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': 'whatever'  // Won't be sent
  }
})
```

**Prevention**:
- ✅ CORS policy prevents custom headers cross-origin
- ✅ Browser blocks request before it reaches server
- ✅ Only same-origin requests can set custom headers

---

## Implementation Checklist

Before shipping a state-changing endpoint:

- [ ] Endpoint uses POST/PUT/DELETE (not GET)
- [ ] CSRF token validated in middleware
- [ ] Token extracted from header (X-CSRF-Token)
- [ ] Cookie token and header token must match
- [ ] Token generation uses crypto.randomBytes
- [ ] Token cookie is httpOnly=false, secure, sameSite=strict
- [ ] Token expiry enforced
- [ ] Error message doesn't leak token info
- [ ] Tests verify CSRF rejection

---

## Testing CSRF Protection

### Unit Tests

```typescript
test('rejects POST without CSRF token', async () => {
  const response = await fetch('/api/vault/password', {
    method: 'POST',
    body: JSON.stringify({ ... })
    // No X-CSRF-Token header
  })
  
  expect(response.status).toBe(403)
})

test('rejects POST with mismatched CSRF token', async () => {
  const response = await fetch('/api/vault/password', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': 'different-token'
    },
    body: JSON.stringify({ ... })
  })
  
  expect(response.status).toBe(403)
})

test('accepts POST with matching CSRF token', async () => {
  const session = await createTestSession()
  
  const response = await fetch('/api/vault/password', {
    method: 'POST',
    headers: {
      'Cookie': `csrfToken=${session.csrfToken}`,
      'X-CSRF-Token': session.csrfToken
    },
    body: JSON.stringify({ ... })
  })
  
  expect(response.status).not.toBe(403)
})
```

---

## SameSite Cookie Attribute

Modern browsers provide additional CSRF protection via **SameSite** attribute:

| SameSite Value | Behavior |
|---|---|
| **Strict** | Cookie only sent in same-site requests (strictest) |
| **Lax** | Cookie sent in same-site + top-level navigation (default) |
| **None** | Cookie sent everywhere (requires Secure) |

Vaultr uses `sameSite: 'strict'`:

```typescript
response.headers.append(
  'Set-Cookie',
  cookie.serialize('csrfToken', token, {
    sameSite: 'strict'  // ← Cookies never sent cross-site
  })
)
```

---

## Advanced: SameSite Insufficiency

**Why SameSite alone isn't enough**:
- Older browsers don't support it
- Some edge cases (POST from same site legitimately intended to be cross-origin)
- Defense-in-depth: Multiple layers better than one

**Therefore**: CSRF token validation + SameSite = robust protection.

---

## Future Improvements

- [ ] Implement refresh tokens (get new CSRF token on each refresh)
- [ ] Add replay protection (CSRF token can only be used once)
- [ ] Per-request tokens (rotate after each state-changing request)
- [ ] Account recovery requires CSRF + email verification

---

See also:
- [Middleware Security](./middleware-bypass.test.ts) — CSRF middleware tests
- [Security Model](./security-model.md) — Threat model
- [Authentication](./authentication.md) — Session security
