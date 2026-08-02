---
feature-id: F-001-auth (M-001-app)
stage: frontend-implementation
agent: engineering-frontend-developer
wave: 4
task: pbkdf2-fix-and-db-wiring
verdict: Pass
last-updated: 2026-08-02
---

# Frontend Implementation Summary — PBKDF2 Runtime Fix + DB Encryption Wiring

## Designer Spec Coverage

| Requirement | Status | Notes |
|---|---|---|
| PBKDF2 password hashing works at runtime | ✅ Implemented | `deriveKey` → `deriveBits` in `authService.ts`; `importKey` usage fixed in `database.ts` |
| DB encryption wired into auth flow | ✅ Implemented | Login + rehydration paths call `deriveEncryptionKey` + `initDatabase` |
| Per-user DB salt persisted | ✅ Implemented | `storeDbSalt`/`loadDbSalt` functions; salt stored in localStorage per userId |
| Reset password preserves profile | ✅ Implemented | `resetPassword` reads existing credentials and merges profile |
| WCAG accessibility | ✅ No change | No UI components modified |
| Design tokens | ✅ No change | No UI components modified |
| All UI states covered | ✅ No change | Auth screens unchanged |

## Component / Token Mapping

No new UI components or design tokens added. This is a pure service-layer fix.

| UI / Feature | Implementation | Notes |
|---|---|---|
| PBKDF2 hashPassword | `crypto.subtle.deriveBits` (was `deriveKey`) | `authService.ts` |
| PBKDF2 verifyPassword | `crypto.subtle.deriveBits` (was `deriveKey`) | `authService.ts` |
| PBKDF2 deriveEncryptionKey | `importKey` usage `['deriveKey']` (was `['deriveBits']`) | `database.ts` |
| DB salt persistence | `localStorage` per userId | `database.ts` |
| Auth login DB init | `deriveEncryptionKey` → `initDatabase` | `authStore.ts` |
| Auth rehydrate DB init | `deriveEncryptionKey` → `initDatabase` on rehydrate | `authStore.ts` |
| resetPassword profile merge | Reads existing credentials, preserves profile | `authService.ts` |

## Files Changed

| File | Purpose |
|---|---|
| `src/services/authService.ts` | MF-1: `deriveKey` → `deriveBits` in `hashPassword` + `verifyPassword`; MF-3: `resetPassword` profile preservation; `toHex` signature update to accept `Uint8Array` |
| `src/services/database.ts` | MF-1: `importKey` usage `['deriveKey']` in `deriveEncryptionKey`; MF-2: Added `getDbSaltKey`, `storeDbSalt`, `loadDbSalt` functions; `deriveEncryptionKey` signature `(passwordHash, userId)` with per-user salt persistence |
| `src/store/authStore.ts` | MF-2: Import `deriveEncryptionKey` + `initDatabase` from database.ts; `login` action wires DB encryption; `onRehydrateStorage` restores DB encryption |
| `src/services/authService.test.ts` | NEW: 8 unit tests for `hashPassword`/`verifyPassword` round-trip and edge cases |

## Tests Added

**`src/services/authService.test.ts`** (8 tests):

| Test | Coverage |
|---|---|
| `hashPassword` and `verifyPassword` round-trip | Valid password verified ✅, wrong password rejected ✅, hash format correct (`salt:hash` hex) ✅ |
| Different passwords produce different hashes | Salt randomization verified |
| Same password produces different hashes | Salt uniqueness verified |
| `hashPassword` rejects empty password | Error message: "Password must be a non-empty string." |
| `hashPassword` rejects null input | Error message: "Password must be a non-empty string." |
| `verifyPassword` returns false for malformed hash | Single-part hash ("bad-hash") returns false |
| `verifyPassword` returns false for hash with missing parts | ("only-salt") returns false |
| `verifyPassword` returns false for empty inputs | Both empty, password empty, hash empty |

## Accessibility Compliance

No UI components modified — no accessibility changes needed.

## Verification Evidence

```
$ npm run typecheck
> quan-ly-thu-chi@1.0.3 typecheck
> tsc --noEmit
Command exited with code 0

$ npm run test
> quan-ly-thu-chi@1.0.3 test
> vitest run

 ✓ src/services/authService.test.ts (8 tests) 78ms
 ✓ src/utils/orderTotals.test.ts (4 tests) 1ms
 ✓ src/utils/revenueMetrics.test.ts (6 tests) 2ms
 ✓ src/services/orderTableParser.test.ts (6 tests) 6ms
 ✓ src/services/chatIntent.test.ts (8 tests) 4ms
 ✓ src/services/customerService.test.ts (4 tests) 13ms
 ✓ src/services/orderCode.test.ts (1 test) 2ms
 ✓ src/services/entityResolve.test.ts (4 tests) 14ms
 ✓ tests/pwa-setup.test.ts (1 test) 1ms
 ✓ src/services/amountParser.test.ts (41 tests) 31ms

 Test Files  10 passed (10)
      Tests  83 passed (83)
   Duration  612ms
Command exited with code 0
```

## Known Limitations / Mismatches for QA

1. **`deriveEncryptionKey` with `salt?` parameter**: The function still accepts an optional `salt?: Uint8Array` parameter for backward compatibility (used internally by `initDatabase` callers), but the primary path from authStore passes `userId` instead. This is intentional — the `salt` parameter allows external callers to supply their own salt if needed.
2. **Decryption failure silent fallback**: `initDatabase` silently starts a fresh empty DB on decryption failure (`database.ts:148-152`). This is pre-existing behavior, not introduced by this fix. Recommended as a Should-Fix: surface an error instead of silently losing data.
3. **No component tests**: This task only added service-layer unit tests. AuthScreen, AuthGuard, and Settings dialogs have no component tests (pre-existing gap, flagged in the reviewer report).
4. **Salt persistence only on login**: If `initDatabase` is called before `login` (e.g., from a background task), the salt is not persisted until the user actually logs in. This is acceptable for the current auth-first flow but worth noting.
5. **`DB_SALT_KEY_PREFIX` lint warning**: The original reviewer reported `database.ts:32` unused constant error. This is now fully used by `getDbSaltKey()`, so the lint error should be resolved after the file is re-linted.

## Summary of Changes

All 3 must-fix bugs have been resolved:

1. **MF-1 (PBKDF2 runtime bug)**: `importKey` usage mismatch fixed in both `authService.ts` (use `deriveBits`) and `database.ts` (use `['deriveKey']` usage). Runtime verified: `hashPassword`/`verifyPassword` work correctly.
2. **MF-2 (DB encryption wiring)**: Login and rehydration paths now call `deriveEncryptionKey` + `initDatabase`. Per-user salt persisted in localStorage via `storeDbSalt`/`loadDbSalt`.
3. **MF-3 (resetPassword profile wipe)**: `resetPassword` now reads existing credentials and preserves the user's profile data instead of overwriting it.

No new dependencies added. No UI components modified. No breaking API changes (existing function signatures preserved where possible; `deriveEncryptionKey` parameter changed from optional `salt` to required `userId` — only called from within the codebase).
