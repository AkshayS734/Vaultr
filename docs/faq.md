# FAQ

Frequently asked questions about Vaultr.

## General Questions

### Q: What is Vaultr?

**A:** Vaultr is a security-first password manager that encrypts all secrets in your browser before sending them to the server. The backend never sees plaintext passwords, API keys, or other secrets.

### Q: Is Vaultr ready for production use?

**A:** Vaultr is under active MVP development. It's not yet production-hardened or externally audited. Use at your own risk for non-critical data.

### Q: Can I self-host Vaultr?

**A:** Yes. Vaultr is open-source and can be self-hosted. See [Deployment](./deployment.md) for instructions.

### Q: How much does Vaultr cost?

**A:** Vaultr is open-source (free). You pay for hosting infrastructure (server, database, email service).

---

## Security Questions

### Q: Can Vaultr see my passwords?

**A:** No. Passwords are encrypted in your browser before transmission. The server stores only encrypted data; decryption keys never leave your device.

### Q: What if Vaultr's servers are hacked?

**A:** Attackers would get encrypted passwords (useless without your master password). Master passwords are never stored or transmitted, so an attacker would have to brute-force them (infeasible with scrypt).

### Q: Can I recover my master password if I forget it?

**A:** No. Master passwords are non-recoverable by design. If forgotten, your vault is permanently inaccessible. Recovery would require the password to be stored somewhere (which defeats the security model).

### Q: What's the difference between my login password and master password?

**A:** 
- **Login password**: Used to authenticate (log in). Can be recovered via email reset.
- **Master password**: Used for vault encryption only. Non-recoverable; must be memorized.

See [Security Model](./security-model.md) for details.

### Q: How secure is Vaultr?

**A:** Vaultr uses industry-standard cryptography (AES-256-GCM, scrypt, Argon2id). It's not externally audited, so don't rely on it for highly sensitive data yet.

### Q: What if my computer is compromised?

**A:** If malware is present before vault unlock, secrets in memory could be exposed. Vaultr provides defense-in-depth (5-minute auto-lock, masked secrets, audit logs) but cannot protect against all malware scenarios.

---

## Functionality Questions

### Q: What types of secrets can I store?

**A:** Passwords, API keys, environment variables, SSH keys, and notes. Anything you want encrypted.

### Q: Can I search my secrets?

**A:** Yes. Search works on metadata (title, username, notes) without decrypting secrets.

### Q: Can I share secrets with others?

**A:** Not yet. Sharing is planned but not implemented. Currently, only you can access your vault.

### Q: Can I export my secrets?

**A:** Yes. Export downloads all decrypted secrets as JSON (to your computer only; never transmitted unencrypted).

### Q: How do I change my master password?

**A:** You can change it in settings. Client-side re-encryption happens automatically. See [Password Model](./password-model.md).

### Q: Can I import passwords from other managers?

**A:** Not yet. Manual import or CSV support planned for future releases.

---

## Technical Questions

### Q: What database does Vaultr use?

**A:** PostgreSQL. See [Environment Variables](./environment-variables.md) for configuration.

### Q: Does Vaultr require Redis?

**A:** No, but recommended for production. Rate limiting falls back to in-memory if Redis unavailable.

### Q: Can I run Vaultr without sending emails?

**A:** Email verification can be skipped in development (`NODE_ENV=development`). For production, email required for account recovery.

### Q: How long are sessions valid?

**A:** Access tokens expire after 15 minutes. Refresh tokens valid for 30 days. See [Authentication](./authentication.md).

### Q: What's the vault lock timeout?

**A:** Vault auto-locks after 5 minutes of inactivity. Reload page or click to unlock.

---

## Usage Questions

### Q: How do I generate a strong password?

**A:** Use the [Password Generator](http://localhost:3000/generator) on the dashboard. Or check [Password Model](./password-model.md) for strength guidelines.

### Q: What does "password reuse detected" mean?

**A:** You've stored the same password for multiple accounts. Recommended: Use unique passwords for each site.

### Q: What does "breach detected" mean?

**A:** Password found in HaveIBeenPwned breach database. Change immediately on the affected site(s).

### Q: Why is my password marked "weak"?

**A:** Check the feedback on the password details page. Usually needs more length, variety, or randomness.

### Q: Can I see my password after saving it?

**A:** Yes. Click the eye icon to reveal. Masked by default for security.

---

## Troubleshooting

### Q: I can't log in

**A:**
1. Check email/password spelling
2. Ensure email is verified (check inbox)
3. If forgotten login password, use "Forgot password?" on login page
4. If forgotten master password, vault is inaccessible (by design)

### Q: Vault is locked after inactivity

**A:** Expected. Re-enter master password on [/unlock](http://localhost:3000/unlock). Auto-lock timeout is 5 minutes.

### Q: Email verification link expired

**A:** Expired after 24 hours. Request new link on login page ("Resend verification email").

### Q: I'm getting rate-limited

**A:** Too many failed attempts. Wait 15 minutes for login, or 1 hour for signup.

### Q: Secrets aren't syncing across devices

**A:** Vaultr doesn't auto-sync yet. Refresh the page or log out/in to see changes. Real-time sync planned.

### Q: Database error on startup

**A:** Check `DATABASE_URL` is correct and database is running. See [Environment Variables](./environment-variables.md).

### Q: Redis error on startup

**A:** Normal if `REDIS_URL` not set. Falls back to in-memory. For production, set `REDIS_URL`.

---

## Privacy Questions

### Q: What data does Vaultr collect?

**A:** Email, audit logs (IP and user agent truncated for privacy), vault metadata (non-secret info).

**Not collected**: Plaintext passwords, API keys, master password, or IP geolocation.

### Q: Can Vaultr see my searches?

**A:** No. Searches happen in your browser (decrypt locally, then search).

### Q: How long are logs kept?

**A:** Audit logs kept for 1 year, then deleted. See [Auditing & Logging](./auditing-logging.md).

### Q: Does Vaultr track my location?

**A:** No. IP addresses truncated in logs (only first 2 octets stored).

---

## Development Questions

### Q: How do I run tests?

**A:** `npm test` or `npm test -- --watch`. See [Testing Strategy](./testing-strategy.md).

### Q: How do I contribute?

**A:** See [Contributing](./contributing.md).

### Q: Where are the source files?

**A:** [app/](app/) directory contains all application code.

### Q: How do I add a new endpoint?

**A:** See [API Overview](./api-overview.md) for examples.

### Q: What's the test coverage?

**A:** 244 tests across 14 suites. Target: >80% coverage. See [Testing Strategy](./testing-strategy.md).

---

## Roadmap Questions

### Q: When is X feature coming?

**A:** See [README.md](../README.md) for roadmap. No guaranteed timelines.

### Q: Will Vaultr support 2FA?

**A:** Yes, planned. See [Security Model](./security-model.md) roadmap section.

### Q: Will there be a mobile app?

**A:** Possibly. Web-first MVP currently.

### Q: Will Vaultr be audited?

**A:** Yes, planned for future release. Budget/timeline TBD.

---

## Support

Can't find your answer? 
- Check [Security Model](./security-model.md) for architecture questions
- Check [API Overview](./api-overview.md) for endpoint questions
- Check [Threat Model](./threat-model.md) for security analysis
- File an issue on GitHub
- Reach out to security@vaultr.app for security concerns

---

See also:
- [Getting Started](./getting-started.md) — Setup guide
- [Contributing](./contributing.md) — How to contribute
