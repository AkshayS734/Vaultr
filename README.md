`# Vaultr™

Security-first password and secrets manager built on Next.js. Vaultr keeps encryption on the client and stores only encrypted blobs and hashed tokens server-side.

## Key Features
- Client-side encryption for vault keys and items
- Zero plaintext storage on the backend
- Explicit vault unlock flow using a master password-derived key
- Supports passwords, API keys, and environment variables
- Audit-conscious design (soft deletes, structured data access paths)

## High-Level Architecture
- Frontend: Next.js App Router UI handling vault unlock, secret CRUD, and reveal UX
- Backend: API routes under `app/api/` for auth, vault, and secret operations
- Database: PostgreSQL via Prisma ORM and migrations
- Encryption: Derivation and encryption happen in the browser (scrypt/PBKDF2 → KEK → vault key → AES-GCM for items)
- Storage: Backend persists encrypted ciphertext and hashed tokens only

**Note:** This repository contains the open-source application and cryptographic core.  
Production hosting, operational tooling, and infrastructure are intentionally out of scope.

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
4. Apply database schema: `npx prisma migrate dev --schema=app/prisma/schema.prisma`
5. Run the dev server: `npm run dev` (defaults to http://localhost:3000)
6. Optional: `npm run ci` to lint, type-check, test, and build

Tip: Breach checks are off by default. To enable optional breach checks via the strict proxy, set `BREACH_UPSTREAM_URL` (see below). If unset or unreachable, the feature fails open and the app continues without breach indicators.

## Environment Variables

### Required
- `DATABASE_URL`: PostgreSQL connection string with optional pooling params  
  - **For production:** Add connection pooling: `?connection_limit=10&pool_timeout=20`  
  - Example:  
    ```
    postgresql://user:pass@host/db?connection_limit=10&pool_timeout=20&sslmode=require
    ```
  - Recommendation:  
    ```
    connection_limit = (database_max_connections / number_of_app_instances)
    ```
- `JWT_SECRET`: Secret for signing auth tokens (minimum 32 bytes, auto-validated)  
  - Generate with: `openssl rand -base64 32`

### Optional
- `REDIS_URL`: Enables Redis-backed caching/rate-limiting (with automatic in-memory fallback if Redis is down)
- `NEXT_PUBLIC_BASE_URL`: Used for absolute links in emails
- `BREACH_UPSTREAM_URL`: Server-side URL for the breach-proxy upstream (e.g., `https://api.pwnedpasswords.com/range`)
- `NEXT_PUBLIC_BREACH_ENDPOINT`: Documented/testing only; clients must call `/api/breach`
- SMTP settings: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`
- `NODE_ENV`: Standard environment flag

### Breach Checks (HIBP K-Anonymity)
- Endpoint: `/api/breach?prefix=<5-hex>`
- Client computes `SHA-1(password)` (HIBP requirement)
- Only the first 5 hex characters are sent to the server
- Client performs suffix matching on the server’s response
- Server forwards prefix to `BREACH_UPSTREAM_URL/{prefix}` and returns raw text
- Fail-open behavior: any error results in an empty response (no retries, no logging)
- See `docs/security/BREACH_CHECKS.md` for full details

## Project Status
- MVP under active development
- Not production-hardened or externally audited yet

## Folder Structure (brief)
- `app/` — UI routes, server actions, and API endpoints (auth, dashboard, vault flows)
- `app/lib/` — crypto, auth, database, email, and utility helpers
- `app/prisma/` — Prisma schema and migrations
- `app/components/` — shared UI and form components
- `tests/` — Jest test suites
- `docs/` — comprehensive documentation

## Roadmap
- Offline-capable vault workflows
- Browser extension for quick fill
- Mobile clients
- Third-party security audit and threat modeling refresh

## Usage Notice
This repository provides the open-source core of Vaultr.

Self-hosting and modification are permitted under the AGPL-3.0.  
Operating a public or commercial hosted service based on this code requires
compliance with the AGPL, including source disclosure.

## Branding
The name **Vaultr™** and associated branding identify the original project.

Forks and derivative works should use a different name and branding
to avoid confusion with the upstream project.

## License
Copyright © 2025 Akshay Shukla

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

If you run a modified version of this software as a service,
you must make the source code of that version available
to users of the service, as required by the AGPL.

## Disclaimer
- Educational and experimental; no external security audit completed
- Do not store real secrets in development or before an audit and hardening pass`