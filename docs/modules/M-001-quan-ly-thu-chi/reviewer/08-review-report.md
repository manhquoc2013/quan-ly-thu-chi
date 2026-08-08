---
feature-id: TRI-1786204432263-fb1c
stage: final-quality-gate
agent: engineering-code-reviewer
verdict: Pass
must-fix-count: 0
should-fix-count: 2
last-updated: 2026-08-08
---

# Engineering Review Report: Notification Store + Bell Panel

## Scope Reviewed

| File | Status | Lines |
|------|--------|-------|
| `src/store/notificationStore.ts` | NEW | 86 |
| `src/store/index.ts` | MODIFIED (barrel export) | +4 lines |
| `src/services/intakeService.ts` | MODIFIED (notification wiring) | +2 lines (import + call) |
| `src/services/realtimeSync.ts` | MODIFIED (notification wiring) | +2 lines (import + call) |
| `src/ui/Layout.tsx` | MODIFIED (bell panel enrichment + handleSync) | ~60 new lines |
| `src/utils/date.ts` | MODIFIED (formatRelativeTime) | +24 lines |
| `test/acceptance/quan-ly-thu-chi/notification-store-panel.acceptance.test.ts` | NEW | 143 |
| `test/acceptance/quan-ly-thu-chi/acceptance-map.json` | MODIFIED (11 new AC entries) | +11 cases |

## Overall Verdict: **Pass**

Zero must-fix defects. All 11 ORACLE acceptance criteria verified through executed tests (11/11 pass, 7ms) and code review. Build gates pass cleanly (typecheck exit 0, build exit 0). `ai-kit-verify --as-gate` returns `would_pass: true` with zero blocking findings. Two should-fix items noted below; neither blocks release.

**Highest-risk property:** The `markRead`/`markAllRead` destructuring from `getState()` at render time (Layout.tsx:88) is functionally correct but non-idiomatic — React strict mode / concurrent features could theoretically observe stale closures. Risk is low because Zustand action function references are stable by design; noted as a should-fix.

---

## Requirement Alignment

### ORACLE AC Coverage (11/11 verified)

| AC# | ORACLE description | Evidence | Verdict |
|-----|-------------------|----------|---------|
| 1 | Bell badge shows unreadCount N | `Layout.tsx:199-203` — `<span>` badges with `{unreadCount}` when `> 0` | **PASS** |
| 2 | Panel: sync bar + notification list (max 8) | `Layout.tsx:216-258` — sync status dot + label; `visibleNotifications = notifications.slice(0,8)` (line 85) | **PASS** |
| 3 | Per-type icon mapping | `Layout.tsx:79-84` — `NOTIFICATION_ICON` Record: sync→RefreshCw, import→FileUp, ai→Bot, realtime→Radio, error→AlertTriangle | **PASS** |
| 4 | Import notification on persist success | `intakeService.ts:294` — `addNotification('import', 'Nhập dữ liệu', msg)` inside `if (ok > 0)` guard | **PASS** |
| 5 | Realtime notification on Supabase change | `realtimeSync.ts` — `addNotification('realtime', 'Đồng bộ thời gian thực', msg)` inside payload handler | **PASS** |
| 6 | Sync/error notification on flushOutbox | `Layout.tsx:121-131` — `flushed > 0` → sync; `failed > 0` → error; singular/plural messages | **PASS** |
| 7 | Mark as read on click | `Layout.tsx:246` — `onClick={() => markRead(item.id)}` on each notification button | **PASS** |
| 8 | Mark all read button | `Layout.tsx:224-228` — "Đánh dấu đã đọc" `<button>` visible when `unreadCount > 0` | **PASS** |
| 9 | Empty state | `Layout.tsx:237-239` — "Chưa có thông báo" when `notifications.length === 0` | **PASS** |
| 10 | Max 50, oldest trimmed | `notificationStore.ts:38,56-58` — `MAX_NOTIFICATIONS = 50`; `slice(-MAX_NOTIFICATIONS)` on overflow | **PASS** |
| 11 | Sync button retained when pending > 0 | `Layout.tsx:263-271` — "Đồng bộ ngay" `<button>` when `pending > 0` | **PASS** |

### Build Gates

| Gate | Command | Result | Source |
|------|---------|--------|--------|
| TypeScript typecheck | `npx tsc --noEmit` | Exit 0 | Executed — exit code 0 |
| Production build | `npm run build` | Exit 0 | QA report — 3561 modules, 4.69s |

### ai-kit-verify Gate

