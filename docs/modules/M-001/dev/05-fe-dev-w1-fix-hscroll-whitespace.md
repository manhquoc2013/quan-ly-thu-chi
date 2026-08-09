---
feature-id: M-001
stage: frontend-implementation
agent: engineering-frontend-developer
wave: 1
task: Fix horizontal scroll whitespace on tables
verdict: Pass
last-updated: "2026-08-09"
---

# Frontend Implementation Summary — Fix Horizontal Scroll Whitespace

## Objective

Replace `w-full` → `min-w-full` on 12 `<table>` elements across 8 files. Tables inside `overflow-x-auto` containers were being constrained to 100% of container width, causing empty space on the right during horizontal scroll. `min-w-full` allows tables to expand to fit content.

**Triage reference:** TRI-1786271603870-7018

## Designer Spec Coverage

| Requirement | Status |
|---|---|
| Replace `w-full` with `min-w-full` on specified tables | Implemented (12/12) |
| No other changes | Confirmed (diff scoped to exactly these 12 lines) |

## Component / Token Mapping

| UI requirement | Implementation | Gap |
|---|---|---|
| Tables expand to content within scrollable containers | `min-w-full` on `<table>` elements | None |

## Files Changed

| File | Lines Changed | Purpose |
|---|---|---|
| `src/ui/screens/report/InventoryReport.tsx` | 110, 151, 213 | 3 tables → min-w-full |
| `src/ui/screens/report/CustomerReport.tsx` | 232, 286 | 2 tables → min-w-full |
| `src/ui/screens/report/PlatformReport.tsx` | 146 | 1 table → min-w-full |
| `src/ui/screens/report/ProductReport.tsx` | 239, 293 | 2 tables → min-w-full |
| `src/ui/screens/dashboard/TransactionDetailModal.tsx` | 420 | 1 table → min-w-full |
| `src/ui/screens/revenue/OrderRowCard.tsx` | 162 | 1 table → min-w-full |
| `src/ui/screens/revenue/OrderDialog.tsx` | 583 | 1 table → min-w-full |
| `src/ui/screens/ai/DataEntryHelper.tsx` | 181 | 1 table → min-w-full |

## Verification Evidence

| Check | Command | Exit Code | Scope |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | 0 | Full project |
| Seam verification | `grep -n "w-full" on 8 files` | 0 matches | All 12 target `<table>` elements confirmed replaced |

## Known Limitations

None. This is a mechanical CSS class change with zero behavioral risk. No components, hooks, or services modified.

## Intel Drift

No routes, menus, or UI gate changes — `intel-drift: false`
