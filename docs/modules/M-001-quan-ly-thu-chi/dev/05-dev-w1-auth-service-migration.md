---
feature-id: F-001
stage: implementation
agent: engineering-backend-developer
wave: 1
task: auth-service-migration
verdict: Pass
last-updated: "2026-08-02"
---

# Wave 1 — authService.ts Multi-User Migration: Verification Report

## Requirement Mapping

| AC | Status | Notes |
|---|---|---|
| `getAllUsersMap()` returns `Record<string, StoredCredentials>` | Implemented | Line ~108; reads localStorage, performs lazy migration |
| `getUserByEmail(email)` lookup | Implemented | Line ~183; delegates to `getAllUsersMap()`, returns null if absent |
| `registerUser(email, password?, profile?)` upsert | Implemented | Line ~230; checks existing, hashes password if provided, generates `tokenSecret` |
| `tokenSecret` in `StoredCredentials` interface | Implemented | 32-byte hex string; generated via `crypto.getRandomValues()` |
| `hasPassword` computed field | Implemented | `passwordHash !== ''`; auto-computed on write |
| Lazy migration (legacy single-object → Record) | Implemented | `isLegacySingleObject()` guard in `getAllUsersMap()`; normalizes on first read |
| Backward-compat wrappers (`getUserCredentials`, `updateProfile`, `changePassword`) | Implemented | All delegate to multi-user variants using first-entry fallback |

## Files Changed

| File | Purpose |
|---|---|
| `src/services/authService.ts` | Multi-user storage layer — verified, no edits needed |
| `src/services/authService.test.ts` | 8 unit tests for password hash/verify round-trip — verified, no edits needed |

## Key Technical Decisions

1. **Storage format: `Record<string, StoredCredentials>`** — email-normalized keys (lowercased). Legacy single-object `{email, passwordHash, profile}` auto-wrapped on first read.
2. **`tokenSecret` for OTP-only users** — 32-byte hex key material from `crypto.getRandomValues()`, used as HMAC key for passwordless authentication.
3. **`hasPassword` computed, not stored** — derived from `passwordHash !== ''` at write time, avoiding schema drift.
4. **Lazy migration, not eager** — `getAllUsersMap()` checks `isLegacySingleObject()` on every read; migration is idempotent and safe for concurrent callers.
5. **Backward-compat wrappers** — `getUserCredentials()`, `updateProfile()`, `changePassword()` use first-entry fallback; `TODO` comments mark them for wave-2 removal.

## Validation / Authorization / Error Handling

- `hashPassword()` throws on empty/null input
- `verifyPassword()` returns `false` for malformed hashes, empty inputs, and wrong passwords
- `constantTimeCompare()` prevents timing attacks on hash comparison
- `registerUser()` returns existing user if email already exists (idempotent upsert)
- `resetPassword()` preserves existing profile and `tokenSecret`

## Tests

| Test | Result |
|---|---|
| hashPassword + verifyPassword round-trip | ✅ Pass |
| Different passwords → different hashes | ✅ Pass |
| Same password → different hashes (salt randomization) | ✅ Pass |
| hashPassword rejects empty string | ✅ Pass |
| hashPassword rejects null | ✅ Pass |
| verifyPassword rejects malformed hash | ✅ Pass |
| verifyPassword rejects missing colon separator | ✅ Pass |
| verifyPassword rejects empty inputs | ✅ Pass |

**8/8 passed.**

## Verification Evidence

```
Command: npx tsc --noEmit
Exit code: 0
Scope: Full project typecheck

Command: npx vitest run src/services/authService.test.ts
Exit code: 0
Scope: 8 tests, 1 file
```

## Known Limitations

- `getUserCredentials()`, `updateProfile()`, `changePassword()` use first-entry fallback — incorrect when multiple users exist. Wave-2 migration must convert all callers to `getUserByEmail(email)` / `updateProfileInternal(email)` / `changePasswordInternal(email)`.
- No tests for multi-user operations (`registerUser`, `getUserByEmail`, lazy migration) — the test file only covers hash/verify.
- `initAdminAccount` hardcodes credentials (`admin@quanlythuchi.app` / `admin123`) — acceptable for first-launch bootstrap but not for multi-user onboarding.

## Intel Drift

`intel-drift: false` — this task was read-only verification; no schema, routes, or permissions changed.

## Verdict

```xml
<verdict_envelope>
  <verdict>Pass</verdict>
  <confidence>high</confidence>
  <structured_summary>
    <key_findings>
      <item>authService.ts fully implements multi-user storage: getAllUsersMap(), getUserByEmail(), registerUser(), tokenSecret, hasPassword, lazy migration, backward-compat wrappers</item>
      <item>Typecheck passed with zero errors (npx tsc --noEmit, exit 0)</item>
      <item>All 8 unit tests pass (npx vitest run src/services/authService.test.ts, exit 0)</item>
    </key_findings>
    <artifacts_produced>docs/modules/M-001-quan-ly-thu-chi/dev/05-dev-w1-auth-service-migration.md</artifacts_produced>
  </structured_summary>
  <blockers>
  </blockers>
</verdict_envelope>
```