# Maintaining Vaultr

Audience: maintainers only. This file defines how Vaultr is run, reviewed, secured, and released. It is not for contributors or end users.

---

## Project Philosophy (Security-First)

- Security guarantees override all other priorities; correctness, auditability, and maintainability follow, with features and UX last
- Zero-knowledge posture: master password never leaves the client; server must not decrypt vault contents
- Breaking changes are acceptable when required to preserve or strengthen security; backward compatibility is secondary
- Fail closed when unsure; postpone merges rather than accept risk

---

## Maintainer Responsibilities

- Preserve the documented security and threat model; enforce secret-handling rules from SECURITY.md and CONTRIBUTING.md
- Guard cryptography, authentication, session, and vault boundaries; reject any change that weakens them
- Enforce CODEOWNERS, CI, and branch protection rules on every merge to `main`
- Keep docs accurate (security model, auth flows, crypto, environment variables, testing strategy) when behavior changes
- Coordinate and respond to vulnerability reports per SECURITY.md; do not discuss vulnerabilities in public channels
- Maintain auditability: ensure changes are reviewable, tested, and traceable

---

## Authority and Ownership Boundaries

- Final approval required from the project owner for changes to cryptography/KDFs, authentication/session handling, vault encryption boundaries, authorization logic, schema changes involving secrets, and security documentation
- No merge of these areas without explicit owner approval, even if CI is green
- Temporary maintainers must not change security posture, KDF parameters, or threat model without owner sign-off

---

## Pull Request Review Rules

- All changes land via pull request; no direct pushes to protected branches
- Required status checks must be green: `lint`, `typecheck`, `test`, `build` (or `npm run ci` which runs all)
- CODEOWNER approval is mandatory where configured; do not override
- No force-pushes or history rewrites on protected branches
- If verification is incomplete or a concern exists, do not merge

### Security Review Checklist

- [ ] No plaintext secrets logged, stored, or transmitted; master password never sent to server
- [ ] Metadata contains no secret material (prefixes, masks, hashes, samples)
- [ ] Encryption boundaries intact (server cannot decrypt vault items; vaultKey never exposed outside VaultProvider)
- [ ] Authentication, authorization, CSRF, rate limits, and email verification enforced where required
- [ ] KDF and hashing parameters unchanged or strengthened; no performance-driven weakening
- [ ] Inputs validated with existing schemas; outputs avoid leaking sensitive data
- [ ] Tests cover new or changed security logic; relevant suites updated (security, metadata validation, zero-knowledge, auth)
- [ ] Docs updated where behavior or guarantees changed

If any item is uncertain, stop the merge and seek clarification.

---

## CI and Branch Protection Expectations

- `main` is protected: PR-only merges, required status checks (`lint`, `typecheck`, `test`, `build`), CODEOWNER approval, no force-pushes
- Maintain linear history on protected branches; rebase or squash via PR as needed
- Restore protections immediately if ever relaxed (e.g., for emergency fixes)

---

## Dependency and npm Audit Handling

- Prefer stable, well-audited dependencies; avoid new cryptography libraries unless required and owner-approved
- Keep updates small and reviewable; prioritize security updates over features
- Run `npm audit` regularly and before release; high/critical advisories block merges until resolved or explicitly triaged with mitigation
- Document rationale for deferring any advisory and track follow-up

---

## Security Vulnerability Handling

- Follow SECURITY.md: accept reports privately via email; do not use public issues/PRs for vulnerabilities
- Only `main` and the latest release are supported for fixes
- Acknowledge reports, validate impact, and ship fixes before any disclosure
- Treat unclear impact as high risk until proven otherwise; prefer conservative mitigations

---

## Release Process and Semantic Versioning

- Preconditions before tagging a release: `npm run ci` green, `npm audit` clear of unaddressed high/critical issues, docs updated for any behavior or guarantee changes
- Versioning: semantic versioning (major.minor.patch)
  - Major: breaking changes or security model changes
  - Minor: additive features that preserve guarantees
  - Patch: bug fixes and internal improvements, including security fixes that do not change behavior
- Tag the release and record release notes (include security-impact summary and any mitigation steps)

---

## Documentation Consistency Rules

- Update relevant docs when behavior or guarantees change: security model, authentication, cryptography, environment variables, testing strategy, API overview, and README navigation
- Keep examples consistent with implemented behavior; remove stale guidance promptly
- Document security-sensitive changes in commit messages and release notes for auditability

---

## When to Say No

- Change weakens or bypasses security controls (encryption boundaries, KDF parameters, auth, CSRF, rate limits, email verification)
- Metadata proposals include any secret-bearing data, even masked or partial
- Tests absent for new or changed security logic
- Behavior changes without docs, schema validation, or threat-model alignment
- Dependencies introduce unnecessary attack surface or unaudited crypto
- Requests for speed or convenience that trade off security or auditability

---

## Bus Factor and Future Maintainers

- Current state: single maintainer; keep decisions documented and reproducible
- Onboarding new maintainers requires sharing threat model, SECURITY.md expectations, CI/branch protections, and release practices
- Update CODEOWNERS and access controls deliberately; least privilege by default
- Do not delegate security-critical approvals without explicit owner agreement

---

## Final Note

Security over speed. If unsure, pause, verify, and only then proceed.