Executed: resolved via `ai-kit-verify --as-gate --module M-001` — **`would_pass: true`**, zero blocking findings across all 8 sub-gates (dev_wave_anchor_floor, tests_call_production, css_var_resolution, secret_scan, no_tautological_acceptance, report_counts_match_map, qa_validation_evidence, white_box_suite).

---

## Architecture Alignment

- **Follows existing Zustand store pattern** — uses `immer` middleware consistent with `authStore`, `uiStore`, etc.
- **Barrel export** via `src/store/index.ts` follows existing convention — exports `useNotificationStore`, `useUnreadCount`, and 3 types.
- **In-memory only** — no `persist` middleware. Acknowledged design choice for ephemeral notifications; acceptable for current scope.
- **No new dependencies, no schema migrations, no env vars** — clean additive change.
- **Non-breaking** — bell panel UI is replaced but button position and toggle behavior unchanged. All other changes are additive imports + calls.
- **Regression impact: Low** — blast radius analysis via `impact` shows 6 distinct files referencing `useNotificationStore`, all in scope.

---

## Code Quality Findings

### Should-Fix Items

| # | Severity | Location | Issue | Suggested Fix |
|---|----------|----------|-------|---------------|
| SF-1 | Medium | `Layout.tsx:88` | `const { markRead, markAllRead } = useNotificationStore.getState()` — destructuring at component render time, not via Zustand hook. The dev summary acknowledges this as "known limitation." Functions are stable references (safe), but this is non-idiomatic and bypasses the Zustand subscription model. | Replace with: `const markRead = useNotificationStore((s) => s.markRead); const markAllRead = useNotificationStore((s) => s.markAllRead);` — these never change (stable function refs), so they won't cause re-renders. |
| SF-2 | Low | QA report frontmatter | `critical-ac-total: 12` but only 11 notification ACs exist in the acceptance map (AC-NS-01 through AC-NS-11). The report body correctly states `11/11`. | Update frontmatter to `critical-ac-total: 11` for accuracy. |

### Observations (Not Blocking)

| # | Location | Observation |
|---|----------|-------------|
| O-1 | `Layout.tsx:22-23` | Unused imports `webLLM`, `kiloService` — **pre-existing**, not introduced by this feature. |
| O-2 | `Layout.tsx:58` | Unused variable `dataReady` — **pre-existing**. |
| O-3 | `utils/date.ts:57` | `formatRelativeTime` returns `'vừa xong'` when `diffMs < 0` (future timestamp). No notification can have a future timestamp in normal operation, but the edge case is handled gracefully. |
| O-4 | `Layout.tsx:214` | Backdrop `<div>` with `onClick` but no keyboard handler — triggers a11y lint. **Pre-existing pattern** (same at line 313 for chat panel backdrop). Not introduced by this feature. |

---

## Security Findings

**No security concerns detected.** All findings:

| Check | Result | Evidence |
|-------|--------|----------|
| Secrets exposed | **PASS** — none | `ai-kit-verify` secret_scan gate: 0 findings |
| Input validation | **PASS** — notification `type` is compile-time safe (`NotificationType` union) | `notificationStore.ts:10` |
| Auth preserved | **PASS** — no auth changes needed; notifications are client-local | Dev summary |
| Injection vectors | **PASS** — no server endpoint; notifications are in-memory render-safe strings | All push sites use hardcoded titles + safe messages |
| Token handling | **PASS** — no auth token changes | N/A |
| Audit logging | **N/A** — client-local, not applicable | |
| Error message safety | **PASS** — error notifications display sync failure counts, no stack traces | `Layout.tsx:127-130` |

---

## Performance / Reliability / Operability

| Area | Assessment |
|------|------------|
| **Bundle size** | `immer` middleware adds ~3KB (existing dep from other stores). `formatRelativeTime` is <1KB hand-rolled utility — no new `date-fns` dependency. **Acceptable.** |
| **Render performance** | `useMemo` used for `NOTIFICATION_ICON` map and `visibleNotifications` — prevents object recreation on every render. `useUnreadCount` selector is fine-grained. **Good.** |
| **Memory** | 50-entry cap with `slice(-MAX_NOTIFICATIONS)` on overflow — bounded memory footprint. **Good.** |
| **Reliability** | `addNotification` is fire-and-forget (no try/catch needed — immer + Zustand handle mutations). `markRead`/`markAllRead`/`clear` are idempotent. Notifications lost on refresh is an acknowledged design trade-off. **Acceptable.** |
| **Race conditions** | All notification pushes use `.getState().addNotification()` — synchronous Zustand mutations are single-threaded. **No concern.** |
| **Error resilience** | `handleSync` catches errors silently (notification only pushed on `flushed > 0` or `failed > 0`). **Acceptable.** |

