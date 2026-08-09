---
feature-id: fix-hscroll-whitespace
triage: TRI-1786271603870-7018
stage: final-quality-gate
agent: engineering-code-reviewer
verdict: Pass
must-fix-count: 0
should-fix-count: 1
last-updated: "2026-08-09"
---

# Code Review Report — Fix Horizontal Scroll Whitespace on Tables

## Scope Reviewed

Mechanical CSS class change: replace `w-full` with `min-w-full` on 12 `<table>` elements across 8 files, plus 5 companion `overflow-x-auto` → `overflow-x-auto overflow-y-hidden` improvements on wrapping `<div>` elements.

**Triage reference:** TRI-1786271603870-7018

## Overall Verdict

**Pass.** All 12 `w-full` → `min-w-full` changes are correct and verified. Zero `<table>` elements retain the old `w-full`. The companion overflow changes are desirable. One documentation inaccuracy found (should-fix). No code defects.

## Requirement Alignment

| Requirement | Status | Evidence |
|---|---|---|
| Replace `w-full` → `min-w-full` on 12 `<table>` elements | ✅ Pass | Live file read of all 8 files confirmed `min-w-full` at all 12 claim lines |
| No remaining `w-full` on `<table>` elements | ✅ Pass | `grep '<table[^>]*className="[^"]*w-full[^"]*"'` → zero matches |
| TypeScript compilation clean | ✅ Pass | `npx tsc --noEmit` exit 0 (QA-verified, reviewer gate also clean) |

## Architecture Alignment

N/A — CSS-only change with no architectural impact.

## Code Quality Findings

### Observation O-01: Companion `overflow-y-hidden` changes (desirable)

**Files:** `src/ui/screens/report/InventoryReport.tsx:109,150,212`, `src/ui/screens/dashboard/TransactionDetailModal.tsx:419`, `src/ui/screens/revenue/OrderRowCard.tsx:161`

The wrapping `<div>` elements were changed from `overflow-x-auto` to `overflow-x-auto overflow-y-hidden`. This suppresses a vertical scrollbar flicker that can occur when the horizontally-scrolling table temporarily exceeds the container height. This is a well-judged companion improvement that directly complements the `min-w-full` fix.

**Severity:** Observation — no action required.

### Observation O-02: Unrelated changes in same commit (acceptable for personal repo)

The commit `4af3bcc` ("feat: implement priority handling for orders and enhance UI interactions") bundles the hscroll fix with:
- Priority feature additions in `OrderRowCard.tsx` and `OrderDialog.tsx`
- Modal height adjustments (`h-auto`, `max-h-[calc()]`) in `TransactionDetailModal.tsx` and `OrderDialog.tsx`

These are NOT part of this hscroll task and do NOT affect the correctness of the 12 table changes under review. In a team CI-reviewed repo, this would warrant a separate commit; for a personal project this is acceptable.

**Severity:** Observation — no action required.

## Security Findings

None. CSS class substitution only. Zero JavaScript/TypeScript logic changed within the hscroll scope.

## Performance/Reliability/Operability Findings

None. `min-w-full` is a functional superset of `w-full`: tables that fit within the container remain visually unchanged; tables with wider content now expand correctly. Zero behavioral risk.

## Test Adequacy Findings

N/A — CSS-only change. No unit/integration tests warranted. `npx tsc --noEmit` exit 0 confirms the codebase remains type-safe.

## Documentation Adequacy Findings

### Should-fix SF-01: Implementation summary understates change scope

**Evidence:** `docs/modules/M-001-quan-ly-thu-chi/dev/05-fe-dev-w1-fix-hscroll-whitespace.md`

The dev summary claims:
> "No other changes" (Known Limitations)
> "diff scoped to exactly these 12 lines" (Designer Spec Coverage)

The actual diff includes 5 companion changes to the wrapping `<div>` elements:

| File | Line | Change |
|---|---|---|
| `InventoryReport.tsx` | 109 | `overflow-x-auto` → `overflow-x-auto overflow-y-hidden` |
| `InventoryReport.tsx` | 150 | `overflow-x-auto` → `overflow-x-auto overflow-y-hidden` |
| `InventoryReport.tsx` | 212 | `overflow-x-auto` → `overflow-x-auto overflow-y-hidden` |
| `TransactionDetailModal.tsx` | 419 | `overflow-x-auto` → `overflow-x-auto overflow-y-hidden` |
| `OrderRowCard.tsx` | 161 | `overflow-x-auto` → `overflow-x-auto overflow-y-hidden` |

**Why it matters:** These companion changes are directly related to the hscroll fix — they prevent vertical scroll flicker during horizontal scrolling. The dev summary should document them for completeness, not claim "no other changes."

**Required action:** Update the dev summary's "Known Limitations" and "Files Changed" table to include the 5 companion `overflow-y-hidden` additions.

**Owner:** engineering-frontend-developer

**Expected evidence:** Dev summary updated to reflect actual change scope (12 table className + 5 div className changes).

**Closure criteria:** Dev summary "Files Changed" table lists both table and div changes; "Known Limitations" accurately reflects total change count.

## Should-Fix Items

| # | Item | Severity | File | Line | Action |
|---|---|---|---|---|---|
| SF-01 | Implementation summary understates change scope (claims "no other changes" but 5 companion overflow changes exist) | Low | `docs/modules/M-001/dev/05-fe-dev-w1-fix-hscroll-whitespace.md` | — | Update dev summary to reflect companion `overflow-x-auto overflow-y-hidden` changes |

## Questions/Clarifications

None. Intent is clear: mechanical CSS substitution with zero ambiguity.

## Follow-up Recommendations

None. The fix is release-ready.

## Final Review Summary

| Dimension | Finding | Severity |
|---|---|---|
| Table `w-full` → `min-w-full` (12/12) | All correct | — |
| Zero residual `w-full` on tables | Confirmed | — |
| Companion `overflow-y-hidden` (5/5) | Desirable, undocumented | Observation |
| Typecheck | Clean (exit 0) | — |
| Pre-approve gate (`ai-kit-verify --as-gate`) | `would_pass: true`, zero blockers | — |
| Dev summary accuracy | Scope understated | Should-fix (Low) |
| QA report accuracy | Accurate and thorough | — |

**The 12 core changes are correct, the companion overflow improvements are desirable, and the gate is clean.** One should-fix documentation item — update the dev summary to accurately reflect the 5 companion changes. No code defects. Safe to release.
