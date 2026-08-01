# Order payment status (Đã / Chưa thanh toán)

**Date:** 2026-08-01  
**Status:** Implemented  
**Approach:** A — `paymentStatus` + `paidAt`

## Goal

Distinguish paid vs unpaid orders so that:

- Monthly / overview **revenue** only includes **paid** orders, grouped by **payment date** (`paidAt`).
- **Unpaid** orders appear as receivables (công nợ) on dashboard, in a dedicated report tab, and via filters on the revenue list.
- Users can mark payment from the detail dialog; edit dialog can adjust payment fields.

## Decisions (confirmed)

| Topic | Choice |
|-------|--------|
| Default on create | `unpaid`; UI allows selecting paid/unpaid |
| Revenue month key | `paidAt` (yyyy-MM-dd), not order `date` |
| Surfaces | Dashboard + Report tab + Revenue list column/filter (option 3) |
| Mark paid UX | Detail dialog button → set `paid` + `paidAt = today`; hide button once `paidAt` is set |
| Edit paid date | Allowed in order edit dialog |

## Data model

Extend `Revenue` (`src/models/revenue.ts`):

```ts
export type PaymentStatus = 'unpaid' | 'paid';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
};

// on Revenue:
paymentStatus: PaymentStatus;
paidAt?: string; // ISO date-only; required when paymentStatus === 'paid'
```

### Invariants

- If `paymentStatus === 'paid'` → `paidAt` must be a valid `yyyy-MM-dd`.
- If `paymentStatus === 'unpaid'` → `paidAt` is cleared (`undefined`).
- Cancelled orders (`orderStatus === 'cancelled'`) stay out of revenue and out of “active công nợ” totals (still visible in list/filters if needed).

### Migration (existing IndexedDB records)

On load / bootstrap (or first `getAllRevenues`):

- Missing `paymentStatus` → treat as **`paid`** with `paidAt = date` (preserve historical “all counted as revenue” behavior).
- Persist normalized records once so subsequent loads are clean.

## Revenue calculation rules

Shared helpers (e.g. `src/utils/revenueMetrics.ts` or inside `reportService`):

- `isPaidRevenue(r)` → `paymentStatus === 'paid' && !!paidAt && orderStatus !== 'cancelled'`
- `isUnpaidReceivable(r)` → `paymentStatus === 'unpaid' && orderStatus !== 'cancelled'`
- Monthly revenue / charts / profit **thu** side: sum `finalAmount` where `isPaidRevenue`, bucket by `paidAt.slice(0, 7)`
- List summary “Tổng doanh thu” on Revenue screen: sum paid only (respect active date filters using `paidAt` when filtering by payment period — see UI note below)

## UI

### Order create / edit (`OrderDialog`)

- Field: payment status dropdown (default `unpaid`).
- When status = `paid`: show `DatePicker` for `paidAt` (default today).
- When status = `unpaid`: hide/clear `paidAt`.

### Revenue grid / screen

- Column: payment badge (Đã / Chưa thanh toán).
- Filter: Tất cả / Đã thanh toán / Chưa thanh toán.
- Optional: date filters remain on order `date` for “ngày tạo đơn”; document in UI that doanh thu metrics use `paidAt`. (If product later wants date filter on payment date, that is a follow-up.)

### Detail dialog (`OrderRowCard` / dashboard `TransactionDetailModal` for revenue)

- Show readonly payment status + `paidAt` if any.
- Button **“Đánh dấu đã thanh toán”** visible only when `!paidAt` (and not cancelled).
- On click: `updateRevenue(id, { paymentStatus: 'paid', paidAt: todayISO })`.
- After `paidAt` exists → hide button (edit via Sửa if need to change date/status).

### Dashboard

- KPI **Tổng thu**: paid only, by `paidAt` (all-time or current scope consistent with existing dashboard — prefer same window as chart: paid in last 7 days by `paidAt` for chart bars; card “Tổng thu” = all-time paid or month-to-date — **use all-time paid sum for card to match current “Tổng thu” semantics**, chart bars filter by `paidAt` day).
- New card or section: **Công nợ** — count + sum of `isUnpaidReceivable`; list snippet of unpaid orders optional.
- Pending orders section unchanged (still by `orderStatus`); may show payment badge for clarity.

### Reports (`ReportScreen`)

- New tab **Công nợ** (`UnpaidReport`): list/sum unpaid receivables.
- **Doanh thu** / **Lợi nhuận**: only paid amounts keyed by `paidAt` month.

### Chat / intake

- New orders from AI/intake default `unpaid` (no `paidAt`) unless user language clearly says đã thu/đã thanh toán (optional enhancement; MVP = always unpaid).
- Finance context / lookup totals should use paid rules for “doanh thu”.

## Services / store

- `createRevenue` / `updateRevenue`: validate payment invariants; accept `paymentStatus` + `paidAt` in payload.
- Toast copy can mention payment when relevant (optional).
- No schema version bump required beyond normalize-on-read.

## Out of scope

- Partial payments / installments.
- Separate payment method history.
- Changing date filter semantics from order date → paidAt on the revenue toolbar (follow-up).
- Automatic mark-paid when `orderStatus === 'completed'`.

## Acceptance

1. New order defaults to unpaid; create form can select paid + date.
2. Unpaid amounts do not appear in monthly revenue / profit thu / dashboard Tổng thu.
3. Marking paid in detail sets `paidAt` to today and hides the button.
4. Edit dialog can change status and `paidAt`.
5. Công nợ report + dashboard show unpaid totals.
6. Old records without fields still count as paid using order `date` as `paidAt`.
