# Inventory / Stock-in design (2026-08-09)

## Goal

Track on-hand stock for products: stock-in via expense (nhập hàng), stock-out when an order is paid, restore on cancel/delete. AI can create stock-in and look up tồn kho.

## Decisions

| Topic | Choice |
|--------|--------|
| Architecture | Approach A: `stockQty` on Product; stock fields on Expense; `stockApplied` flags |
| Stock-out trigger | When `paymentStatus === 'paid'` and order not cancelled |
| Insufficient stock | Allow negative; warn |
| Multi-item nhập | One expense per product (not multi-line purchase) |
| Edit expense qty | Does not auto-adjust stock (delete + re-enter) |
| Cancel/delete expense nhập | Reverse the stock that was applied |
| Cancel/delete / unpaid paid order | Restore stock |

## Data model

- **Product.stockQty** (number, default 0)
- **Expense**: `stockProductId?`, `stockQtyIn?`, `stockApplied?` — set when creating nhập hàng
- **Revenue.stockApplied?** — true while stock is held for that paid order

## Flows

1. **Nhập hàng**: create expense (usually `supplies` + tag `nhap-hang`) with qty → resolve/create product → `stockQty += qty`, `stockApplied=true`.
2. **Huỷ/xoá expense nhập**: if `stockApplied` → `stockQty -= stockQtyIn`, clear flag.
3. **Đơn paid**: for each item with `productId`, `stockQty -= quantity`; set `stockApplied`. Warn if any product goes negative.
4. **Đơn unpaid / cancelled / deleted** (when previously applied): restore quantities.

## AI

- “nhập 10 con mèo 500k” → `create_expense` + quantity + supplies → persist applies stock.
- Lookup “tồn kho” / “còn bao nhiêu …” → list `stockQty`.

## Out of scope

- Stock movement ledger entity
- Multi-line purchase documents
- Auto-adjust stock when editing expense quantity
