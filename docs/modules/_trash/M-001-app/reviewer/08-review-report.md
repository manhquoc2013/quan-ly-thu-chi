---
feature-id: F-001-auth (M-001-app)
stage: final-quality-gate
agent: engineering-code-reviewer
verdict: Changes-requested
must-fix-count: 2
should-fix-count: 5
last-updated: 2026-08-02
---

# Final Quality Gate Re-Review — Auth Feature after MF-1..MF-3 Fixes (Wave 4)

## Scope Reviewed

- **Change under review**: Wave-4 fix set `pbkdf2-fix-and-db-wiring` (`docs/modules/M-001-app/dev/05-fe-dev-w4-pbkdf2-fix-and-db-wiring.md`, verdict Pass) resolving the three must-fix items from the prior review:
  - MF-1: PBKDF2 `deriveBits` in `authService.ts`; `deriveKey` (CryptoKey) kept in `database.ts`.
  - MF-2: `deriveEncryptionKey` + `initDatabase(userId, key)` wired into `authStore.login` and `onRehydrateStorage`; per-user salt persisted via `storeDbSalt`/`loadDbSalt`.
  - MF-3: `resetPassword` preserves existing profile.
- **Files read in full** (LSP documentSymbol-mapped first): `src/services/authService.ts`, `src/services/database.ts`, `src/store/authStore.ts`, `src/services/authService.test.ts`, `src/ui/screens/auth/AuthScreen.tsx` (login/reset call sites), `src/ui/components/AuthProvider.tsx`, `src/services/cacheManager.ts`, `src/store/expenseStore.ts`.
- **Context read**: prior review report, dev summaries w1/w1.5/w3/w4/w5, QA report w1 (Pass), feature brief F-001 (stub), SA/BA docs for M-001-quan-ly-thu-chi, `_state.md`.
- **Note**: `ai-mcp_kb-query` is not granted to this agent; all claims are grounded in primary source reads, grep call-site evidence, and executed build/test/lint gates.

## Build Verification (executed by this reviewer)

| Gate | Command | Result | Evidence |
|---|---|---|---|
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | ✅ PASS (exit 0) | Zero diagnostics |
| Tests | `npm run test` (`vitest run`) | ✅ PASS — **83/83** (10 files, 635ms) | `pwa-setup 1`, `revenueMetrics 6`, `orderTableParser 6`, `chatIntent 8`, **`authService 8`**, `customerService 4`, `entityResolve 4`, `orderCode 1`, `orderTotals 4`, `amountParser 41` |
| Lint (reviewed files) | `npx eslint <7 files> --max-warnings 0` | ⚠️ PASS with warnings — **0 errors** (was 1), **4 warnings** | `authService.ts:63` unused eslint-disable; `authStore.ts:205` max-depth; `AuthGuard.tsx:31` unused eslint-disable; `AuthScreen.tsx:109` complexity 26. The `database.ts:32` unused `DB_SALT_KEY_PREFIX` **error is resolved** (now used by `getDbSaltKey`) |
| Pre-approve gate | `ai-kit-verify` (cross_references,completeness,schemas,projection_freshness,inheritance_coherence,aggregate_size,naming_consistency) | ✅ **No HIGH findings** | 1 low (completeness skipped — no current_stage), 1 medium (inheritance-policy.json missing, pre-existing) |
| S-003 cross-cutting gate | `ai-kit-query cross-cutting-pending --module M-001` | ✅ 0 pending | Empty result |

### Runtime verification of MF-1 (via new unit tests, executed this session)

The 8 new tests in `src/services/authService.test.ts` execute the **real Web Crypto** primitives in Node (same W3C spec as browsers):

- `hashPassword`/`verifyPassword` round-trip: valid ✅, wrong password rejected ✅
- hash format `saltHex(32):hashHex(64)` ✅, salt randomization (same password → different hash) ✅
- empty/null password rejected with `"Password must be a non-empty string."` ✅
- malformed hash (`bad-hash`), missing part (`only-salt`), empty inputs → `false` ✅

These tests would have failed against the pre-fix `deriveKey` implementation (which threw `InvalidAccessError`), so MF-1 is **runtime-verified fixed**.

## MF Verification Summary

