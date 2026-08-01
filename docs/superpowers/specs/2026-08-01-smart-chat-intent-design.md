# Smart Chat Intent — Design Spec

**Date:** 2026-08-01  
**Status:** Implementing (user approved “xử lý luôn hết”)  
**Extends:** `2026-08-01-ai-multimodal-intake-design.md`

## Goal

Chat hiểu ngữ cảnh tiếng Việt → JSON intent → gọi tool hệ thống (tạo/sửa/xóa/tra cứu/đổi trạng thái). Regex vẫn là fast-path; LLM xử lý câu mơ hồ + hội thoại bổ sung slot.

## Flow

```text
User message
  → (1) Pending slot-fill / delete-confirm?
  → (2) Regex intake create (instant) — chỉ khi confidence cao
       Soft/catch-all expense hoặc câu có kênh/{khách} mua giữa câu → bỏ qua, sang (3)
  → (3) LLM JSON intent extract (+ finance context; Gemini → WebLLM)
       Gồm platformName; "{khách} mua/lấy/đặt" = create_revenue
  → missing slots? → hỏi lại, giữ pending
  → delete? → hỏi "xác nhận"
  → (4) chatTools.execute → services/stores
  → else free chat/analysis (Gemini → WebLLM)
```

## Intents

`create_expense` | `create_revenue` | `update_expense` | `update_revenue` | `delete_expense` | `delete_revenue` | `update_order_status` | `lookup` | `chat`

## Safety

- Create: persist ngay khi đủ slot (như cũ).
- Update/delete: cần `targetHint` tìm được đúng 1 bản ghi; delete cần user gõ xác nhận.
- Confidence thấp / thiếu slot: không ghi DB, hỏi lại.

## Files

- `chatIntent.ts` — types, validate, draft convert
- `llmIntentExtractor.ts` — Gemini/WebLLM JSON extract + merge
- `chatTools.ts` — execute against expense/revenue/customer services
- `aiRouter.ts` — orchestrate pending + tools
- `intakeService.ts` — richer `buildFinanceContext`
