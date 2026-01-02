# Vaultr Documentation

Complete reference for Vaultr's architecture, security model, and development practices.

## Quick Start

- **[Getting Started](./getting-started.md)** — Setup, first run, and basic operations
- **[Security Model](./security-model.md)** — Password concepts, encryption boundaries, threat model

## Core Concepts

### Architecture
- **[Vault Architecture](./vault-architecture.md)** — How secrets are encrypted, stored, and accessed
- **[Cryptography](./cryptography.md)** — KDF, AES-GCM, token generation, WASM scrypt
- **[Authentication](./authentication.md)** — Login, sessions, JWT, refresh tokens, email verification
- **[Password Model](./password-model.md)** — Master password vs. login password, recovery flows

### Security & Infrastructure
- **[Threat Model](./threat-model.md)** — Attack surfaces, adversary assumptions, mitigations
- **[Rate Limiting](./rate-limiting.md)** — Redis-backed rate limits, bypasses, fallback behavior
- **[CSRF Protection](./csrf-protection.md)** — Double-submit pattern, token validation
- **[Auditing & Logging](./auditing-logging.md)** — Security events, PII redaction, log storage

### Development & Operations
- **[API Overview](./api-overview.md)** — Routes, authentication, error handling, validation
- **[Testing Strategy](./testing-strategy.md)** — Unit tests, integration patterns, security test coverage
- **[Environment Variables](./environment-variables.md)** — Required and optional configuration
- **[Deployment](./deployment.md)** — Production readiness, hardening, monitoring

## Reference

- **[FAQ](./faq.md)** — Common questions and troubleshooting
- **[Contributing](./contributing.md)** — Code style, security review, PR process

---

## Navigation Shortcuts

| Topic | File |
|-------|------|
| I want to... understand how secrets stay encrypted on the server | [Vault Architecture](./vault-architecture.md) + [Cryptography](./cryptography.md) |
| I want to... add a new API endpoint | [API Overview](./api-overview.md) + [Authentication](./authentication.md) |
| I want to... understand rate limiting | [Rate Limiting](./rate-limiting.md) + [Environment Variables](./environment-variables.md) |
| I want to... audit what happened in the system | [Auditing & Logging](./auditing-logging.md) |
| I want to... understand password recovery | [Password Model](./password-model.md) + [Authentication](./authentication.md) |
| I want to... review security threats | [Threat Model](./threat-model.md) + [Security Model](./security-model.md) |
| I want to... add tests for a feature | [Testing Strategy](./testing-strategy.md) |
| I want to... deploy to production | [Deployment](./deployment.md) + [Environment Variables](./environment-variables.md) |

---

## Project Status

**MVP under active development** — not yet production-hardened or externally audited.

See [README.md](../README.md) for roadmap and security disclaimer.