| Must-Fix | Verdict | Evidence |
|---|---|---|
| **MF-1** PBKDF2 `deriveBits` | ✅ **RESOLVED** | `authService.ts:83-89` `importKey(...,['deriveBits'])` + `:91-95` `crypto.subtle.deriveBits(...,256)`; `verifyPassword` `:119-131` same pattern; `database.ts:279-293` `importKey(...,['deriveKey'])` + `subtle.deriveKey(...)` for AES-GCM — both usages now match their respective APIs. 8/8 new tests pass (runtime). |
| **MF-2** DB encryption wired + per-user salt | ⚠️ **PARTIALLY RESOLVED — must-fix remains** | Wiring exists: `authStore.ts:126-127` (login) and `:206-207` (rehydrate) call `deriveEncryptionKey`+`initDatabase`; `database.ts:31-46` `DB_SALT_KEY_PREFIX`/`storeDbSalt`/`loadDbSalt` persist per-user salt in localStorage. **BUT the active data path is untouched** (see MF-2 finding below): all 5 stores + 5 services + `googleDrive.ts` still persist to plaintext fixed cache keys; the encrypted sql.js DB has **zero data consumers**. |
| **MF-3** `resetPassword` preserves profile | ✅ **RESOLVED (code)** — ⚠️ test missing | `authService.ts:216-224` loads `getUserCredentials()`, keeps `existingProfile` when `existingProfile.email?.toLowerCase() === email.toLowerCase()`, else falls back to `{storeName:'',email}`. Correct. **However no unit test asserts this** — the 8 new tests cover only `hashPassword`/`verifyPassword`. |

## Overall Verdict

**Changes-requested.** Two must-fix items remain:

1. **MF-2 is not substantively resolved**: the encrypted, user-scoped sql.js database is initialized on login but **no application data flows through it**. The active persistence path (`cacheManager` → IndexedDB) still uses fixed, plaintext, cross-user keys (`expenses`, `revenues`, `customers`, `products`, `orderPlatforms`). Two users on one browser **still share the same data** behind the auth gate — the exact security gap MF-2 was raised for. The prior review's required action ("wire user-scoped keys + encryption into the **active** persistence path", "remove the silent fresh-DB fallback", "add a unit test proving encrypt→persist→reload→decrypt round-trip") is only 1-of-3 done (salt persistence).
2. **NEW data-loss hazard introduced by the wiring (key rotation)**: `deriveEncryptionKey` derives the AES-GCM key from `passwordHash` (`database.ts:287-293`). `changePassword` (`authService.ts:196`) and `resetPassword` (`:214`) replace `passwordHash`. On the next login the derived key differs → `initDatabase` hits the **silent fresh-DB fallback** (`database.ts:148-152`) → previously encrypted user DB is discarded as if empty. Combined with MF-3's reset flow, a routine "forgot password" now guarantees loss of any data ever stored in the encrypted DB. The fallback the prior review explicitly required to be removed is still present and now reachable.

## Requirement Alignment

| Requirement | Status | Evidence |
|---|---|---|
| PBKDF2 password hashing works at runtime (MF-1) | ✅ Resolved | 8/8 runtime tests pass; `deriveBits` usage correct in both `authService.ts` paths |
| AES-GCM DB encryption, user-scoped keys (MF-2) | ❌ **Not delivered on the active path** | Encrypted sql.js DB initialized (`authStore.ts:126-127,206-207`) but nothing reads/writes app data through it — `getDB`/`execute`/`queryAll`/`exportDatabase`/`loadFromBinary`/`saveToCache` have **zero external callers** (grep across `src`: only definitions in `database.ts` itself; `authStore.ts` imports only `initDatabase`/`deriveEncryptionKey`/`closeDatabase`) |
| Multi-user DB isolation | ❌ **Not delivered** | `expenseStore.ts:24 'expenses'`, `revenueStore.ts:17 'revenues'`, `customerStore.ts:17 'customers'`, `productStore.ts:10 'products'`, `platformStore.ts:10 'orderPlatforms'` + identical keys in `expenseService.ts:16`, `revenueService.ts:21`, `customerService.ts:11`, `productService.ts:11`, `platformService.ts:15`, and `googleDrive.ts:314-318` — all plaintext, all fixed, all shared across users |
| Per-user DB salt persisted (MF-2 part) | ✅ Resolved | `database.ts:31-46`; `deriveEncryptionKey` stores salt on first derivation |
| resetPassword preserves profile (MF-3) | ✅ Resolved (code) | `authService.ts:216-224` email-matched profile merge |
| No silent data loss on decrypt failure | ❌ Still failing | `database.ts:148-152` catch → `new SQL.Database()` fresh empty DB |

