# Order shipping fee (khách vs shop)

**Date:** 2026-08-02  
**Status:** Implemented  
**Approach:** Fields on `Revenue` + synced expense when shop pays

## Decisions

| Topic | Choice |
|-------|--------|
| Customer pays | `shippingFee` added to `finalAmount` |
| Shop pays | `finalAmount` = goods only; auto create/update expense `transportation` linked to order |
| Who pays | Exclusive: `customer` \| `shop` (or none when fee = 0) |
| Default payer | **customer** |
| Default fee | **0** if not entered |
| TSV `Ship=…` | Extract to `shippingFee`, payer `customer` (not a product line) |

## Data model (`Revenue`)

```ts
shippingFee?: number;           // ≥ 0; treat missing as 0
shippingPayer?: 'customer' | 'shop'; // default 'customer' when fee > 0
shippingExpenseId?: string;     // FK → Expense when shop pays
```

### Totals

```
goods = sum(items.total) - discount
finalAmount =
  shippingFee > 0 && shippingPayer === 'customer'
    ? goods + shippingFee
    : goods
```

### Shop expense sync

When `shippingFee > 0 && shippingPayer === 'shop'`:

- Create or update expense: category `transportation`, amount = `shippingFee`,
  description `Ship đơn {orderCode}`, date = order date (or expense date on create),
  link via `shippingExpenseId`.
- On switch to customer / fee → 0 / delete order: delete or clear linked expense.

When customer pays or fee = 0: no shipping expense; clear `shippingExpenseId` if present.

## UI (`OrderDialog`)

- Input: phí ship (empty / 0 = 0₫).
- Dropdown: Người chịu — Khách (default) | Shop (only meaningful when fee > 0).
- Summary: show whether ship is in order total or booked as expense.

List/detail: show “Ship …₫ (khách)” or “Ship …₫ (shop → chi)” when fee > 0.

## Intake / paste

- `orderTableParser`: strip Ship lines from items → `shippingFee` + `shippingPayer: 'customer'`.
- Sheet total column already includes ship when customer pays — keep amount as sheet total;
  ensure items + extracted ship reconcile (prefer sheet total as `amount` / `finalAmount` source).

## Out of scope

- Split ship (customer + shop on same order).
- Carrier / tracking fields.
- Changing cash-flow deposit/payment rules (unchanged; based on `finalAmount`).
