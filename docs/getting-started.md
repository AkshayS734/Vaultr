# Getting Started with Vaultr

Quick setup guide and first-time usage instructions.

## Prerequisites

- **Node.js** 18+ (with npm or yarn)
- **PostgreSQL** 14+ (for user data, encrypted secrets, sessions)
- **Redis** (optional; graceful fallback for rate limiting)
- **SMTP server** (optional; for email verification)

## Installation

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/yourusername/vaultr.git
cd vaultr
npm install
```

### 2. Configure Environment

Copy the template and fill in required values:

```bash
cp .env.example .env.local
```

**Required variables:**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Random 32+ character string for token signing

**Optional but recommended:**
- `REDIS_URL` — Redis connection (falls back to in-memory rate limiting if missing)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Email configuration
- `NEXT_PUBLIC_BASE_URL` — For absolute links in emails (default: `http://localhost:3000`)

See [Environment Variables](./environment-variables.md) for complete list.

### 3. Initialize Database

```bash
npx prisma migrate dev --schema=prisma/schema.prisma
```

This creates the schema and runs all migrations.

### 4. Start Development Server

```bash
npm run dev
```

Application runs on [http://localhost:3000](http://localhost:3000)

## First-Time User Flow

### 1. Sign Up

1. Navigate to [/signup](http://localhost:3000/signup)
2. Enter email and create a **login password** (recovered via email if forgotten)
3. Create a **master password** (never stored, used for encryption)
4. Account created; email verification required before accessing vault

### 2. Verify Email

1. Check inbox for verification link
2. Click to verify email
3. Redirected to [/unlock](http://localhost:3000/unlock) to enter master password

### 3. Unlock Vault

1. Enter master password (not your login password)
2. Client derives encryption keys in-browser
3. Vault unlocked for 5 minutes of inactivity (auto-locks)
4. Now at [/dashboard](http://localhost:3000/dashboard)

### 4. Manage Secrets

#### Passwords
- **Create**: [/secrets/passwords](http://localhost:3000/secrets/passwords) → "New Password"
- **View/Copy**: Click password item, reveal with toggle
- **Edit**: Click item → modify → save
- **Delete**: Swipe or menu → delete (confirmed by dialog)

#### API Keys
- **Create**: [/secrets/api-keys](http://localhost:3000/secrets/api-keys) → "New API Key"
- **Format**: Title, category, secret value
- **View**: Same as passwords

#### Environment Variables
- **Create**: [/secrets/env-vars](http://localhost:3000/secrets/env-vars) → "New Variable"
- **Format**: Variable name, environment (dev/staging/prod), value
- **Organize**: Filter by environment

### 5. Generate Passwords

- [/generator](http://localhost:3000/generator)
- Set length, character types
- Click "Generate" to create random password
- Copy or save directly to vault

### 6. Check Password Health

- [/dashboard](http://localhost:3000/dashboard) shows password strength summary
- [/passwords](http://localhost:3000/secrets/passwords) shows per-password audit
- Weak passwords flagged; reused passwords detected

### 7. Manage Sessions

- [/sessions](http://localhost:3000/sessions) lists active sessions
- Shows device info, IP, last used time
- Click to revoke individual sessions
- "Logout all" requires email verification

## Development Commands

```bash
npm run dev         # Start dev server (http://localhost:3000)
npm test            # Run all tests (Jest)
npm run typecheck   # Type-check with TypeScript
npm run lint        # Lint with ESLint
npm run build       # Build for production
npm run ci          # Full CI: lint → typecheck → test → build
```

## Troubleshooting

### "Connection refused" on startup

**Database not running?**
- Check `DATABASE_URL` is correct and accessible
- Verify PostgreSQL is running: `psql $DATABASE_URL -c "SELECT 1"`
- If using local PostgreSQL, ensure service started: `brew services start postgresql` (macOS)

### "Redis not available" warning

This is OK; rate limiting falls back to in-memory. For production, set `REDIS_URL`.

### "Email verification link expired"

Links expire after 24 hours. Request new verification on login page.

### "Vault is locked" after inactivity

Expected behavior (5-minute timeout). Re-enter master password on [/unlock](http://localhost:3000/unlock).

### Tests fail with "Cannot find module"

```bash
npm install
npx prisma generate  # Regenerate Prisma client
```

## Next Steps

- **Understand security**: Read [Security Model](./security-model.md)
- **Build features**: Check [API Overview](./api-overview.md)
- **Review architecture**: See [Vault Architecture](./vault-architecture.md)
- **Deploy**: Follow [Deployment](./deployment.md)

---

Need help? See [FAQ](./faq.md) or check [Contributing](../CONTRIBUTING.md) to report issues.
