# Deposit + payment cash-flow revenue

**Date:** 2026-08-02  
**Status:** Implemented  
**Approach:** Keep `unpaid` | `paid` + deposit/payment amount fields

## Goal

- Record deposit (`depositAmount` + `depositedAt`) and final payment (`paidAmount` + `paidAt`).
- Revenue by cash events: deposit day counts deposit; payment day counts payment amount.
- Receivable when unpaid: `finalAmount − depositAmount`.
- UI shows đã cọc / đã thanh toán / còn lại; `paidAmount` defaults to remaining, editable.

## Data model (`Revenue`)

```ts
depositAmount?: number;
depositedAt?: string;   // yyyy-MM-dd
paidAmount?: number;    // cash on paidAt
paidAt?: string;
paymentStatus: 'unpaid' | 'paid';
```

### Invariants

- Deposit pair: both set with `depositAmount > 0` and `depositAmount ≤ finalAmount`, or both cleared.
- `unpaid` → clear `paidAt` / `paidAmount`.
- `paid` → require `paidAt`; default `paidAmount = max(0, finalAmount − deposit)`.
- Legacy `paid` without `paidAmount` → treat as `paidAmount = finalAmount`.

## Metrics

Cash events per non-cancelled order:

1. If deposit → `{ date: depositedAt, amount: depositAmount, kind: 'deposit' }`
2. If paid → `{ date: paidAt, amount: resolvedPaidAmount, kind: 'payment' }`

`sumPaidRevenue` / range filters sum event amounts by date.  
`sumUnpaidReceivable` sums remaining for unpaid non-cancelled orders.

## UI

OrderDialog: deposit amount + date; payment status + paidAt + paidAmount when paid; summary line.  
List/detail: badge unpaid/paid + “Đã cọc …₫” when deposited.  
Quick mark-paid: `paid` + today + remaining as `paidAmount`.

## Out of scope

Multiple deposits, third payment status, TSV/AI “đã cọc” parse.
