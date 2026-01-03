# Contributing

How to contribute to Vaultr securely and effectively.


## TL;DR for Contributors

- UI, docs, tests, and refactors are welcome
- Security-critical code requires prior discussion and explicit approval
- Run `npm run ci` before opening a PR
- Never log, store, or transmit secrets
- If in doubt, ask before implementing

By submitting a contribution, you agree that your contribution will be
licensed under the same license as the project (**AGPL-3.0**).

---

## Code of Conduct

- Treat everyone with respect
- Focus on code quality and security
- Constructive feedback only
- Report security issues privately (akshaysbuilds@gmail.com)

This project follows the **Contributor Covenant Code of Conduct (v2.1)**.
By participating, you agree to uphold this standard.

---

## Getting Started

### 1. Fork & Clone

```bash
git clone https://github.com/Akshay/Vaultr.git
cd vaultr
npm install
```

### 2. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

### 3. Make Changes

See sections below for guidelines.

### 4. Test & Build

```bash
npm run ci  # lint → typecheck → test → build
```

### 5. Commit & Push

```bash
git commit -m "feat: describe your change"
git push origin feature/my-feature
```

### 6. Open Pull Request

Describe what you changed and why.

---

## Restricted Areas

Changes to the following areas require prior discussion and explicit approval
from the project owner:

- Cryptography and key derivation logic
- Authentication and session handling
- Vault encryption/decryption flows
- Authorization and access-control checks
- Any code that touches plaintext secrets

---

## Code Style

### TypeScript

- Use strict mode (default in project)
- No `any` types (use generics or union types)
- Prefer `const` over `let`
- Use arrow functions for callbacks

```typescript
// ✅ Good
const getUser = async (id: string): Promise<User> => {
  return await db.user.findUnique({ where: { id } })
}

// ❌ Bad
const getUser = (id: any) => {  // any type
  let user = db.user.findUnique({ where: { id } })  // no async/await
  return user
}
```

### Naming

- camelCase for variables/functions
- PascalCase for classes/types
- UPPER_SNAKE_CASE for constants
- Descriptive names (not `x`, `tmp`, `data`)

```typescript
// ✅ Good
const MAX_PASSWORD_LENGTH = 128
const isEmailVerified = true
function validateMetadata(meta: Metadata): boolean { ... }

// ❌ Bad
const max = 128
const x = true
function validate(m: any) { ... }
```

### Formatting

- Use Prettier (configured in project)
- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line objects

```bash
npm run lint -- --fix  # Auto-format
```

---

## Security Guidelines

### When Submitting PRs

Before submitting or merging this PR, I verified that:

