# Vaultr

Vaultr is a Next.js (App Router) web application for securely managing passwords and secrets. This repository contains the frontend and API routes (serverless) built with Next.js, TypeScript, and React.

## Features

- Next.js App Router structure
- TypeScript-first codebase
- Serverless API routes under `app/api` and `api/`
- Basic auth flow scaffolding in `app/(auth)`

## Tech Stack

- Next.js (App Router)
- React
- TypeScript
- Node (npm)

## Prerequisites

- Node.js 18+ (or the version specified in `engines` if present)
- npm (or your preferred package manager). This project uses `package-lock.json` for reproducible installs — keep it committed.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment variables. Copy the example and edit values:

```bash
cp .env.example .env.local
# then edit `.env.local`
```

## Available Scripts

- `npm run dev` — run the Next.js development server (localhost:3000)
- `npm run build` — build the production app
- `npm run start` — start the production server after build
- `npm run lint` — run linters (if configured)
- `npm test` — run tests (if configured)

Run the dev server:

```bash
npm run dev
```

## Environment Variables

- `.env.local` (ignored by git) — runtime secrets
- `.env.example` — committed example values for developers

Keep sensitive values out of the repository. The `.gitignore` is configured to ignore `*.env*` while allowing `!.env.example`.

## Repository Notes

- `next-env.d.ts` should be tracked in the repo (it is no longer ignored).
- Commit the appropriate lockfile for your package manager (`package-lock.json` for npm). Do not commit multiple lockfile types.
- `.gitkeep` files may be present to ensure empty folders (for example `app/api/passwords/.gitkeep`). Replace with real files when ready or a short `README.md` explaining the folder purpose.

## Project Structure (high level)

- `app/` — Next.js App Router pages and layouts
- `app/(auth)/` — auth-related routes and UI
- `app/(main)/dashboard/` — main app routes
- `api/` — Next-style API routes (edge/serverless)
- `components/` — React components
- `lib/` — shared libraries and helpers
- `schemas/` — validation schemas (zod, etc.)

## Contributing

Contributions welcome. Create a branch, make changes, and open a pull request. Please include a clear description and tests for new features when applicable.
