# Breach Checks (HIBP K-Anonymity)

Vaultr supports optional breach indicators during password entry using the **Have I Been Pwned (HIBP)** API, while preserving strict zero-knowledge boundaries. This feature is OFF by default and must be explicitly enabled via a server-side upstream.

## Design Principles
- Client computes `SHA-1(password)` in-memory (HIBP requirement); only the first 5 hex characters (prefix) may leave the browser.
- SHA-1 is used ONLY for breach detection (never for storage, auth, reuse, or encryption).
- Client performs suffix matching on the server's text response (true k-anonymity).
- Client never calls third-party services directly. All requests must go through the internal proxy: `/api/breach?prefix=<5-hex>`.
- Proxy validates `prefix` is exactly 5 hex chars, forwards to `BREACH_UPSTREAM_URL/{prefix}`, and returns raw text response.
- Fail-open posture: on any error or missing config, return empty string and proceed without blocking or retries.
- No sensitive data is logged. Never log plaintext, hashes, or prefix values.

## Environment
- `BREACH_UPSTREAM_URL` (server-only, optional):
  - Required to enable breach checks.
  - Should be set to: `https://api.pwnedpasswords.com/range`
  - Server appends the 5-char prefix to form: `${BREACH_UPSTREAM_URL}/{PREFIX}`
- `NEXT_PUBLIC_BREACH_ENDPOINT` (optional):
  - Documentational only; not used by the client.
  - Do not call third-party endpoints from the browser.

## API Contract
- Internal route: `/api/breach?prefix=<5-hex>`
- Response format: Raw text (HIBP format)
  ```
  SUFFIX:COUNT
  SUFFIX:COUNT
  ...
  ```
- Client performs suffix matching locally
- On validation error (wrong length/non-hex), returns `400`
- On missing upstream or network failures, returns `200` with empty string (fail-open)

## HIBP K-Anonymity Flow
1. Client: `SHA-1(password)` → `"A94A8FE5CCBE2BA8CF..."` (hex, uppercase)
2. Client: Split into `prefix="A94A8"` and `suffix="FE5CCBE2BA8CF..."`
3. Client: Send only prefix to `/api/breach?prefix=A94A8`
4. Server: Forward to `https://api.pwnedpasswords.com/range/A94A8`
5. Server: Return raw text response to client
6. Client: Parse text, match suffix, ignore padded entries (count=0)
7. Client: Return `true` if exact suffix match found

## Security Notes
- A database leak of metadata must not reveal usable secret information.
- Never emit partial secrets, masks, or full hashes from the client.
- Keep breach lookups optional and ephemeral; do not persist results.
- SHA-1 collision resistance is not required for this use case (only preimage lookup).

