# Authentication

Complete lifecycle of user authentication, sessions, tokens, and email verification.

## Signup Flow

### 1. POST /api/auth/signup

User submits email, login password, master password:

```typescript
// Request payload
{
  "email": "user@example.com",
  "password": "login-password-123",
  "masterPassword": "master-password-456"
}
```

### 2. Server Validation

```typescript
import { requireAuth } from '@/app/lib/auth-utils'

export async function POST(req: Request) {
  const body = await req.json()
  
  // Parse with Zod schema
  const result = signupSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid input' },
      { status: 400 }
    )
  }
  
  const { email, password: loginPassword, masterPassword } = result.data
  
  // Check user doesn't already exist
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'Email already registered' },
      { status: 409 }
    )
  }
  
  // Hash login password with Argon2
  const authHash = await argon2.hash(loginPassword)
  
  // Client must send:
  // - encryptedVaultKey (already encrypted with KEK on client)
  // - salt (used for KEK derivation on client)
  // - kdfParams (KDF algorithm and parameters)
  
  // Server NEVER has master password
  // Server NEVER derives KEK
  // Server only stores encrypted vault key
  
  // ... Create user and vault, return
}
```

**Wait, there's a design tension here**:
- Master password never transmitted to server ✓
- Server can't verify master password strength ✗
- Server can't generate vault key (needs master password) ✗

**Solution**: Client generates vault key locally, encrypts it with KEK derived from master password, sends encrypted vault key to server.

### 3. Client-Side (Before Sending)

Browser derives KEK from master password and generates vault key:

```typescript
// From VaultProvider signup logic
const masterPassword = "master-password-456"
const scryptSalt = crypto.randomBytes(32)

// Derive KEK
const kek = await deriveKEK(masterPassword, scryptSalt, version: 2)

// Generate random vault key
const vaultKey = crypto.randomBytes(32)

// Encrypt vault key with KEK
const { ciphertext, iv, authTag } = encryptVaultKey(vaultKey, kek)

// POST to signup with encrypted vault key
const response = await fetch('/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify({
    email,
    password: loginPassword,
    encryptedVaultKey: {
      ciphertext: ciphertext.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    }
  })
})
```

### 4. Create User and Vault

Server stores User record:
- `email` (unique)
- `emailNormalized` (lowercase)
- `authHash` (Argon2 hash of login password)
- `isEmailVerified` = false
- `createdAt` = now

And creates associated Vault record:
- `userId` (foreign key to User)
- `encryptedVaultKey` (Base64, from client)
- `salt` (Base64, from client)
- `kdfParams` (JSON: { version: 2, algorithm: "scrypt-browser-v1", N, r, p, dkLen })

**Security**: Master password never stored; vault key encrypted with KEK (derived on client).

### 5. Send Verification Email

```typescript
const verificationToken = crypto.randomBytes(32).toString('hex')
const verificationTokenHash = sha256(verificationToken)

await db.emailVerification.create({
  userId,
  tokenHash: verificationTokenHash,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
})

const verificationLink = `${process.env.NEXT_PUBLIC_BASE_URL}/verify-email?token=${verificationToken}`

await sendEmail({
  to: email,
  subject: 'Verify your email',
  html: `Click here to verify: <a href="${verificationLink}">${verificationLink}</a>`
})

return NextResponse.json(
  { message: 'User created; check email for verification link' },
  { status: 201 }
)
```

---

## Login Flow

### 1. POST /api/auth/login

User submits email + login password:

```typescript
{
  "email": "user@example.com",
  "password": "login-password-123"
}
```

### 2. Rate Limiting

Check IP rate limit (5 attempts / 15 minutes):

```typescript
const clientIp = getClientIp(req)
const rateLimitKey = `login:${clientIp}`
const attempts = await redis.incr(rateLimitKey)

if (attempts === 1) {
  await redis.expire(rateLimitKey, 15 * 60) // 15 minutes
}

if (attempts > 5) {
  return NextResponse.json(
    { error: 'Too many login attempts' },
    { status: 429, headers: { 'Retry-After': '900' } }
  )
}
```

Falls back to in-memory counting if Redis unavailable.

### 3. Verify Password

```typescript
const user = await db.user.findUnique({ where: { email } })
if (!user) {
  return NextResponse.json(
    { error: 'Invalid email or password' },
    { status: 401 }
  )
}

const isValid = await argon2.verify(user.authHash, password)
if (!isValid) {
  return NextResponse.json(
    { error: 'Invalid email or password' },
    { status: 401 }
  )
}

// Check email verified
if (!user.emailVerified) {
  return NextResponse.json(
    { error: 'Please verify your email first' },
    { status: 403 }
  )
}
```