## Architecture Alignment

- **Layering**: the wiring follows UI → Store → Service (authStore delegates to authService/tokenService/database) — consistent with the codebase pattern; the wave-4 change itself adds no new layering violations beyond those already noted (store-side side effects in `authStore.login`, pre-existing pattern).
- **Dead architecture persists**: `database.ts` (sql.js + AES-GCM) remains a **shadow system**. The real persistence layer is `cacheManager` (IndexedDB key-value). After wave 4, `database.ts` is initialized in memory at login and immediately abandoned — `execute()` (the only mutation path that calls `saveToCache()`) has no callers, so the encrypted DB is never even persisted to IndexedDB. This is the core of the unresolved MF-2.
- **New coupling**: `authStore` now imports `database.ts` purely to satisfy a security requirement that the active data path never uses — dead-weight wiring that increases bundle surface (sql.js WASM fetch from `https://sql.js.org/dist/` at `database.ts:148` happens on **every login**) without protecting any actual data.

## Code Quality Findings

| Severity | Finding | Location |
|---|---|---|
| **High** | Key rotation = data loss: AES key derived from `passwordHash`; password change/reset replaces the hash → next login derives a different key → silent fresh-DB fallback discards the encrypted DB | `database.ts:287-293` (derive from hash) × `authService.ts:196,214` (hash replaced) × `database.ts:148-152` (silent fallback) |
| Medium | `deriveEncryptionKey` reads `loadDbSalt` twice (`const saltBytes = loadDbSalt(userId) ?? ...; if (!loadDbSalt(userId)) ...`) — double localStorage read, benign but sloppy | `database.ts:275-276` |
| Medium | `login()` still not awaited at call sites; second `generateToken(trimmed, hash)` with raw-email userId overwrites semantics (SF-1, pre-existing, still open) | `AuthScreen.tsx:227-228`, `:289-290` vs `authStore.ts:114-117` (SHA-256 userId) |
| Low | Lint debt reduced but not zero: 4 warnings (2 unused eslint-disable directives, max-depth 4, complexity 26). 0 errors now (was 1) — `DB_SALT_KEY_PREFIX` error fixed | `authService.ts:63`, `authStore.ts:205`, `AuthGuard.tsx:31`, `AuthScreen.tsx:109` |
| Obs | `loadFromBinary` indentation drift (`database.ts:203`), duplicated hex helpers across authService/tokenService (pre-existing, nice-to-have) | `database.ts:203` |

Function-length/clean-code: all functions < 100 lines; error handling present; no console.log additions (only `console.error` in authStore DB-init catch, acceptable). No spaghetti introduced.

## Security Findings

| Check | Result | Evidence |
|---|---|---|
| PBKDF2 100k/SHA-256/16B salt, runtime-working | ✅ | `authService.ts:79,92`; runtime-verified by 8 passing tests |
| Constant-time compare | ✅ | `authService.ts:42-52` XOR accumulator |
| AES-GCM deriveEncryptionKey correct CryptoKey usage | ✅ (primitive-level) | `database.ts:279-293` `['deriveKey']` + `deriveKey` → AES-GCM 256; `encryptBinary`/`decryptBinary` IV-prepend format correct (`database.ts:301-340`) |
| **Data-at-rest protection of real user data** | ❌ | Active stores/services/Drive sync write plaintext to fixed IndexedDB keys (see Requirement Alignment) — encryption protects a database nothing uses |
| **Key rotation / data-loss on password change/reset** | ❌ **NEW** | Key derived from `passwordHash`; hash rotates on change/reset; silent fresh-DB fallback `database.ts:148-152` discards data |
| Decrypt failure surfaces an error | ❌ | `database.ts:148-152` silently starts empty DB (explicitly required to be removed by prior MF-2) |
| Salt persistence | ✅ | `storeDbSalt`/`loadDbSalt` per `ql-tc-db-salt_<userId>` (`database.ts:31-46`) |
| Secrets hygiene | ✅ | No hardcoded secrets in reviewed files |

## Performance/Reliability/Operability Findings

