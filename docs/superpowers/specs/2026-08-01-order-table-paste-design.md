# Order table TSV paste (AI chat)

## Problem

Users paste spreadsheet rows (Google Sheets / Excel) into AI chat:

`Tên khách | Nền tảng | Nội dung | Số tiền | Trạng thái đơn | NOTE`

Quoted cells may contain newlines. Previous parsers treated the paste as expense line-lists or a single junk expense.

## Behavior

1. Detect tab-separated order tables (header optional; ≥1 data row with amount).
2. Each row with amount → create **revenue** draft with `orderItems`, platform, statuses.
3. Row missing amount → skip + `⚠️ Bỏ qua: {khách}: thiếu số tiền`.
4. Status `Đã xong` → `orderStatus: completed`.
5. NOTE `đã trả tiền` → `paymentStatus: paid`.
6. Content lines: `qty name`, `qty name=15` (bare digits → ×1000 VND), `Ship=11`.
7. Persist via `persistConfirmed` / `persistRevenueDraft` so multi-items and statuses are kept (not `draftToCreateIntent`).

## Priority

`parseTextToDrafts`: order table → expense line-list → clause split.

## Files

- `src/services/orderTableParser.ts` (+ tests)
- `src/services/draftTypes.ts` — `orderItems`, `orderStatus`, `paymentStatus`, `notes`
- `src/services/intakeService.ts` — multi-item revenue persist
- `src/services/aiRouter.ts` — skipped rows + table persist path
- `src/services/textDraftParser.ts` — priority hook
