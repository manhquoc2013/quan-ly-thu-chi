---
feature-id: M-001-quan-ly-thu-chi
stage: authoring
wave: 1
agent: engineering-qa-engineer
verdict: Pass
critical-ac-total: 10
critical-ac-verified: 0
last-updated: 2026-08-09
---

# QA Report — Wave 1 (Authoring) — Display Content Standardization

> Source: TRI-1786256042159-849c · Module: M-001-quan-ly-thu-chi · Change class: C3

## Feature/Change Overview

Display Content Standardization is a batch of cosmetic display-string and CSS animation changes across 12 frontend files (`src/ui/screens/**` + `src/ui/Layout.tsx`). Zero business logic, zero data model, zero architecture changes. Nine change groups (CG-1 through CG-9) covering nav labels, background animations, dashboard metrics, empty states, button labels, confirm dialogs, currency suffixes, input placeholders, and date formatting.

## Test Scope

**Included:**
- Acceptance test suite authored: `test/acceptance/quan-ly-thu-chi/display-standardization.acceptance.test.ts` (182 lines, 37 cases)
- Collection map: `test/acceptance/quan-ly-thu-chi/acceptance-map.json` (37 entries, 10 critical)
- All 9 change groups mapped to acceptance criteria
- Common test cases (RBAC, XSS) included in suite

**Excluded:**
- Independent black-box/UAT testing (Test Studio responsibility)
- Live-fire HTTP acceptance (no HTTP endpoints in scope — all gray-box file inspection)
- Performance/NFR load testing (cosmetic changes only)

## Requirement Coverage Matrix

| Change Group | AC Count | Critical | Layer | Status |
|---|---|---|---|---|
| CG-1: Nav label consistency | 1 | 0 | gray-box | authored |
| CG-2: AuthScreen animation fix | 3 | 0 | gray-box | authored |
| CG-3: Dashboard metrics labels & rounding | 3 | 2 | gray-box | authored |
| CG-4: Empty states unify | 8 | 0 | gray-box | authored |
| CG-5: Button labels | 3 | 0 | gray-box | authored |
| CG-6: Confirm dialogs | 4 | 4 | gray-box | authored |
| CG-7: Currency ₫ suffix | 3 | 0 | gray-box | authored |
| CG-8: Vietnamese placeholders | 2 | 0 | gray-box | authored |
| CG-9: Date formatting | 2 | 2 | gray-box | authored |
| Common: RBAC + UX | 2 | 1 | gray-box | authored |
| Utility functions | 5 | 1 | gray-box | authored |
| **Total** | **37** | **10** | | |

### Critical AC list

| AC-ID | Description | Change Group |
|---|---|---|
| DS-007 | `money()` uses `formatCurrency(amount)` without `Math.round()` | CG-3 |
| DS-008 | KPI card title "Doanh thu" | CG-3 |
| DS-009 | KPI card title "Chi phí" | CG-3 |
| DS-021 | RevenueGrid single confirm "Xóa đơn hàng?" | CG-6 |
| DS-022 | RevenueGrid bulk confirm "Xóa nhiều đơn hàng?" | CG-6 |
| DS-023 | ExpenseGrid single confirm "Xóa chi phí?" | CG-6 |
| DS-024 | ExpenseGrid bulk confirm "Xóa nhiều chi phí?" | CG-6 |
| DS-028 | RevenueGrid imports `formatDate` from `@/utils/date` | CG-9 |
| DS-029 | RevenueGrid uses `formatDate(row.date)` | CG-9 |
| DS-030 | Layout nav items do not expose admin-only routes | Common (RBAC) |

## Test Strategy

**Layer: Gray-box (file-text inspection).** All test cases read source files via `fs.readFileSync()` and assert expected display strings, CSS patterns, and import statements. No HTTP endpoints exist in scope — this is a cosmetic standardization pass.

**Oracles:** Each case asserts a specific string literal, regex pattern, or import statement against the source file content. Strong oracles (value equality, regex match) are used for all AC-linked cases.

**Wave-1 authoring status:** All cases are authored as `it.todo(...)` (skipped) because the implementation has not landed yet. This is expected ATDD posture — the suite is the oracle, not a pass/fail verdict. Cases compile cleanly under `bun run build` and `npx tsc --noEmit`.

## Test Cases

- **Total cases:** 37 (182 lines in test file)
- **Critical:** 10
- **High:** 18
- **Medium:** 9
- **Change-group distribution:** 10 describe blocks, one per CG
- **Common test coverage:** RBAC (DS-030) and XSS (DS-031) from `qa-common-tests.md`

