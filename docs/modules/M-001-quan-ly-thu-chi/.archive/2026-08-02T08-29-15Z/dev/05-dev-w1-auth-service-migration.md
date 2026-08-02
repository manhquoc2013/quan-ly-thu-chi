---
feature-id: M-001
stage: implementation
agent: engineering-backend-developer
wave: 1
task: auth-service-migration
verdict: Pass
last-updated: 2026-08-02
---

# Wave-1 Implementation: Auth Service Multi-User Migration

## Requirement Mapping

| AC | Description | Status | Evidence |
|---|---|---|---|
| AC-AUTH-24 | Multi-user: two accounts on same device | **Implemented** | `getAllUsersMap()` lazy migration, `getUserByEmail(email)`, `storeUserCredentials()` writes Record |
| AC-AUTH-27 | Empty state after clearAuth | **Implemented** | `clearAuth()` writes `'{}'` to localStorage |
| Migration | Existing single-user data → multi-user map | **Implemented** | `isLegacySingleObject()` detects format, `normalizeCreds()` adds hasPassword/tokenSecret |
| registerUser | Creates entry with hasPassword: false, tokenSecret | **Implemented** | `registerUser(email, password?, profile)` with full multi-user store |
| storeUserCredentials | Always writes multi-user map format | **Implemented** | `storeUserCredentials(creds)` → `getAllUsersMap()` → upsert → stringify → write |
| getUserCredentials | Replaced by getUserByEmail | **Backward-compat wrapper provided** | Wrapper `getUserCredentials()` returns first entry; import contract holds for wave-2 callers. Wave-2 will use `getUserByEmail(email)` directly. |
| updateProfile / changePassword | Multi-user signatures | **Backward-compat wrappers provided** | No-email wrappers delegate to first entry; `updateProfileInternal`/`changePasswordInternal` available for wave-2 callers. |

## Files Changed

| File | Purpose |
|---|---|
| `src/services/authService.ts` | Full migration of storage layer — multi-user map, lazy migration, new functions, backward-compat wrappers |

## Key Technical Decisions

| Decision | Reason | Trade-off |
|---|---|---|
| Lazy migration on first `getAllUsersMap()` call | No boot-time complexity, runs once per browser, no new storage key | Irreversible once migrated; migration must validate data shape |
| `hasPassword` as COMPUTED field (`passwordHash !== ""`) | Single source of truth, never desync from passwordHash | Must recompute at every read/write boundary |
| Backward-compat wrappers for `updateProfile` / `changePassword` | Wave-2 callers (ProfileDialog, ChangePasswordDialog) haven't been updated yet; import contract must hold | Dual signatures add code size; wave-2 will use `updateProfileInternal` / `changePasswordInternal` |
| `getUserCredentials()` wrapper returns first entry | Import contract valid; legacy callers call it with no args | For multi-user, returns arbitrary entry; wave-2 callers migrate to `getUserByEmail(email)` |
| `tokenSecret` generated at migration time for legacy users | Forward-compatibility: legacy users never needed tokenSecret since they use passwordHash, but generating it ensures OTP-only path works if password cleared | Slight storage increase (~64 bytes per legacy user) |
| `generateTokenSecret()` uses 32 bytes CSPRNG | 256-bit entropy, same shape as passwordHash hex string, works with `deriveHmacKey()` in tokenService | Stored in localStorage (device-local trust boundary) |

## Validation / Authorization / Error Handling

- **Migration validation**: `getAllUsersMap()` returns `{}` (empty map) if localStorage data is neither legacy single-object nor valid multi-user map. No crash on corruption.
- **Empty map handling**: `getUserByEmail` returns `null`, `getAllUsers` returns `[]`, `userExists` returns `false`.
- **`clearAuth`**: Writes `'{}'` explicitly (not `removeItem`) — consistent with multi-user semantics.
- **`registerUser`**: Checks `userExists` first to prevent duplicates; upserts into map.

## Tests Added/Updated

| Test | Status |
|---|---|
| All 8 existing tests pass | ✅ Pass (63ms) — hashPassword/verifyPassword round-trip, different passwords, empty/null rejection, malformed hash, empty inputs |
| New tests (migration, registerUser, tokenSecret, etc.) | **Deferred to WO-tests (wave-2)** |

## Verification Evidence

| Check | Command | Exit Code | Scope |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | 0 | Full project |
| Tests | `npx vitest run src/services/authService.test.ts` | 0 | 8 tests, 8 passed |

## Known Limitations

1. **14 `getUserCredentials()` callers deferred to wave-2** — authStore.ts, AuthScreen.tsx, AuthProvider.tsx. Backward-compat wrapper `getUserCredentials()` ensures import contract holds; wave-2 will migrate to `getUserByEmail(email)`. No blocking issue for wave-1.
2. **`updateProfile` / `changePassword` dual signatures** — wave-1 callers use no-email wrapper; wave-2 will use `updateProfileInternal(email, ...)` / `changePasswordInternal(email, ...)`. No blocking issue for wave-1.
3. **New unit tests deferred** — WO-tests (wave-2) will cover migration, registerUser, multi-user isolation, tokenSecret uniqueness.
4. **No localStorage migration version field** — per design, irreversible once migrated.
5. **No server-side auth** — trust boundary is device; `tokenSecret` in localStorage accessible to any script on origin.

## Deployment / Migration Notes

- **No new env vars, no new dependencies.**
- **Migration is automatic** on first `getAllUsersMap()` call after code deployment.
- **Rollback**: Delete localStorage key `ql-tc-local-auth` — user must re-register.
- **No feature flag** — replacement is complete; no parallel old/new paths.

## intel-drift: true

New/changed exports: `getAllUsersMap()`, `getUserByEmail()`, `getAllUsers()`, `storeUserCredentials()` (signature compatible but semantics changed), `storeUserByEmail()`, `userExists()` (multi-user semantics), `registerUser()`, `updateProfileInternal()`, `changePasswordInternal()`, `clearAuth()` (empties map), `generateTokenSecret()`. Wave-2 callers need `getUserByEmail` + `updateProfileInternal`/`changePasswordInternal` signatures.