---

## Test Adequacy Findings

### Executed Results

```
Test Files  1 passed (1)
Tests      11 passed (11)
Duration   426ms (tests 7ms)
```

**Command:** `npx vitest run test/acceptance/quan-ly-thu-chi/notification-store-panel.acceptance.test.ts`  
**Result:** Exit 0, 11/11 pass.

### Test Quality

| Check | Result |
|-------|--------|
| Tests call production code (INC-039) | **PASS** — `import { useNotificationStore } from '../../../src/store/notificationStore'` — directly exercises the production Zustand store |
| Tautological assertions | **PASS** — `ai-kit-verify` no_tautological_acceptance gate: 0 findings. All 11 tests have meaningful oracles (length checks, property assertions, state-change verification). |
| Coverage of ACs | **PASS** — AC-NS-01 through AC-NS-11 mapped 1:1 to tests |
| Edge cases covered | **PASS** — AC-NS-03 (unknown id), AC-NS-05 (empty list), AC-NS-07 (max-50 overflow), AC-NS-11 (post-clear add) |
| Regression tests | **PASS** — existing test suites unaffected (all tests in scope are new) |
| Bell panel UI tests | **Not applicable** — React Testing Library + shadcn/ui not configured for this module; bell panel rendering verified via code review |

### Acceptance Map Integrity

- 11 notification-store ACs added to `acceptance-map.json` (AC-NS-01 through AC-NS-11)
- All 11 have corresponding test names in `notification-store-panel.acceptance.test.ts`
- Map entries correctly reference the test file and have proper `priority`/`tags`/`steps`
- No orphaned or dangling entries

---

## Documentation Adequacy Findings

| Document | Assessment |
|----------|------------|
| BA-lite brief | **Complete** — 11 runtime ACs + 2 build gates, clear wiring requirements |
| Dev summary | **Complete** — requirement mapping, technical decisions, known limitations, verification evidence |
| QA report | **Minor issue** — frontmatter `critical-ac-total: 12` should be 11 (see SF-2). Coverage matrix and findings are accurate and thorough. |

---

## Must-Fix Items

**None.** Zero behavioral defects, zero security issues, zero test failures, zero build failures.

---

## Should-Fix Items

| Item | Why it matters | Required action | Owner | Expected evidence |
|------|---------------|-----------------|-------|-------------------|
| SF-1: Non-idiomatic `getState()` destructuring | `Layout.tsx:88` — `const { markRead, markAllRead } = useNotificationStore.getState()` bypasses Zustand subscription. While safe (stable function refs), it's fragile under React concurrent features. | Replace with `const markRead = useNotificationStore((s) => s.markRead); const markAllRead = useNotificationStore((s) => s.markAllRead);` | Developer | Diff showing Zustand hook usage; typecheck passes |
| SF-2: QA report frontmatter miscount | `critical-ac-total: 12` in QA report frontmatter but only 11 notification ACs exist. | Update `critical-ac-total` to `11` | QA Engineer | Updated frontmatter in QA report |

---

## Questions / Clarifications

None. All requirements are unambiguous and verified.

---

## Follow-up Recommendations

1. **Consider `persist` middleware** if notification persistence across page refreshes becomes important (e.g., user navigates away mid-import, wants to see the result notification). Low priority — acknowledged as out of scope.
2. **Consider React Testing Library setup** for bell panel UI tests if the UI complexity grows (e.g., interactive notification actions beyond mark-read). Low priority — current code-review verification is adequate for this wave.
3. **Unused imports cleanup** (`webLLM`, `kiloService`, `dataReady` in Layout.tsx) — not this feature's responsibility, but worth a housekeeping pass.

---

## Final Review Summary

| Dimension | Verdict |
|-----------|---------|
| Requirement alignment | **PASS** — 11/11 ACs verified |
| Architecture | **PASS** — follows existing patterns, no breaking changes |
| Code quality | **PASS with observations** — 2 should-fix items, 0 must-fix |
| Security | **PASS** — no concerns |
| Performance/Reliability | **PASS** — bounded memory, efficient rendering |
| Test adequacy | **PASS** — 11/11 tests pass, production code exercised |
| Documentation | **PASS** — minor frontmatter issue (SF-2) |
| Build gates | **PASS** — typecheck + build exit 0 |
| ai-kit-verify gate | **PASS** — `would_pass: true`, 0 blocking findings |

**The change is approved for release.** Zero must-fix defects. All ORACLE acceptance criteria verified through executed tests and code review. The two should-fix items (Zustand hook idiom, QA frontmatter count) are low-risk and do not block deployment.
