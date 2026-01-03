# Threat Model

Comprehensive analysis of potential attacks on Vaultr and their mitigations.

## Adversary Types

### 1. Network Eavesdropper

**Attacker Goal**: Intercept plaintext secrets during transmission.

**Attack Vector**: Man-in-the-middle (MITM), packet capture, rogue WiFi AP.

**Mitigation**:
- ✅ HTTPS enforced (TLS 1.2+)
- ✅ Secrets encrypted before transmission (never sent plaintext)
- ✅ No secrets in URLs, headers, or logs
- ✅ HSTS preload list (production)

**Residual Risk**: If TLS broken (rare), attacker sees:
- Encrypted secrets (useless without vault key)
- Metadata (non-secret info only)
- Session tokens (limited window)

---

### 2. Server Compromise (Database Breach)

**Attacker Goal**: Steal all user secrets from database.

**Attack Vector**: SQL injection, server misconfiguration, disgruntled employee.

**What Attacker Gets**:
- User emails
- Password hashes (Argon2)
- Encrypted vault keys
- Encrypted secrets (ciphertext blobs)
- Session tokens (hashed)
- Metadata (non-secret UI info)

**What Attacker Cannot Get** (without master passwords):
- ❌ Plain vault key (still encrypted)
- ❌ Plain secrets (still encrypted)
- ❌ Master passwords (never stored)

**Mitigation**:
- ✅ Never store master password (impossible)
- ✅ Never store plaintext secrets (always encrypted)
- ✅ Never store plaintext vault key (encrypted with KEK)
- ✅ Hash all tokens (refresh token, verification tokens)
- ✅ Validate metadata prevents plaintext secret leakage
- ✅ Scrypt KDF makes brute-force expensive

**Residual Risk**: If attacker has database + significant computing power:

```
Database leak + brute-force attack:
  Attacker has: encryptedVaultKey
  Want: vaultKey
  
  Per guess:
    1. Assume master password
    2. Derive KEK with scrypt (100–300ms)
    3. Try to decrypt vault key
    4. Check if decryption succeeds
  
  Result: Infeasible for reasonable password entropy
```

**Cost Analysis**:
- 10^6 guesses: 27–92 hours CPU
- 10^9 guesses: 31–105 years CPU
- 2^128 guesses: 10^25 years

---

### 3. Server Insider (Hosting Provider)

**Attacker Goal**: Access user secrets with server-side access.

**Attack Vector**: Rogue sysadmin, government subpoena, corporate espionage.

**What Insider Can See**:
- 🔶 TLS traffic (encrypted but insider reads RAM/memory)
- 🔶 Decrypted payloads in server memory (briefly)
- 🔶 Database backups

**What Insider Cannot Do**:
- ❌ Decrypt vault key (needs KEK from client)
- ❌ Decrypt secrets (needs vault key)
- ❌ Derive KEK without master password
- ❌ Brute-force master password (scrypt cost)

**Mitigation**:
- ✅ Client-side encryption (server processes ciphertext only)
- ✅ Master password never transmitted (derived client-side)
- ✅ Vault key encrypted before transmission
- ✅ Server never decrypts (architecture principle)

**Residual Risk**: Insider intercepts master password during unlock.

```
Unlock flow:
  Browser: User enters master password
  ↓
  Browser: Derive KEK (client-side, not transmitted)
  ↓
  Browser: Master password cleared from memory
  ↓
  Server: Never sees master password
```

Mitigation: Master password never sent to server.

---

### 4. Web Application Compromise (XSS / Code Injection)

**Attacker Goal**: Steal vault key or master password from browser memory.

**Attack Vector**: XSS vulnerability, supply chain attack, malicious dependency.

**What Attacker Can Extract**:
- 🔶 Vault key (in memory, ~5 min window)
- 🔶 Master password (if not cleared)
- 🔶 Decrypted secrets (temporarily in memory)