- **Perf (new)**: `initDatabase` fetches the sql.js WASM binary from `https://sql.js.org/dist/` on **every login** (`database.ts:148`) even though no data flows through it — a wasted network round-trip and third-party dependency on each auth. If the encrypted DB is not actually serving data, this is pure overhead; should be removed or deferred until the DB path is real.
- **Reliability (new, critical)**: password change/reset → key mismatch → silent empty DB (see MF-2 finding). Any user who ever stores data in the encrypted DB and later resets their password loses it without warning.
- **Reliability (pre-existing, still open)**: `AuthProvider` catch-all `logout()` on any error force-logs-out (`AuthProvider.tsx:57-59`); refresh timer not re-scheduled after visibility resume (SF-6).
- **Operability**: `VITE_RESEND_API_KEY` still undocumented in `.env.example`/README (SF-8, unchanged); feature brief F-001 still a stub.

## Test Adequacy Findings

- ✅ **83/83 tests pass** (10 files), including the new `authService.test.ts` (8 tests) — the exact class of runtime regression that caused MF-1 is now covered by executing tests.
- ❌ **No tests for MF-2's closure criteria**: no `deriveEncryptionKey`/`encryptBinary`/`decryptBinary` round-trip test, no `initDatabase` persist→reload→decrypt test, no two-user isolation test — all explicitly required by the prior MF-2 closure criteria. These tests are pure and trivially writable (the primitives are correct; the wiring is what lacks proof).
- ❌ **No `resetPassword` test** asserting profile preservation (MF-3 closure criteria). The code is correct on inspection; it needs a regression test.
- ❌ No tests for `authStore.login`/`onRehydrateStorage` DB wiring (would have surfaced the key-rotation hazard).
- Component tests (AuthScreen/AuthGuard/dialogs) still absent (pre-existing gap).

## Documentation Adequacy Findings

- Wave-4 dev summary is accurate about *what it did* (wiring, salt, deriveBits, profile merge) and honestly flags the silent fresh-DB fallback as remaining. It overstates MF-2 as fully "Implemented" given the active path is untouched.
- F-001 feature brief remains a stub (`[CẦN BỔ SUNG]` everywhere); `.env.example` lacks `VITE_RESEND_API_KEY` (pre-existing SF-8, unchanged).
- `_state.md` completed-stages still stale (auth waves not recorded) — process bookkeeping, pre-existing.

## Must-Fix Items

| # | Item | Why it matters | Required action | Owner | Expected evidence | Closure criteria |
|---|---|---|---|---|---|---|
| MF-2 (reopened) | **Encryption + user isolation still not on the ACTIVE data path** — all stores/services/Drive sync persist plaintext to fixed cross-user keys (`expenses`, `revenues`, `customers`, `products`, `orderPlatforms`); the encrypted sql.js DB is initialized at login but has zero data consumers (`getDB`/`execute`/`queryAll`/`saveToCache` uncalled) | The stated security requirement ("AES-GCM DB encryption, user-scoped keys, multi-user isolation") is still not delivered; two users on one browser still share data behind the auth gate | Wire user-scoped keys + encryption into the **active** persistence path (route store/service persistence through `database.ts` or scope the `cacheManager` keys per `userId` and encrypt values), **or** explicitly descope the requirement in the spec; either way add the encrypt→persist→reload→decrypt round-trip test and a two-user isolation test | engineering-backend-developer (wave owner) | Grep shows active stores/services writing through user-scoped/encrypted path; unit test round-trips encrypted persistence across simulated reload; isolation test proves user A data invisible to user B | `npm run test` green with new database/store tests; code review confirms active data path is protected |
| NEW (MF-4) | **Key rotation silently destroys encrypted data** — AES key derived from `passwordHash`; `changePassword`/`resetPassword` replace the hash; next login derives a different key and `initDatabase`'s silent fresh-DB fallback (`database.ts:148-152`) discards the previous DB | Any password change/reset guarantees loss of previously encrypted data once the encrypted path holds data; contradicts the "no data loss" closure criterion | Make the DB key independent of the current password hash (e.g., stable per-user master key, or re-encrypt DB on password change/reset), **and** replace the silent fresh-DB fallback with a surfaced error (no silent data loss) | engineering-backend-developer (wave owner) | Unit test: encrypt with key K1 → simulate password change → re-derive → decrypt succeeds or a loud error is thrown, never a silent empty DB; code review confirms fallback removed | Test proves no silent data loss across password change/reset; `initDatabase` decrypt failure throws |

## Should-Fix Items