- [ ] Secrets never logged or indexed
- [ ] Metadata safe (validateMetadataSafety used)
- [ ] User inputs validated (Zod schema)
- [ ] Rate limits applied (if auth endpoint)
- [ ] CSRF tokens checked (if state-changing)
- [ ] Email verification enforced (if sensitive)
- [ ] Encryption boundaries preserved (server can't decrypt)
- [ ] Audit logs created (if security event)
- [ ] Tests added for new and changed logic
- [ ] No security regressions

### Critical Security Rules

❌ **NEVER DO**:

1. Log plaintext secrets
2. Store partial secrets (masks, hints, prefixes)
3. Include secrets in metadata
4. Skip CSRF validation
5. Bypass email verification for sensitive operations
6. Weaken KDF/hashing parameters
7. Transmit master password to server
8. Store vault key unencrypted

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Suite

```bash
npm test -- metadata-validation
npm test -- vault-zero-knowledge
npm test -- authentication
```

### Watch Mode

```bash
npm test -- --watch
```

### Coverage Report

```bash
npm test -- --coverage
```

### Test Requirements

- All tests must pass
- New features must have tests
- Security features must have both positive and negative tests
- Edge cases and error handling tested

### Example Test

```typescript
// tests/my-feature.test.ts
describe('My Feature', () => {
  test('happy path works', () => {
    const result = myFeature({ valid: 'input' })
    expect(result).toBe('expected')
  })
  
  test('rejects invalid input', () => {
    expect(() => myFeature({ invalid: 'input' }))
      .toThrow('Invalid')
  })
  
  test('security: no plaintext logged', () => {
    const consoleSpy = jest.spyOn(console, 'log')
    myFeature({ secret: 'password' })
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('password')
    )
  })
})
```

---

## Documentation

### When Changing Code

Update relevant docs:

| Change | Update |
|--------|--------|
| New API endpoint | [API Overview](docs/api-overview.md) |
| New auth flow | [Authentication](docs/authentication.md) |
| New crypto algorithm | [Cryptography](docs/cryptography.md) |
| New environment variable | [Environment Variables](docs/environment-variables.md) |
| New test pattern | [Testing Strategy](docs/testing-strategy.md) |
| Security feature | [Threat Model](docs/threat-model.md) |

### Documentation Style

- Use clear, concise language
- Include code examples
- Explain the "why" not just "how"
- Link to related sections
- Add to [README.md](./README.md) navigation

---

## Git Workflow

### Commit Messages

Use conventional commits:

```
feat: add password strength indicator
fix: correct rate limit window calculation
docs: update API overview
test: add metadata validation tests
refactor: extract encryption logic
ci: add GitHub Actions workflow
```

### Branch Naming

```
feature/password-strength
bugfix/rate-limit-edge-case
docs/update-faq
test/add-breach-tests
refactor/extract-crypto
```

### Pull Request Title

```
✨ feat: Add password strength indicator
🐛 fix: Correct rate limit calculation
📝 docs: Update API overview
✅ test: Add missing tests
♻️ refactor: Extract encryption logic
```

---

## Code Review Process

### What Gets Reviewed

1. **Functionality**: Does it work as intended?
2. **Code quality**: Is it readable, maintainable?
3. **Security**: Does it preserve threat model?
4. **Tests**: Are they comprehensive?
5. **Documentation**: Is it clear and complete?

### Review Checklist

```markdown
## Security
- [ ] No secrets logged/transmitted
- [ ] Metadata validation enforced
- [ ] Encryption boundaries preserved
- [ ] CSRF/auth checks present
- [ ] Rate limits applied (if needed)

## Code Quality
- [ ] TypeScript strict mode
- [ ] No `any` types
- [ ] Naming is clear
- [ ] No unnecessary complexity

## Testing
- [ ] Tests pass (npm run ci)
- [ ] Tests added for new and changed logic
- [ ] Edge cases tested
- [ ] Security tests included

## Documentation
- [ ] Code comments (if needed)
- [ ] README/docs updated
- [ ] Examples provided
- [ ] Related docs linked
```

---

## Common Contributions

### Adding an Endpoint

1. **Define schema** ([app/schemas/](app/schemas/))
   ```typescript
   // app/schemas/my-schema.ts
   export const mySchema = z.object({
     name: z.string(),
     data: z.record(z.unknown())
   })
   ```

2. **Create route** ([app/api/](app/api/))
   ```typescript
   // app/api/my-endpoint/route.ts
   import { requireAuth } from '@/app/lib/auth-utils'
   
   export async function POST(req: Request) {
     const auth = await requireAuth(req)
     if (!auth.success) return auth.response
     
     const body = await req.json()
     const parsed = mySchema.safeParse(body)
     if (!parsed.success) {
       return NextResponse.json({ error: 'Invalid' }, { status: 400 })
     }
     
     // ... your logic
   }
   ```

3. **Add tests** ([tests/](tests/))
   ```typescript
   test('POST /api/my-endpoint creates resource', async () => {
     const res = await fetch('/api/my-endpoint', {
       method: 'POST',
       headers: { 'Authorization': `Bearer ${token}` },
       body: JSON.stringify({ name: 'test' })
     })
     expect(res.status).toBe(201)
   })
   ```

4. **Document** ([docs/api-overview.md](docs/api-overview.md))
   ```markdown
   ### POST /api/my-endpoint
   
   Create a new resource.
   
   **Request**: { "name": "..." }
   **Response** (201): { "id": "...", "name": "..." }
   ```

5. **Update README**
   - Add to [README.md](./README.md) navigation
   - Add to this file if new pattern

### Fixing a Bug

1. Create test that reproduces bug
2. Fix the bug
3. Verify test passes
4. Update docs if behavior changed
5. Submit PR with test + fix

### Improving Security

1. Document the threat being addressed
2. Implement fix
3. Add comprehensive tests (positive + negative)
4. Update [Threat Model](docs/threat-model.md)
5. Update [Security Model](docs/security-model.md) if needed

### Adding Tests

- Test happy path
- Test error cases
- Test edge cases (empty, null, huge)
- Test security (no leaks, no bypasses)

---

## Performance Considerations

- Encryption/decryption should be fast (<100ms per secret)
- Rate limiting lookups should be <1ms
- Database queries should use indexes
- No N+1 queries

---

## Accessibility

- Ensure UI works with keyboard only
- Use semantic HTML (buttons, links, etc.)
- Include ARIA labels where needed
- Test with screen readers

---

## Release Process

### Before Release

1. All tests pass (`npm run ci`)
2. No security warnings (`npm audit`)
3. Version bumped (semantic versioning)
4. Changelog updated
5. Security checklist verified

### Versioning

```
v0.1.0 (major.minor.patch)
  ^     ^     ^
  |     |     └─ Bug fixes, docs
  |     └───────── New features (non-breaking)
  └─────────────── Breaking changes
```

### Changelog Format

```markdown
## [0.2.0] - 2024-01-15

### Added
- Password reuse detection
- Breach checking with HIBP
- Rate limiting per user

### Fixed
- Session device binding not working with proxies
- Email verification token expiry not enforced

### Changed
- Improved password strength scoring

### Security
- Upgraded scrypt to v2, migrating old accounts
```

---

## Getting Help

- **Questions?** Open a discussion or email
- **Found a bug?** Open an issue with reproduction steps
- **Security issue?** Email akshaysbuilds@gmail.com (don't open public issue)
- **Feature idea?** Open an issue to discuss before implementing

---

## What We're Looking For

- Security improvements
- Bug fixes
- Documentation clarity
- Test coverage
- Performance improvements
- UI/UX enhancements

---

See also:
- [Testing Strategy](docs/testing-strategy.md) — How to test effectively
- [Security Model](docs/security-model.md) — Security principles
- [API Overview](docs/api-overview.md) — Endpoint patterns
