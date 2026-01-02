# Auditing & Logging

Complete audit trail and logging strategy for Vaultr.

## Audit Trail

Every security-critical action logged to `audit_logs` table.

### Table Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  userId UUID FOREIGN KEY,
  action VARCHAR(50),
  details JSONB,
  ipAddress VARCHAR(45),
  userAgent VARCHAR(512),
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### Logged Actions

| Action | When | Logged Data |
|--------|------|-------------|
| `signup` | User creates account | Email, IP |
| `email_verified` | User verifies email | Email |
| `login` | User logs in | IP, user agent, device |
| `login_failed` | Login fails | Email, IP, reason |
| `logout` | User logs out | IP |
| `logout_all` | User logs out all devices | IP |
| `refresh_token` | Refresh token used | IP, device |
| `device_mismatch` | IP/UA changes on session | IP, previous IP |
| `rate_limit_exceeded` | Too many attempts | IP, endpoint |
| `password_created` | User creates password | Title (metadata only) |
| `password_updated` | User updates password | Title |
| `password_deleted` | User deletes password | Title |
| `api_key_created` | User creates API key | Title |
| `api_key_deleted` | User deletes API key | Title |
| `breach_detected` | Password found in HIBP | Count, timestamp |
| `vault_lock` | Vault auto-locked | Inactivity duration |
| `vault_unlock` | Vault unlocked | KDF version, salt |
| `settings_changed` | User changes settings | Setting name |
| `email_verification_requested` | New verification sent | Email |

### Example Audit Log Entry

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-id-123",
  "action": "login",
  "details": {
    "email": "user@example.com",
    "deviceInfo": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "isNewDevice": false
  },
  "ipAddress": "192.0.2.✗✗✗",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

---

## Implementation

### Creating Audit Logs

```typescript
// From app/lib/audit.ts
import { db } from '@/app/lib/prisma'

export async function createAuditLog(
  userId: string,
  action: string,
  details: Record<string, any>,
  req?: Request
) {
  const clientIp = req ? getClientIp(req) : 'unknown'
  const userAgent = req?.headers.get('user-agent') || 'unknown'
  
  // Redact sensitive info
  const redactedDetails = redactSensitiveData(details)
  
  await db.auditLog.create({
    data: {
      userId,
      action,
      details: redactedDetails,
      ipAddress: truncateIp(clientIp),      // ← Privacy: truncate IP
      userAgent: truncateUserAgent(userAgent), // ← Privacy: truncate UA
      timestamp: new Date()
    }
  })
}

// Usage in login handler
await createAuditLog(
  user.id,
  'login',
  { email: user.email },
  req
)
```

### Querying Audit Logs

```typescript
// Get user's audit logs
const logs = await db.auditLog.findMany({
  where: { userId: user.id },
  orderBy: { timestamp: 'desc' },
  take: 100  // Last 100 events
})

// Get recent logins
const logins = await db.auditLog.findMany({
  where: {
    userId: user.id,
    action: 'login',
    timestamp: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
    }
  },
  orderBy: { timestamp: 'desc' }
})
```

---

## Privacy Preservation

### IP Truncation

Full IP never stored; truncated for privacy:

```typescript
function truncateIp(ip: string): string {
  const parts = ip.split('.')
  
  if (parts.length === 4) {
    // IPv4: keep first 2 octets
    return `${parts[0]}.${parts[1]}.✗✗.✗✗`
  } else if (ip.includes(':')) {
    // IPv6: keep first 2 segments
    const segments = ip.split(':')
    return `${segments[0]}:${segments[1]}:✗✗:✗✗...`
  }
  
  return '✗✗.✗✗.✗✗.✗✗'
}

// Examples:
truncateIp('192.168.1.100')     // '192.168.✗✗.✗✗'
truncateIp('2001:db8::1')       // '2001:db8:✗✗:✗✗...'
```

**Benefit**: Audit logs don't enable precise user geolocation.

### User Agent Truncation

User agent truncated to prevent device fingerprinting:

```typescript
function truncateUserAgent(ua: string): string {
  if (!ua) return 'unknown'
  
  // Keep browser name + version, remove specific device details
  const match = ua.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/)
  
  if (match) {
    return `${match[1]} ${match[2]}`
  }
  
  // Fallback: first 50 chars
  return ua.substring(0, 50)
}

// Examples:
// Full: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
// Truncated: Chrome 120
```

### Sensitive Data Redaction

```typescript
function redactSensitiveData(details: Record<string, any>) {
  const redacted = { ...details }
  
  // Remove/mask sensitive fields
  const sensitiveFields = [
    'password', 'passwordHash', 'masterPassword',
    'apiKey', 'secret', 'token', 'refreshToken',
    'ssn', 'creditCard', 'privateKey'
  ]
  
  for (const field of sensitiveFields) {
    if (field in redacted) {
      redacted[field] = '***REDACTED***'
    }
  }
  
  return redacted
}
```

---

## Session Activity Log

Audit logs also show session activity:

```typescript
// Track session usage
export async function logSessionActivity(sessionId: string) {
  const session = await db.session.findUnique({
    where: { id: sessionId }
  })
  
  if (session) {
    await db.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() }
    })
  }
}
```

## Application Logging