| # | Item | Location | Impact |
|---|---|---|---|
| SF-1 | Add `resetPassword` unit test asserting profile (storeName/address/phone) survives reset; hash-only replaced | `src/services/authService.test.ts` | MF-3 code is fixed but unguarded against regression |
| SF-2 | Await `login()` and drop the second inconsistent `generateToken` call (raw email vs SHA-256 userId) | `AuthScreen.tsx:227-228,289-290` | Floating promise; token payload semantics inconsistent (pre-existing SF-1) |
| SF-3 | Re-issue session token after `changePassword`; update `sessionExpiresAt` on refresh | `authService.ts:189-205`, `AuthProvider.tsx:64-66` | Silent forced logout after password change (pre-existing SF-2/SF-5) |
| SF-4 | Fix 4 lint warnings so `--max-warnings 0` passes | `authService.ts:63`, `authStore.ts:205`, `AuthGuard.tsx:31`, `AuthScreen.tsx:109` | CI lint gate fails (pre-existing SF-9; improved from 1 error) |
| SF-5 | Remove/defer the inert sql.js init at login until the DB path is real, or document it as intentional; document `VITE_RESEND_API_KEY`; populate F-001 brief | `authStore.ts:126-127,206-207`; repo docs | Wasted WASM fetch per login; onboarding/deploy readiness (pre-existing SF-8 + new perf note) |

## Questions/Clarifications

1. **Q1 (Isolation scope, repeated)**: Is "multi-user DB isolation" a hard requirement, or is "one user per device/browser" acceptable? If the latter, descope MF-2 explicitly in the spec so the plaintext fixed-key path is a documented decision, not an accident.
2. **Q2 (DB strategy)**: Is the sql.js DB intended to become the system of record (per SA ADR-003), or was the encryption requirement satisfied by the *existence* of the primitive? The current code initializes it at every login but nothing reads/writes it — please confirm the target architecture so the wiring is either completed or removed.
3. **Q3 (Key-derivation design)**: Was the AES key deliberately derived from `passwordHash` (so a password reset intentionally renders old data unrecoverable), or is this an oversight? Either way the current **silent** fresh-DB behavior is unacceptable — the user must be told, not silently reset.

## Follow-up Recommendations

1. Resolve MF-2 by either completing the active-path wiring or descoping it in the spec — the current half-state (initialized-but-unused encrypted DB + plaintext active keys) delivers neither security nor simplicity.
2. Fix the key-rotation data-loss path (MF-4) and remove the silent fresh-DB fallback; add a regression test for the change-password → re-login cycle.
3. Add the two missing test groups: `database.ts` crypto round-trip + `resetPassword` profile preservation.
4. Re-run lint and clear the 4 warnings so CI `--max-warnings 0` is green.
5. Update `_state.md` with the auth waves' PASS verdicts (process bookkeeping).

## Final Review Summary

**Progress is real**: MF-1 is definitively fixed — the PBKDF2 primitive now runs correctly and is protected by 8 executing unit tests; the prior `DB_SALT_KEY_PREFIX` lint error is resolved; `resetPassword` preserves profiles (verified by inspection); typecheck, all 83 tests, and the ai-kit-verify pre-approve gate are green; the S-003 dependency gate is clear.

**But the change cannot ship**: MF-2's substance — protecting the user's actual data with encryption and per-user isolation — is still not delivered. The wave-4 wiring initializes an encrypted sql.js database that no application data ever flows through, while every real store and service continues to persist plaintext to fixed, cross-user IndexedDB keys. Worse, the new wiring introduces a live data-loss path: because the AES key derives from `passwordHash`, any password change or forgot-password reset silently makes the previous encrypted DB undecryptable, and the still-present silent fresh-DB fallback (`database.ts:148-152`) discards it without a word. Two must-fix items remain; **verdict: Changes-requested**.

**Evidence index**: `npm run typecheck` (exit 0), `npm run test` (83/83, output quoted), `npx eslint <7 files> --max-warnings 0` (0 errors/4 warnings, output quoted), `ai-kit-verify` (no HIGH), `ai-kit-query cross-cutting-pending` (0 rows), grep call-site evidence (all 5 stores, 5 services, googleDrive.ts fixed keys; zero external callers of `getDB`/`execute`/`queryAll`/`saveToCache`/`exportDatabase`/`loadFromBinary`), full reads of the 4 key files + AuthScreen/AuthProvider/cacheManager/expenseStore.
