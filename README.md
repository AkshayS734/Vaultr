# Vaultr

Security-first password and secrets manager built on Next.js. Vaultr keeps encryption on the client and stores only encrypted blobs and hashed tokens server-side.

## Key Features
- Client-side encryption for vault keys and items
- Zero plaintext storage on the backend
- Explicit vault unlock flow using a master password-derived key
- Supports passwords, API keys, and environment variables
- Audit-conscious design (soft deletes, structured data access paths)

## High-Level Architecture
- Frontend: Next.js App Router UI handling vault unlock, secret CRUD, and reveal UX
- Backend: API routes under `app/api` and `api/` for auth, vault, and secret operations
- Database: PostgreSQL via Prisma ORM and migrations
- Encryption: Derivation and encryption happen in the browser (scrypt/PBKDF2 → KEK → vault key → AES-GCM for items)
- Storage: Backend persists encrypted ciphertext and hashed tokens only

## Security Model
- Master password is never stored or transmitted
- Key derivation and decryption run entirely on the client
- Sensitive tokens (e.g., password reset, email verification) are stored hashed
- Secrets require an explicit reveal action; no automatic exposure in listings
- Soft-delete protections on user records to avoid silent data resurrection

## Tech Stack
- Next.js (App Router) and React with TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL (e.g., Neon)
- Zod for validation
- GitHub Actions for CI

## Local Development Setup
1. Prerequisites: Node.js 18+, npm, and access to a PostgreSQL instance
2. Configure environment: create `.env.local` with the variables below
3. Install dependencies: `npm install`
4. Apply database schema: `npx prisma migrate dev --schema=prisma/schema.prisma`
5. Run the dev server: `npm run dev` (defaults to http://localhost:3000)
6. Optional: `npm run ci` to lint, type-check, test, and build

Tip: Breach checks are off by default. To enable optional breach checks via the strict proxy, set `BREACH_UPSTREAM_URL` (see below). If unset or unreachable, the feature fails open and the app continues without breach indicators.

## Environment Variables
- Required
	- `DATABASE_URL`: PostgreSQL connection string
	- `JWT_SECRET`: Secret for signing auth tokens
- Optional
	- `REDIS_URL`: Enables Redis-backed caching/session flows
	- `NEXT_PUBLIC_BASE_URL`: Used for absolute links in emails
	- `BREACH_UPSTREAM_URL`: Server-side URL for the breach-proxy upstream (e.g., `https://api.pwnedpasswords.com/range`). The internal route `/api/breach` forwards only a 5-hex-character SHA-1 prefix to this upstream and returns raw text response. If unset, breach checks are disabled and the app fails open.
	- `NEXT_PUBLIC_BREACH_ENDPOINT`: Not used directly by the client (all lookups must go through `/api/breach`). Exposed only for documentation/testing; do not call third-party services from the browser.
	- SMTP settings for outbound email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`
	- `NODE_ENV`: Standard environment flag

### Breach Checks (HIBP K-Anonymity)
- Endpoint: `/api/breach?prefix=<5-hex>`
- Client uses `SHA-1(password)` (HIBP requirement), sends only first 5 hex chars to server.
- Client performs suffix matching on server's text response (true k-anonymity).
- Server forwards prefix to `BREACH_UPSTREAM_URL/{prefix}` and returns raw text.
- Fail-open: any network/error condition results in empty response (no block, no retries, no logging).
- See docs/security/BREACH_CHECKS.md for full details.

## Project Status
- MVP under active development; not production-hardened or externally audited yet

## Folder Structure (brief)
- `app/` — UI routes and server actions (auth, dashboard, vault flows)
- `api/` — additional API route handlers
- `lib/` — crypto, auth, database, email, and utility helpers
- `prisma/` — Prisma schema and migrations
- `components/` — shared UI and form components

## Roadmap
- Offline-capable vault workflows
- Browser extension for quick fill
- Mobile clients
- Third-party security audit and threat modeling refresh

## Disclaimer
- Educational/experimental; no external security audit completed
- Do not store real secrets in development or before an audit and hardening pass
