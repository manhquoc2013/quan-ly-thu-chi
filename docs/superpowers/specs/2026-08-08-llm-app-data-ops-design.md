# LLM App Data Ops — Design

**Date:** 2026-08-08  
**Status:** Approved — implementing

## Goal

Chat assistant can process app data across all entities (ledger + master data), covering varied paste inputs, with LLM when local parse is ambiguous.

## Decisions

- Architecture: extend existing `ChatIntent` → `executeChatIntent` → services (not full tool-calling agent).
- Safety hybrid: clear → persist immediately; ambiguous / multi-match → clarify; deletes → type `xác nhận`.
- Clear-gate (policy A): local bulk persist only when strong header + ≥2 clean money lines; otherwise LLM bulk classify (`expense`|`revenue`|`product`) before persist.
- Scope: products, customers, platforms, expenses, revenues/orders in one delivery.

## Clear vs ambiguous

**Clear:** explicit kind header (`thêm chi phí/doanh thu/sản phẩm`, `STT…Đơn giá`) + ≥2 clean lines; or single utterance with `missing=[]` and unique entity match.

**Ambiguous:** no header with default kind; compound mixed kinds; dirty descriptions; multi-match update/delete; low confidence.

## Flow

1. Pending clarify / entity pick / delete confirm
2. Bulk paste → `isClearBulkPaste` ? local persist : LLM bulk extract
3. Multi-tx split → intent tools per segment
4. Single → LLM intent (extended kinds) → tools; local fallback for clear creates only

## New intents

`create_product|update_product|delete_product`  
`create_customer|update_customer|delete_customer`  
`create_platform|update_platform|delete_platform`  

Lookup extended for products/customers/platforms.

## Files

- `textDraftParser.ts` — `isClearBulkPaste`
- `llmBulkDraftExtractor.ts` — `product` kind
- `chatIntent.ts`, `chatTools.ts`, `llmIntentExtractor.ts`, `aiRouter.ts`
- tests in `amountParser.test.ts` / intent tests

## Out of scope

- Full multi-step tool-calling agent rewrite
- New chat UI redesign
- Phone/address fields beyond what services already accept
