# Order shipping fee — implementation plan

## Files

- `src/models/revenue.ts` — fields + labels
- `src/utils/orderTotals.ts` — goods / final with shipping (testable)
- `src/services/revenueService.ts` — compute + sync expense
- `src/services/orderTableParser.ts` — extract Ship lines
- `src/services/draftTypes.ts` + `intakeService.ts` — persist shipping
- `src/ui/screens/revenue/OrderDialog.tsx` — UI
- Grid / detail labels; tests; `.ai-context.md`

## Tasks

1. Model + `computeOrderTotals` + tests
2. revenueService sync expense on create/update/delete
3. OrderDialog + list/detail display
4. orderTableParser + intake
5. Context sync