### Server-Side (Node.js)

Logs written to stdout/stderr (captured by container/systemd):

```typescript
// Debug logs (development only)
if (process.env.NODE_ENV === 'development') {
  console.log('[INFO] Processing request', { userId, endpoint })
}

// Errors always logged
console.error('[ERROR] Database connection failed', error)

// Security events
console.warn('[SECURITY] Rate limit exceeded', { ip, endpoint })
```

### Client-Side (Browser)

Client logs errors but NEVER logs secrets:

```typescript
// ✅ Safe to log
console.log('Vault unlocked successfully')
console.log('Password created with strength:', score)

// ❌ NEVER log
console.log('Master password:', masterPassword)  // ← SECURITY ISSUE
console.log('Vault key:', vaultKey)              // ← SECURITY ISSUE
console.log('Decrypted secret:', plaintext)      // ← SECURITY ISSUE
```

### Log Levels

| Level | Purpose | Production |
|-------|---------|-----------|
| **DEBUG** | Detailed information | Hidden |
| **INFO** | General informational | Hidden or sampled |
| **WARN** | Warning conditions | Shown |
| **ERROR** | Error conditions | Shown |

---

## Retention Policy

### Audit Logs

Keep audit logs for compliance and investigation:

```sql
-- Auto-delete old audit logs (example: 1 year)
DELETE FROM audit_logs
WHERE timestamp < NOW() - INTERVAL '1 year';

-- Or use database policy
CREATE POLICY audit_log_retention AS
  DELETE FROM audit_logs
  WHERE timestamp < NOW() - INTERVAL '1 year'
  THEN SCHEDULE 'weekly';
```

### Application Logs

Container logs retained per container runtime:
- Docker: Default 100MB
- Kubernetes: Default 10MB per container
- AWS CloudWatch: Configurable (default 30 days)

---

## Security Event Examples

### Successful Login

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "user-123",
  "action": "login",
  "details": {
    "email": "user@example.com",
    "device": "Chrome 120 (Macintosh)",
    "location": "San Francisco, USA"
  },
  "ipAddress": "203.0.113.✗✗.✗✗",
  "userAgent": "Chrome 120",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Failed Login

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174001",
  "userId": null,
  "action": "login_failed",
  "details": {
    "email": "user@example.com",
    "reason": "Invalid password"
  },
  "ipAddress": "203.0.113.✗✗.✗✗",
  "userAgent": "Chrome 120",
  "timestamp": "2024-01-15T10:00:15Z"
}
```

### Device Mismatch (Security Alert)

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174002",
  "userId": "user-123",
  "action": "device_mismatch",
  "details": {
    "previousIp": "203.0.113.✗✗.✗✗",
    "currentIp": "198.51.100.✗✗.✗✗",
    "sessionId": "session-456",
    "action": "session_revoked"
  },
  "ipAddress": "198.51.100.✗✗.✗✗",
  "userAgent": "Firefox 121",
  "timestamp": "2024-01-15T10:05:00Z"
}
```

### Breach Detected

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174003",
  "userId": "user-123",
  "action": "breach_detected",
  "details": {
    "breachCount": 5,
    "title": "Bank Account",
    "timestamp": "2024-01-15T10:15:00Z"
  },
  "ipAddress": "203.0.113.✗✗.✗✗",
  "userAgent": "Chrome 120",
  "timestamp": "2024-01-15T10:15:00Z"
}
```

---

## Security Review Checklist

- [ ] All sensitive operations logged (create, update, delete)
- [ ] IP address truncated (no full IPs stored)
- [ ] User agent truncated (no device fingerprinting)
- [ ] Secrets never logged (password, API key, vault key)
- [ ] Metadata logged only (title, username, not encrypted data)
- [ ] Failed login attempts tracked
- [ ] Rate limit violations logged
- [ ] Device binding mismatches logged
- [ ] Email verification tracked
- [ ] Session creation/rotation logged
- [ ] Retention policy configured
- [ ] Access control on audit logs (admin only)

---

## Querying for Investigation

### Find All Login Attempts for User

```typescript
const logs = await db.auditLog.findMany({
  where: {
    userId: userId,
    action: { in: ['login', 'login_failed'] },
    timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  },
  orderBy: { timestamp: 'desc' }
})

logs.forEach(log => {
  const status = log.action === 'login' ? '✓ Success' : '✗ Failed'
  console.log(`${status} at ${log.timestamp} from ${log.ipAddress}`)
})
```

### Find Suspicious Activity

```typescript
// Multiple failed logins
const failedLogins = await db.auditLog.findMany({
  where: {
    action: 'login_failed',
    timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) }
  }
})

const attemptsPerIp = {}
failedLogins.forEach(log => {
  attemptsPerIp[log.ipAddress] = (attemptsPerIp[log.ipAddress] || 0) + 1
})

// Find IPs with >5 attempts
const suspiciousIps = Object.entries(attemptsPerIp)
  .filter(([ip, count]) => count > 5)
  .map(([ip, count]) => ({ ip, count }))
```

---

See also:
- [Security Model](./security-model.md) — Security principles
- [Threat Model](./threat-model.md) — Attack scenarios
- [API Overview](./api-overview.md) — Audit log endpoints
