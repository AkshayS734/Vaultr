# Environment Variables

Complete reference for all environment configuration options.

## Required Variables

### DATABASE_URL

PostgreSQL connection string.

```bash
# Development (local)
DATABASE_URL="postgresql://user:password@localhost:5432/vaultr"

# Docker
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/vaultr"

# Production (AWS RDS)
DATABASE_URL="postgresql://vaultr:SecurePassword@vaultr-db.c9akciq32.us-east-1.rds.amazonaws.com:5432/vaultr"
```

**Format**: `postgresql://username:password@host:port/database`

**Validation**: Must be valid PostgreSQL connection string; server tests connection on startup.

---

### JWT_SECRET

Secret key for signing JWT tokens.

```bash
# Generate random secret (32+ bytes recommended)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output: 8f3d2a1c5b9e7f4a6c8d0e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b

JWT_SECRET="8f3d2a1c5b9e7f4a6c8d0e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"
```

**Security**: 
- Minimum 32 characters (256 bits)
- Store securely (not in git, use .env.local)
- Rotate periodically in production
- Different value per environment

**Validation**: Must be at least 32 characters; server validates on startup.

---

## Optional Variables

### REDIS_URL

Redis connection for rate limiting and caching.

```bash
# Development (local)
REDIS_URL="redis://localhost:6379"

# Docker
REDIS_URL="redis://redis:6379"

# Production (AWS ElastiCache)
REDIS_URL="redis://vaultr-redis.abc123.ng.0001.use1.cache.amazonaws.com:6379"

# With authentication
REDIS_URL="redis://:password@host:6379"
```

**Format**: `redis://[username[:password]@]host[:port][/database]`

**Fallback**: If unavailable, in-memory rate limiting used (single-process only; don't use in production).

**Warning**: In-memory rate limiting NOT shared across instances; each instance tracks limits independently.

---

### NEXT_PUBLIC_BASE_URL

Base URL for email links and API calls.

```bash
# Development
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Staging
NEXT_PUBLIC_BASE_URL="https://staging.vaultr.app"

# Production
NEXT_PUBLIC_BASE_URL="https://vaultr.app"
```

**Usage**: Verification emails, password reset links, API calls.

**Default**: `http://localhost:3000` (development) or `https://yourdomain.com` (production).

**Validation**: Must be valid HTTP/HTTPS URL.

---

### Email Configuration

#### SMTP_HOST

SMTP server hostname.

```bash
# Gmail
SMTP_HOST="smtp.gmail.com"

# AWS SES
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"

# Mailgun
SMTP_HOST="smtp.mailgun.org"

# Custom
SMTP_HOST="mail.yourdomain.com"
```

#### SMTP_PORT

SMTP server port.

```bash
SMTP_PORT=465    # TLS (secure, recommended)
SMTP_PORT=587    # STARTTLS
SMTP_PORT=25     # Plaintext (not recommended)
```

#### SMTP_USER

SMTP authentication username.

```bash
SMTP_USER="your-email@gmail.com"
SMTP_USER="apikey"  # AWS SES
```

#### SMTP_PASS

SMTP authentication password.

```bash
SMTP_PASS="your-app-specific-password"  # Gmail
SMTP_PASS="aws-ses-secret"              # AWS SES
```

**Security**: Never commit to git; use .env.local.

#### SMTP_FROM

Email address verification emails sent from.

```bash
SMTP_FROM="noreply@vaultr.app"
SMTP_FROM="security@yourdomain.com"
```

**Format**: Valid email address.

#### SMTP_SECURE

Enable TLS for SMTP connection.

```bash
SMTP_SECURE=true   # Use TLS (port 465)
SMTP_SECURE=false  # Don't use TLS (use STARTTLS on 587 instead)
```

**Default**: `true`

---

### Rate Limiting Configuration

#### RATE_LIMIT_LOGIN

Maximum login attempts per window.

```bash
RATE_LIMIT_LOGIN=5
```

**Default**: 5 attempts

**Window**: 15 minutes

---

#### RATE_LIMIT_LOGIN_WINDOW

Login rate limit window in seconds.

```bash
RATE_LIMIT_LOGIN_WINDOW=900  # 15 minutes
```

**Default**: 900 seconds

---

#### RATE_LIMIT_SIGNUP

Maximum signup attempts per window.

```bash
RATE_LIMIT_SIGNUP=50
```

**Default**: 50 attempts

**Window**: 1 hour

---

#### RATE_LIMIT_SIGNUP_WINDOW

Signup rate limit window in seconds.

```bash
RATE_LIMIT_SIGNUP_WINDOW=3600  # 1 hour
```

**Default**: 3600 seconds

---

#### RATE_LIMIT_REFRESH

Maximum refresh attempts per window.

```bash
RATE_LIMIT_REFRESH=6
```

**Default**: 6 attempts

**Window**: 1 minute

---

#### RATE_LIMIT_REFRESH_WINDOW

Refresh rate limit window in seconds.

```bash
RATE_LIMIT_REFRESH_WINDOW=60  # 1 minute
```

**Default**: 60 seconds

---

### Node Environment

#### NODE_ENV

Environment name.

```bash
NODE_ENV=development
NODE_ENV=production
NODE_ENV=test
```

**Effects**:
- `development`: Verbose logging, no HTTPS required
- `production`: HTTPS enforced, secure cookies, optimized builds
- `test`: Mock services, reduced rate limits

**Default**: `development`

---

## Development Setup

### .env.local Example

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/vaultr"

# JWT
JWT_SECRET="8f3d2a1c5b9e7f4a6c8d0e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"

# Email (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-specific-password"
SMTP_FROM="noreply@yourdomain.com"
SMTP_SECURE=true

# Redis (optional; falls back to in-memory)
REDIS_URL="redis://localhost:6379"

# UI
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Environment
NODE_ENV=development
```

### Setup Steps

```bash
# 1. Clone repo
git clone https://github.com/yourname/vaultr.git
cd vaultr

# 2. Install dependencies
npm install

# 3. Create .env.local
cp .env.example .env.local
# Edit with your values

# 4. Start PostgreSQL (if local)
brew services start postgresql

# 5. Initialize database
npx prisma migrate dev

# 6. Start dev server
npm run dev
```

---

## Production Setup

### Environment Variables

```bash
# Database (AWS RDS)
DATABASE_URL="postgresql://vaultr:${DB_PASSWORD}@vaultr.c9akciq32.us-east-1.rds.amazonaws.com:5432/vaultr"

# JWT (random, secure)
JWT_SECRET="<generate with: node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))'>"

# Email (AWS SES)
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
SMTP_PORT=587
SMTP_USER="${SES_USER}"
SMTP_PASS="${SES_PASSWORD}"
SMTP_FROM="noreply@vaultr.app"
SMTP_SECURE=false

# Cache (AWS ElastiCache)
REDIS_URL="redis://vaultr-cache.abc123.ng.0001.use1.cache.amazonaws.com:6379"

# UI
NEXT_PUBLIC_BASE_URL="https://vaultr.app"

# Security
NODE_ENV=production
```

### Deployment Checklist

- [ ] All required variables set
- [ ] No secrets in git history
- [ ] REDIS_URL configured (not in-memory)
- [ ] DATABASE_URL points to production database
- [ ] SMTP configured for email
- [ ] JWT_SECRET rotated and stored securely
- [ ] NEXT_PUBLIC_BASE_URL matches domain
- [ ] NODE_ENV=production
- [ ] TLS enabled (HTTPS)
- [ ] Firewall restricts database access
- [ ] Backups automated
- [ ] Monitoring enabled

---

## Secrets Management

### Secure Storage Options

| Option | Security | Effort | Auto-rotation |
|--------|----------|--------|---|
| **.env.local** (dev) | Low | Low | Manual |
| **Environment variables** | Medium | Medium | Manual |
| **AWS Secrets Manager** | High | High | Auto |
| **HashiCorp Vault** | High | High | Auto |
| **GitHub Secrets** (CI/CD) | High | Medium | Manual |

### AWS Secrets Manager Example

```bash
# Store secret
aws secretsmanager create-secret \
  --name vaultr/prod/jwt-secret \
  --secret-string "8f3d2a1c5b9e7f4a6c8d0e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"

# Retrieve in application
const secret = await secretsManager.getSecretValue({
  SecretId: 'vaultr/prod/jwt-secret'
})
const JWT_SECRET = secret.SecretString
```

---

## Validation

### Startup Checks

When server starts, validates:

```typescript
// Required variables
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required')
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET required')

// Validate DATABASE_URL
try {
  await db.$queryRaw`SELECT 1`
} catch {
  throw new Error('DATABASE_URL invalid or database unreachable')
}

// Validate JWT_SECRET length
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be 32+ characters')
}

