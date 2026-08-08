# Inventory FIFO report design (2026-08-09)

## Goal

Separate report for stock-in cash vs sold goods gross margin using FIFO unit costs from each purchase lot. Complements cash P&L (thu − mọi chi) so nhập hàng is visible on its own.

## Decisions

| Topic | Choice |
|--------|--------|
| Placement | New report tab **Hàng hóa** |
| Content | (1) Cash nhập in range (2) Gross margin FIFO on paid sales (3) Remaining FIFO lots to `to` |
| Costing | FIFO from expense stock-in lots (no `stock_lots` table) |
| Sale recognition | `paymentStatus = paid`, not cancelled; event date = `paidAt` (fallback `date`) |
| Missing lots | Fallback `Product.defaultUnitPrice`, flag `estimated` |
| Lines without `productId` | Excluded from COGS / goods revenue in this report |
| Profit tab | Split expense into **Nhập hàng** vs **Chi khác**; cash P&L formula unchanged |

## Data sources

- **Lots:** expenses with `stockProductId`, `stockQtyIn > 0`, `stockApplied`, `status !== cancelled`. `unitCost = max(1, round(amount / stockQtyIn))`.
- **Outflows:** paid order line items with `productId`.
- Simulation ordered by `(date, createdAt, id)` for both in and out.

## Algorithms

1. Build a single timeline of stock-in + paid-out events with `date <= report.to`, sorted by `(date, createdAt, id)`; on equal timestamps, **in before out**.
2. Walk the timeline: push lot on in; on out consume FIFO from that product’s queue (never use a lot that appears later on the timeline). Accumulate COGS / qty / goods revenue only when out event date is in `[from, to]`.
3. Remaining queue qty × unitCost = inventory value estimate at `to`.
4. Stock-in cash block: expenses in range by `expense.date` only (not FIFO).

## UI

- Cards: tổng nhập, tổng SL nhập, DT hàng bán, COGS, lãi gộp, biên %, giá trị tồn FIFO.
- Tables: nhập theo SP; lãi theo SP (badge ước tính nếu có); tồn còn lại theo SP.
- Note: dòng đơn không gắn SP không vào lãi gộp FIFO.

## Out of scope

- Persisted lot / movement ledger
- AI chat for FIFO margin
- COGS for lines without `productId`