### 4. Create Session & Tokens

```typescript
// Generate tokens
const accessToken = generateAccessToken(user.id)  // 15 min expiry
const refreshToken = crypto.randomBytes(32).toString('hex')
const refreshTokenHash = hashRefreshToken(refreshToken)

// Store session
const clientIp = getClientIp(req)
const userAgent = req.headers.get('user-agent') || 'Unknown'

await db.session.create({
  userId: user.id,
  refreshTokenHash,
  ipAddress: clientIp,
  userAgent,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  lastUsedAt: new Date()
})

// Log audit event
await createAuditLog(user.id, 'login', {
  ip: clientIp,
  userAgent
})
```

### 5. Return Tokens

```typescript
const response = NextResponse.json({
  accessToken,
  user: { id: user.id, email: user.email }
}, { status: 200 })

response.headers.append(
  'Set-Cookie',
  cookie.serialize('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60  // 30 days in seconds
  })
)

return response
```

---

## Session Management

### Session Table

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Session identifier |
| `userId` | UUID | Which user |
| `refreshTokenHash` | VARCHAR | Hashed refresh token (prevents database leak) |
| `ipAddress` | VARCHAR | Client IP (truncated for privacy) |
| `userAgent` | VARCHAR | Browser/device (truncated) |
| `expiresAt` | TIMESTAMP | When refresh token expires |
| `lastUsedAt` | TIMESTAMP | For anomaly detection |

### Device Binding

Sessions tied to IP + user agent:

```typescript
export async function verifySession(
  sessionId: string,
  refreshTokenHash: string,
  currentIp: string,
  currentUserAgent: string
) {
  const session = await db.session.findUnique({
    where: { id: sessionId }
  })
  
  if (!session) {
    throw new Error('Session not found')
  }
  
  // Verify token
  const tokenMatch = session.refreshTokenHash === refreshTokenHash
  if (!tokenMatch) {
    throw new Error('Token mismatch')
  }
  
  // Check device binding (IP + user agent)
  const ipMatch = session.ipAddress === currentIp
  const uaMatch = session.userAgent === currentUserAgent
  
  if (!ipMatch || !uaMatch) {
    // Device changed; invalidate session
    await db.session.delete({ where: { id: sessionId } })
    throw new Error('Device mismatch; session invalidated')
  }
  
  // Update last used
  await db.session.update({
    where: { id: sessionId },
    data: { lastUsedAt: new Date() }
  })
  
  return session.userId
}
```

**Attackers who steal refresh token but use different IP/device are rejected.**

---

## Refresh Token Rotation

### POST /api/auth/refresh

```typescript
export async function POST(req: Request) {
  // Rate limit: 6 attempts / minute per session
  const refreshToken = req.cookies.get('refreshToken')?.value
  if (!refreshToken) {
    return NextResponse.json(
      { error: 'No refresh token' },
      { status: 401 }
    )
  }
  
  // Verify session
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const session = await db.session.findUnique({
    where: { refreshTokenHash }
  })
  
  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'Refresh token expired' },
      { status: 401 }
    )
  }
  
  // Check device binding
  const clientIp = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || 'Unknown'
  
  if (session.ipAddress !== clientIp || session.userAgent !== userAgent) {
    // Device mismatch; revoke session
    await db.session.delete({ where: { id: session.id } })
    return NextResponse.json(
      { error: 'Device mismatch' },
      { status: 401 }
    )
  }
  
  // Rotate refresh token
  const newRefreshToken = crypto.randomBytes(32).toString('hex')
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken)
  
  await db.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newRefreshTokenHash,
      lastUsedAt: new Date()
    }
  })
  
  // Generate new access token
  const accessToken = generateAccessToken(session.userId)
  
  const response = NextResponse.json(
    { accessToken },
    { status: 200 }
  )
  
  response.headers.append(
    'Set-Cookie',
    cookie.serialize('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60
    })
  )
  
  return response
}
```

**Security**: Each refresh invalidates old token; stolen token becomes useless after one rotation.

---

## Email Verification

### Requesting Verification

On signup, email verification required before accessing vault:

```typescript
// Signup automatically sends verification email
const verificationToken = crypto.randomBytes(32).toString('hex')
const verificationTokenHash = hashRefreshToken(verificationToken)

await db.emailVerification.create({
  userId,
  tokenHash: verificationTokenHash,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
})

await sendEmail({
  to: email,
  subject: 'Verify your Vaultr email',
  html: `<a href="${NEXT_PUBLIC_BASE_URL}/verify-email?token=${verificationToken}">Click to verify</a>`
})
```

### Verifying Email

User clicks link with token:

