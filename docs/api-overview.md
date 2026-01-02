# API Overview

Complete reference for Vaultr's REST API endpoints, authentication, and error handling.

## Authentication

All protected endpoints require:
- **Authorization header**: `Bearer <access_token>`
- **Access token**: Valid JWT (15-minute expiry)
- **Refresh mechanism**: Use refresh token to get new access token

---

## Auth Endpoints

### POST /api/auth/signup

Create new user account.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "login-password-123",
  "masterPassword": "master-password-456",
  "encryptedVaultKey": {
    "ciphertext": "hex-encoded...",
    "iv": "hex-encoded...",
    "authTag": "hex-encoded..."
  }
}
```

**Response** (201):
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "message": "User created; check email for verification link"
}
```

**Errors**:
- `400` — Invalid input (Zod validation failed)
- `409` — Email already registered
- `429` — Too many signup attempts from this IP (rate limit)

---

### POST /api/auth/login

Authenticate user and create session.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "login-password-123"
}
```

**Response** (200):
```json
{
  "accessToken": "eyJhbGc...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "emailVerified": true
  }
}
```

**Headers**: Sets `refreshToken` in httpOnly cookie.

**Errors**:
- `401` — Invalid email or password
- `403` — Email not verified
- `429` — Rate limit (5 attempts per 15 minutes)

---

### POST /api/auth/refresh

Rotate access token using refresh token.

**Request**: No body (uses httpOnly cookie)

**Response** (200):
```json
{
  "accessToken": "eyJhbGc..."
}
```

**Headers**: Updates `refreshToken` cookie (rotation).

**Errors**:
- `401` — No refresh token, expired, or device mismatch
- `429` — Too many refresh attempts (6 per minute)

---

### POST /api/auth/logout

Logout current session.

**Request**:
```
Authorization: Bearer <access_token>
```

**Response** (200):
```json
{
  "message": "Logged out"
}
```

**Headers**: Clears `refreshToken` cookie.

**Errors**:
- `401` — Invalid or missing token

---

### POST /api/auth/logout-all

Logout all devices (requires email verification).

**Request**:
```
Authorization: Bearer <access_token>
```

**Response** (200):
```json
{
  "message": "Logged out from all devices"
}
```

**Errors**:
- `401` — Invalid token
- `403` — Email not verified

---

### POST /api/auth/request-verification-email

Request new email verification link.

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response** (200):
```json
{
  "message": "Verification email sent"
}
```

**Errors**:
- `404` — User not found
- `400` — Email already verified
- `429` — Rate limit (5 requests per hour)

---

### GET /api/auth/csrf-token

Get CSRF token for state-changing requests.

**Request**:
```
GET /api/auth/csrf-token
```

**Response** (200):
```json
{
  "token": "abc123def456..."
}
```

**Headers**: Sets `csrfToken` cookie.

---

## Vault Endpoints

### GET /api/vault/passwords

List all passwords for authenticated user.

**Request**:
```
Authorization: Bearer <access_token>
```

**Response** (200):
```json
{
  "passwords": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "encryptedData": {
        "ciphertext": "hex...",
        "iv": "hex...",
        "authTag": "hex..."
      },
      "metadata": {
        "title": "Bank Account",
        "username": "john@example.com",
        "passwordLength": 24,
        "hasNotes": false
      },
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

**Query Params**:
- `skip=0` — Pagination offset
- `take=20` — Limit (max 100)
- `search=bank` — Filter by title/username (metadata search)

**Errors**:
- `401` — Invalid or missing token
- `400` — Invalid pagination params

---

### POST /api/vault/password

Create new password.

**Request**:
```
Authorization: Bearer <access_token>
X-CSRF-Token: <token_from_cookie>
Content-Type: application/json
```

```json
{
  "encryptedData": {
    "ciphertext": "hex-encoded encrypted JSON",
    "iv": "hex-encoded 16 bytes",
    "authTag": "hex-encoded 16 bytes"
  },
  "metadata": {
    "title": "Bank Account",
    "username": "john@example.com",
    "passwordLength": 24,
    "hasNotes": false
  },
  "hmac": "hex-encoded SHA256"
}
```

**Response** (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Errors**:
- `400` — Invalid input (Zod validation, metadata safety)
- `401` — Invalid token
- `403` — CSRF token mismatch
- `413` — Payload too large

**Validation**:
- Metadata validated with `validateMetadataSafety()`
- HMAC verified
- Encrypted data size limits enforced

---

### PUT /api/vault/password/:id

Update existing password.

**Request**:
```
Authorization: Bearer <access_token>
X-CSRF-Token: <token_from_cookie>
```

Same body as POST `/api/vault/password`.

**Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Errors**:
- `404` — Password not found or user doesn't own it
- `400` — Invalid input
- `401` — Invalid token
- `403` — CSRF token mismatch

---

### DELETE /api/vault/password/:id

Delete password.

**Request**:
```
Authorization: Bearer <access_token>
X-CSRF-Token: <token_from_cookie>
```

**Response** (200):
```json
{
  "message": "Password deleted"
}
```

**Errors**:
- `404` — Password not found
- `401` — Invalid token
- `403` — CSRF token mismatch

---

### GET /api/vault/password/:id

Get single password.

**Request**:
```
Authorization: Bearer <access_token>
```

**Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "encryptedData": { ... },
  "metadata": { ... },
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

**Errors**:
- `404` — Password not found
- `401` — Invalid token

---

## API Keys Endpoints

### GET /api/vault/api-keys
### POST /api/vault/api-key
### PUT /api/vault/api-key/:id
### DELETE /api/vault/api-key/:id

Similar structure to passwords.

**Metadata schema**:
```json
{
  "title": "AWS Credentials",
  "service": "AWS",
  "apiKeyLength": 32,
  "hasNotes": false
}
```

---

## Environment Variables Endpoints

### GET /api/vault/env-vars
### POST /api/vault/env-var
### PUT /api/vault/env-var/:id
### DELETE /api/vault/env-var/:id

Similar structure to passwords.

**Metadata schema**:
```json
{
  "variableName": "DATABASE_URL",
  "environment": "production",
  "variableLength": 50,
  "hasNotes": true
}
```

---

## Utility Endpoints

### POST /api/passwords/check-breach

Check if password found in known breaches.

**Request**:
```json
{
  "password": "my-password-123"
}
```

**Response** (200):
```json
{
  "breached": false,
  "count": 0
}
```

If breached:
```json
{
  "breached": true,
  "count": 5  // Found in 5 breaches
}
```

**Security**: Only sends first 5 characters of SHA-1 hash to HaveIBeenPwned (k-anonymity).

**Errors**:
- `400` — Invalid password
- `429` — Rate limit (if HIBP unavailable)

---

### POST /api/passwords/generate

Generate random password.

**Request**:
```json
{
  "length": 16,
  "useUppercase": true,
  "useLowercase": true,
  "useNumbers": true,
  "useSymbols": true,
  "excludeAmbiguous": false
}
```

**Response** (200):
```json
{
  "password": "aB3$xY9@mK2#nL5!"
}
```

**Validation**:
- Length: 8–128 (default 16)
- At least one character type selected

---

## Error Handling

### Standard Error Format

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Common Status Codes

| Code | Meaning | Retry? |
|------|---------|--------|
| 400 | Bad Request (validation) | No |
| 401 | Unauthorized (auth failed) | Maybe (retry after refresh) |
| 403 | Forbidden (permission denied) | No |
| 404 | Not Found | No |
| 409 | Conflict (duplicate email) | No |
| 413 | Payload Too Large | No |
| 429 | Rate Limited | Yes (after Retry-After) |
| 500 | Server Error | Yes (exponential backoff) |

### Rate Limit Response

```
HTTP/1.1 429 Too Many Requests
Retry-After: 900

{
  "error": "Too many requests",
  "retryAfter": 900
}
```

Client should wait `Retry-After` seconds before retrying.

---

## Pagination

List endpoints support pagination:

**Query Params**:
- `skip=0` — Offset (default 0)
- `take=20` — Limit (default 20, max 100)

**Response**:
```json
{
  "passwords": [ ... ],
  "total": 150,
  "skip": 0,
  "take": 20,
  "hasMore": true
}
```

---

## Validation Rules

### Metadata Safety

All metadata fields validated by `validateMetadataSafety()`:

**Forbidden**: password, apiKey, secret, mask, hint, sample, prefix, suffix

**Allowed**: title, username, passwordLength, hasNotes, category, environment, variableName, variableKeys

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /auth/login | 5 | 15 minutes |
| POST /auth/signup | 50 | 1 hour |
| POST /auth/refresh | 6 | 1 minute |
| POST /vault/* | 100 | 1 hour per user |

---

## Examples

### Complete Signup & Create Secret Flow

```typescript
// 1. Signup
const signupRes = await fetch('/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'login-pass',
    masterPassword: 'master-pass',
    encryptedVaultKey: { ... }
  })
})

// 2. Verify email (user clicks link)
// Link: /verify-email?token=xyz

// 3. Login
const loginRes = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'login-pass'
  })
})
const { accessToken } = await loginRes.json()

// 4. Get CSRF token
const csrfRes = await fetch('/api/auth/csrf-token')
const csrfToken = document.cookie.match(/csrfToken=([^;]+)/)[1]

// 5. Create password
const createRes = await fetch('/api/vault/password', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({
    encryptedData: { ... },
    metadata: { ... },
    hmac: '...'
  })
})
```

---

See also:
- [Authentication](./authentication.md) — Session lifecycle
- [Vault Architecture](./vault-architecture.md) — Data model
- [CSRF Protection](./csrf-protection.md) — Token validation
