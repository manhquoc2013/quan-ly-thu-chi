# Bulk Line Expense Paste — Design Spec

**Date:** 2026-08-01  
**Status:** Approved (hybrid #3) — implementing  
**Extends:** Smart Chat Intent / text intake

## Goal

Paste danh sách chi phí nhiều dòng (Excel/Shopee: `tên hàng + 798.000 ₫`) → mỗi dòng một expense, lưu ngay. Category = `guessCategory` từng dòng. Date = hôm nay.

## Flow

```text
User message (multi-line)
  → (A) Regex line-list (≥2 dòng parse được) → persistConfirmed
  → (B) else if ≥2 dòng có vẻ có tiền → LLM bulk JSON → persist
  → else → pipeline chat/intent cũ
```

Không tạo một khoản “rác” từ cả khối khi regex fail trên bulk list.

## Parse rules

- Split `\n`; bỏ trống + header `thêm chi phí:` / `thêm khoản chi:` / `chi phí:`.
- Tiền ở cuối dòng: `798.000`, `798.000 ₫`, `798k`, `1.5tr` (+ `đ|vnd|đồng`).
- `description` = phần còn lại (giữ `300 móc khóa`).
- Dòng lỗi: bỏ qua; báo `⚠️`; không rollback.

## LLM fallback schema

```json
{ "kind": "expense"|"revenue", "items": [{ "description": string, "amount": number }] }
```

`amount` = VND integer. Gemini → WebLLM. Fail → không ghi DB.

## Files

- `amountParser.ts` — `₫|đ|vnd|đồng`
- `textDraftParser.ts` — `parseLineListDrafts`, ưu tiên trong `parseTextToDrafts`
- `llmBulkDraftExtractor.ts` — bulk extract
- `aiRouter.ts` — gọi LLM khi regex bulk fail
- tests trong `amountParser.test.ts` (+ bulk cases)

## Out of scope

Preview xác nhận; gộp một lần mua; bulk edit category.