**Mitigation**:
- ✅ Strict CSP (Content Security Policy)
- ✅ Subresource Integrity (SRI) for external scripts
- ✅ Regular dependency audits
- ✅ Code review for crypto operations
- ✅ Master password cleared from memory after derivation
- ✅ Vault key cleared after 5 minutes inactivity

**Residual Risk**: 0-day vulnerability in JavaScript or cryptographic library.

---

### 5. Attacker with User's Computer

**Attacker Goal**: Access vault while user is logged in.

**Attack Vector**: Malware, physical theft, screen sharing.

**What Attacker Can Do**:
- 🔶 Read vault key from memory (5-min window)
- 🔶 Extract decrypted secrets (if user is viewing)
- 🔶 Read network traffic
- 🔶 Access refresh token from cookie (httpOnly prevents JS theft)

**Mitigation**:
- ✅ Vault lock after 5 minutes inactivity
- ✅ Refresh token in httpOnly cookie (JavaScript can't steal)
- ✅ Secrets masked by default (requires explicit reveal)
- ✅ Audit logs track all access

**Residual Risk**: Attacker present during active session.

```
Timeline:
  T+0 min: User unlocks vault
  T+3 min: User steps away
  T+5 min: Vault auto-locks
  T+5 min+1s: Attacker present, vault already locked
  → Attacker must know master password to proceed
```

---

### 6. Phishing / Social Engineering

**Attacker Goal**: Trick user into revealing master password.

**Attack Vector**: Email, fake login page, phone call.

**What Attacker Can Do**:
- 🔶 If user reveals master password, attacker can unlock vault
- 🔶 If user compromised, attacker has all secrets

**Mitigation**:
- ✅ Clear UI distinction (master password never requested via email)
- ✅ Audit logs reveal unauthorized access
- ✅ Security training (recognize phishing)
- ✅ 2FA (future enhancement)

**Residual Risk**: User psychology (hard to defend against).

---

### 7. Cryptographic Algorithm Weakness

**Attacker Goal**: Break underlying cryptography (find shortcut to decrypt).

**Attack Vector**: Academic breakthrough, quantum computing, implementation flaw.

**Current Risk Level**: Low
- AES-256: No known practical attacks
- SHA-256: No known practical attacks
- scrypt: Only academic attacks (not practical yet)

**Mitigation**:
- ✅ Use NIST/OWASP recommended algorithms
- ✅ Peer-reviewed implementations
- ✅ Regular security audits (future)
- ✅ Post-quantum migration plan (future)

**Residual Risk**: Quantum computing (Shor's algorithm threatens RSA/ECC, not AES).

---

## Attack Scenarios

### Scenario 1: "Steal All User Secrets"

**Attack**: Compromise server, steal database.

**Timeline**:
```
Day 0: Database stolen (100 GB of encrypted data)
Day 1: Attacker realizes secrets encrypted
Day 2: Attacker starts brute-forcing master passwords
Day 365: Attacker cracks 1 password (at ~10,000 guesses/day)
Day 36,500: Attacker still brute-forcing second password
```

**Verdict**: Attack fails due to scrypt cost.

### Scenario 2: "Steal One User's Secrets"

**Attack**: Phishing campaign targets single user.

**Timeline**:
```
Day 0: Attacker sends fake "security alert" email
Day 0.5: User clicks link, sees credential form
Day 1: User realizes "password" field unusual, closes tab
OR
Day 1: User enters master password (compromised)
Day 1.1: Attacker uses master password to unlock vault
Day 1.2: Attacker extracts all secrets
```

**Verdict**: Mitigation depends on user awareness.

### Scenario 3: "Intercept Network Traffic"

**Attack**: Man-in-the-middle on shared WiFi.

**Timeline**:
```
Attacker on WiFi: Inspects all network packets
Attacker sees: HTTPS encrypted packets (encrypted)
Attacker realizes: Cannot decrypt without TLS secret
Attacker moves on: Traffic encrypted end-to-end
```

**Verdict**: Attack fails; HTTPS protects data in transit.

### Scenario 4: "Malware on User's Computer"

**Attack**: User downloads malware (trojan, ransomware).

**Timeline**:
```
T+0: Malware installs, starts monitoring
T+5 min: User unlocks vault (malware sees master password entry)
T+5+ min: User browses passwords in vault
T+10 min: Malware reads vault key from browser memory
T+10+ min: Malware decrypts secrets using vault key
T+11 min: Malware exfiltrates all secrets
T+15 min: Vault auto-locks (too late)
```

**Verdict**: If malware present before unlock, secrets compromised. Mitigations help but cannot fully prevent.

---

## Security Properties

### Zero-Knowledge

**Claim**: "A database leak reveals zero usable secrets."

**Proof Chain**:
1. Database contains: `encryptedVaultKey`, `encryptedSecrets`
2. Attacker extracts: Ciphertext (useless without key)
3. To get vault key: Need to decrypt `encryptedVaultKey`
4. To decrypt: Need KEK (key encryption key)
5. To get KEK: Need to derive with scrypt
6. To derive: Need master password
7. Master password: Never stored, never transmitted
8. Attacker has: No way to obtain master password except brute-force
9. Brute-force cost: 100–300ms per guess (infeasible at scale)

**Conclusion**: ✓ Zero-knowledge property holds.

### Perfect Forward Secrecy

**Claim**: "If access token stolen, secrets remain protected."

**Proof**:
1. Access token contains: User ID, exp time
2. To decrypt secrets: Need vault key
3. Vault key stored encrypted with KEK
4. To get KEK: Need master password (client-side only)
5. Stealing access token doesn't reveal master password

**Conclusion**: ✓ Perfect forward secrecy holds (for master password).

### Forward Secrecy (Sessions)

**Claim**: "If one session token stolen, other sessions safe."

**Proof**:
1. Refresh token rotation: Each refresh creates new token, invalidates old
2. Device binding: Stolen token useless from different IP/user agent
3. Token expiry: Short window (15 min for access token)

**Conclusion**: ✓ Session forward secrecy holds.

---

## Worst-Case Scenario

**If Everything Compromised**:
- Server compromised ✓
- TLS broken ✓
- User's computer has malware ✓
- User's master password weak (e.g., "123456") ✓

**Attacker Still Cannot**:
- Break AES-256 (no shortcut)
- Break SHA-256 (no shortcut)
- Decrypt old secrets if master password changed

**Attacker Can**:
- Access current vault (user compromised)
- See master password if strong (not if weak)

---

## Not In Scope

The following are **not** covered by security design:

❌ **Protecting against malware** on user's computer (fundamental OS problem)  
❌ **Protecting against shoulder surfing** (physical security)  
❌ **Protecting against user sharing passwords** (user behavior)  
❌ **Protecting against weak passwords** (user education)  
❌ **Protecting against quantum computers** (future research)  
❌ **Protecting against government backdoors** (out of scope)  

---

## Security Roadmap

### Phase 1 (Current)
- ✅ Master password encryption
- ✅ AES-256-GCM secret encryption
- ✅ Argon2id password hashing
- ✅ Rate limiting
- ✅ Device binding (IP + UA)

### Phase 2 (Planned)
- 🔄 2FA (TOTP)
- 🔄 Hardware security key support
- 🔄 Encrypted backups
- 🔄 Audit log search/export

### Phase 3 (Future)
- 📋 External security audit
- 📋 Bug bounty program
- 📋 Post-quantum cryptography migration
- 📋 Zero-knowledge proof for verification

---

See also:
- [Security Model](docs/security-model.md) — Core security concepts
- [Cryptography](docs/cryptography.md) — Algorithm analysis
- [Authentication](docs/authentication.md) — Session and token security