### Test files produced

| File | Lines | Purpose |
|---|---|---|
| `test/acceptance/quan-ly-thu-chi/display-standardization.acceptance.test.ts` | 182 | Executable gray-box specs |
| `test/acceptance/quan-ly-thu-chi/acceptance-map.json` | 37 cases | Collection map for gate + UAT seed |

### Atomic Evidence Triple

- **test-evidence:** `docs/intel/test-evidence/display-standardization.json` (schema I-001.16)
- **spec file:** `test/acceptance/quan-ly-thu-chi/display-standardization.acceptance.test.ts`
- **map file:** `test/acceptance/quan-ly-thu-chi/acceptance-map.json`

## Execution Results

**Wave-1 is authoring stage.** All 37 cases are authored as `it.todo(...)` — skipped. Zero cases executed. This is the correct ATDD posture: the oracle exists, the implementation does not yet satisfy it. The acceptance-suite gate (`acceptance_coverage`) validates map completeness, not pass/fail.

| Metric | Count |
|---|---|
| Authored cases | 37 |
| Executed cases | 0 |
| Passed | N/A |
| Failed | N/A |
| Skipped (it.todo) | 37 |

## Defects Found

None — Wave 1 is authoring. No implementation exists to defect-check against.

## NFR Observations

- **Type safety:** Suite compiles under TypeScript; imports `formatDate` and `formatCurrency` from project utilities for utility-function verification.
- **Maintenance:** File-based assertions depend on line numbers and literal strings in source files; future refactorings of screen components may require test updates if string literals are moved.

## Regression Impact Assessment

All changes are cosmetic display-string replacements — zero business logic, zero data model, zero API changes. Regression risk is **Low**. Only the 12 UI files listed in the design plan are affected:

`Layout.tsx`, `AuthScreen.tsx`, `DashboardScreen.tsx`, `RevenueGrid.tsx`, `CustomerScreen.tsx`, `ProductScreen.tsx`, `PlatformScreen.tsx`, `ExpenseScreen.tsx`, `RevenueScreen.tsx`, `ExpenseGrid.tsx`, `ExpenseDialog.tsx`, `OrderDialog.tsx`, `ProductDialog.tsx`.

## Test Limitations / Gaps

- All cases are file-text assertions (gray-box). Visual layout rendering (e.g. ₫ suffix overlapping long numbers, sidebar truncation of "Khách hàng") cannot be verified without a rendered browser context. These are noted as low-likelihood, low-impact risks in the design plan.
- `it.todo` cases cannot be executed until the developer wave lands. The suite is a **prepared oracle**, not executed evidence.
- Common-test XSS and RBAC cases (DS-030, DS-031) are todo — they will need manual verification in Wave 2 once implementation exists.

## Release Recommendation

**Approve Wave 1 for developer handoff.** The acceptance oracle is complete and ready for validation once the engineering lead executes the change groups. No blocking issues. The acceptance-suite gate (`acceptance_coverage`) will pass because every AC-ID in the design plan maps to a case in the collection map.

## QA Verdict

**Pass** — Wave 1 authoring is complete. All 37 acceptance cases are authored against the 9 change groups. The collection map is consistent with the test file (verified at write time: 37 map entries, 37 `it(...)`/`it.todo(...)` blocks, 10 critical). The suite is ready for Wave 2 validation.

<verdict_envelope>
<verdict>Pass</verdict>
<confidence>high</confidence>
<structured_summary>
<key_findings>
<item>Authored 37 acceptance cases (10 critical, 18 high, 9 medium) covering 9 change groups across 12 UI files</item>
<item>Collection map consistent: 37 entries, 10 critical, all AC-IDs from design plan present</item>
<item>All cases are it.todo(...) — expected for Wave 1 authoring; ready for Wave 2 execution</item>
<item>Atomic Evidence Triple: test-evidence JSON + executable spec + collection map written</item>
</key_findings>
<artifacts_produced>
<item>docs/modules/M-001-quan-ly-thu-chi/qa/07-qa-report-w1.md</item>
<item>test/acceptance/quan-ly-thu-chi/display-standardization.acceptance.test.ts</item>
<item>test/acceptance/quan-ly-thu-chi/acceptance-map.json</item>
</artifacts_produced>
</structured_summary>
<blockers>
</blockers>
</verdict_envelope>
