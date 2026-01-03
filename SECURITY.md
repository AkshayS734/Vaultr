# Security Policy

Vaultr is a security-first password and secrets manager.
We take security vulnerabilities seriously and appreciate responsible disclosure.

---

## Supported Versions

Only the `main` branch and the **latest released version** are considered
supported for security fixes.

Security issues affecting older versions may not be addressed.

---

## Reporting a Vulnerability

If you discover a security vulnerability, **report it privately**.

- **Email:** akshaysbuilds@gmail.com
- **Do NOT** open public GitHub issues for security vulnerabilities
- **Do NOT** disclose the issue publicly before a fix is available

When reporting, please include:

- A clear description of the vulnerability
- Steps to reproduce (if applicable)
- An assessment of impact (what an attacker could realistically do)
- Any proof-of-concept or relevant logs (if safe to share)

---

## Disclosure Process

- We will acknowledge receipt within a reasonable time
- We will investigate and validate reported issues
- Confirmed vulnerabilities will be fixed as soon as practical
- Public disclosure may occur **after** a fix is released or mitigation is available

We request that reporters follow responsible disclosure practices.

---

## Scope

Security reviews primarily focus on:

- Client-side cryptography and key derivation
- Vault key management and encryption boundaries
- Authentication, authorization, and session handling
- Handling of secrets, credentials, and sensitive tokens
- CSRF protection and rate-limiting on sensitive endpoints

Issues outside this scope may still be reviewed at our discretion.

---

Thank you for helping keep Vaultr secure.