// Optional but warn
if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
  console.warn('REDIS_URL not set; using in-memory rate limiting (not recommended for production)')
}
```

---

## Migration from Development to Production

### 1. Generate Secure Values

```bash
# JWT_SECRET (random 32+ bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Database password (random)
openssl rand -base64 32
```

### 2. Set Production Database

```bash
# Create PostgreSQL database
CREATE USER vaultr WITH PASSWORD '...';
CREATE DATABASE vaultr OWNER vaultr;
```

### 3. Update Variables

```bash
# Update .env.production
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
REDIS_URL="redis://..."
SMTP_HOST="..."
NODE_ENV=production
```

### 4. Run Migrations

```bash
npx prisma migrate deploy
```

### 5. Deploy Application

```bash
npm run build
npm start
```

---

## Troubleshooting

### "DATABASE_URL not set"

```bash
# Check if .env.local exists
ls -la .env.local

# Check if variable set
echo $DATABASE_URL

# If using Docker, pass as environment variable
docker run -e DATABASE_URL="..." vaultr:latest
```

---

### "Cannot connect to database"

```bash
# Test connection manually
psql $DATABASE_URL -c "SELECT 1"

# If fails, check:
# 1. PostgreSQL running
# 2. Host/port correct
# 3. Username/password correct
# 4. Database exists
```

---

### "JWT_SECRET too short"

```bash
# Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env.local
JWT_SECRET="<new-value>"

# Restart server
npm run dev
```

---

### "Redis not available"

Normal warning; falls back to in-memory rate limiting.

For production, ensure REDIS_URL set:

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Should output: PONG
```

---

## Best Practices

1. **Never commit secrets** — Use .env.local (not git)
2. **Rotate JWT_SECRET** — At least yearly
3. **Use strong passwords** — Minimum 32 characters for JWT_SECRET
4. **Secure storage** — AWS Secrets Manager or HashiCorp Vault
5. **Different per environment** — Dev, staging, prod all different
6. **Monitor access** — Log who accesses secrets
7. **Automated rotation** — Set up key rotation in production

---

See also:
- [Getting Started](./getting-started.md) — Setup guide
- [Deployment](./deployment.md) — Production configuration
- [Security Model](./security-model.md) — Security best practices