```typescript
// GET /verify-email?token=xyz
const { token } = req.nextUrl.searchParams

const tokenHash = sha256(token)
const verification = await db.emailVerification.findUnique({
  where: { tokenHash }
})

if (!verification || verification.expiresAt < new Date()) {
  return NextResponse.json(
    { error: 'Token expired or invalid' },
    { status: 401 }
  )
}

// Mark user as verified
await db.user.update({
  where: { id: verification.userId },
  data: { emailVerified: true }
})

await db.emailVerification.delete({
  where: { tokenHash }
})

// Redirect to unlock vault
return NextResponse.redirect(new URL('/unlock', req.url))
```

### Re-request Verification

If token expired:

```typescript
// POST /api/auth/request-verification-email
const { email } = req.body

const user = await db.user.findUnique({ where: { email } })
if (!user) {
  return NextResponse.json(
    { error: 'User not found' },
    { status: 404 }
  )
}

if (user.emailVerified) {
  return NextResponse.json(
    { error: 'Email already verified' },
    { status: 400 }
  )
}

// Generate new token (old one invalidated)
const verificationToken = crypto.randomBytes(32).toString('hex')
const verificationTokenHash = hashRefreshToken(verificationToken)

await db.emailVerification.deleteMany({ where: { userId: user.id } })
await db.emailVerification.create({
  userId: user.id,
  tokenHash: verificationTokenHash,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
})

await sendEmail({ to: email, ... })

return NextResponse.json(
  { message: 'Verification email sent' },
  { status: 200 }
)
```

---

## Logout Flows

### Single Session Logout

```typescript
// DELETE /api/auth/logout
export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (!auth.success) return auth.response
  
  const refreshToken = req.cookies.get('refreshToken')?.value
  if (refreshToken) {
    const refreshTokenHash = hashRefreshToken(refreshToken)
    await db.session.deleteMany({
      where: { refreshTokenHash }
    })
  }
  
  const response = NextResponse.json(
    { message: 'Logged out' },
    { status: 200 }
  )
  
  // Clear cookie
  response.headers.append(
    'Set-Cookie',
    cookie.serialize('refreshToken', '', {
      maxAge: 0,
      path: '/'
    })
  )
  
  return response
}
```

### Logout All Devices

Requires email verification:

```typescript
// POST /api/auth/logout-all
export async function POST(req: Request) {
  const auth = await requireAuth(req, { requireEmailVerified: true })
  if (!auth.success) return auth.response
  
  const { user } = auth
  
  // Delete all sessions for this user
  await db.session.deleteMany({
    where: { userId: user.id }
  })
  
  // Clear cookie
  const response = NextResponse.json(
    { message: 'Logged out from all devices' },
    { status: 200 }
  )
  
  response.headers.append(
    'Set-Cookie',
    cookie.serialize('refreshToken', '', { maxAge: 0, path: '/' })
  )
  
  return response
}
```

---

## Token Validation Middleware

### requireAuth() Helper

```typescript
import { jwtVerify } from 'jose'

export async function requireAuth(
  req: Request,
  options?: { requireEmailVerified?: boolean }
) {
  // Extract JWT from Authorization header
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      )
    }
  }
  
  const token = authHeader.slice(7)
  
  try {
    const payload = verifyAccessToken(token)
    
    // Fetch user
    const user = await db.user.findUnique({
      where: { id: payload.sub }
    })
    
    if (!user) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'User not found' },
          { status: 401 }
        )
      }
    }
    
    // Check email verification if required
    if (options?.requireEmailVerified && !user.emailVerified) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Email not verified' },
          { status: 403 }
        )
      }
    }
    
    return {
      success: true,
      user,
      response: null
    }
  } catch (error) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }
  }
}
```

---

## Security Properties

| Property | Implementation | Result |
|----------|----------------|--------|
| **Password hashing** | Argon2id (19.5 MB, 2 iterations) | Brute-force requires memory + CPU; infeasible |
| **Token signing** | HMAC-SHA256 with JWT_SECRET | Forgery impossible without secret |
| **Token expiry** | Access: 15 min, Refresh: 30 days | Compromised token has limited window |
| **Refresh rotation** | Each refresh generates new token | Stolen token invalidated after one use |
| **Device binding** | IP + User-Agent per session | Stolen token useless from different device |
| **Rate limiting** | IP-based for login/signup/refresh | Brute-force slowed to human speeds |
| **Email verification** | Time-limited tokens, hashed storage | Verification link hijack limited to 24 hours |

---

See also:
- [Cryptography](./cryptography.md) — Token generation, hashing algorithms
- [Security Model](./security-model.md) — Password concepts, threat model
- [Rate Limiting](./rate-limiting.md) — Rate limit configuration
