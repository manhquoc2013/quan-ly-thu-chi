/**
 * Paid / unpaid / deposit cash-flow helpers — dashboard, reports, list summary.
 */

import type { Revenue } from '@/models';
import { formatCurrency } from '@/utils/currency';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type CashEventKind = 'deposit' | 'payment';

export interface CashEvent {
  orderId: string;
  date: string;
  amount: number;
  kind: CashEventKind;
}

export function getDepositAmount(r: Revenue): number {
  const n = r.depositAmount;
  return typeof n === 'number' && n > 0 ? n : 0;
}

export function hasDeposit(r: Revenue): boolean {
  return getDepositAmount(r) > 0 && typeof r.depositedAt === 'string' && DATE_RE.test(r.depositedAt);
}

/** Resolved payment cash amount for a paid order (legacy → finalAmount). */
export function getPaidAmount(r: Revenue): number {
  if (r.paymentStatus !== 'paid') return 0;
  if (typeof r.paidAmount === 'number' && r.paidAmount >= 0) return r.paidAmount;
  // Legacy paid without paidAmount: full order was revenue
  if (!hasDeposit(r)) return r.finalAmount;
  return Math.max(0, r.finalAmount - getDepositAmount(r));
}

/** Remaining receivable while unpaid; 0 when paid/cancelled. */
export function getRemainingBalance(r: Revenue): number {
  if (r.orderStatus === 'cancelled') return 0;
  if (r.paymentStatus === 'paid') return 0;
  return Math.max(0, r.finalAmount - getDepositAmount(r));
}

export function defaultPaidAmount(finalAmount: number, depositAmount: number): number {
  return Math.max(0, finalAmount - Math.max(0, depositAmount));
}

/** Short UI line: Đã cọc … · Đã TT … · Còn … */
export function paymentSummaryLabel(r: Revenue): string {
  const parts: string[] = [];
  const dep = getDepositAmount(r);
  if (dep > 0) parts.push(`Đã cọc ${formatCurrency(dep)}`);
  if (r.paymentStatus === 'paid') {
    parts.push(`Đã TT ${formatCurrency(getPaidAmount(r))}`);
  } else {
    const rem = getRemainingBalance(r);
    if (dep > 0 || rem > 0) parts.push(`Còn ${formatCurrency(rem)}`);
  }
  return parts.join(' · ');
}

export function isPaidRevenue(r: Revenue): boolean {
  return (
    r.paymentStatus === 'paid' &&
    typeof r.paidAt === 'string' &&
    DATE_RE.test(r.paidAt) &&
    r.orderStatus !== 'cancelled'
  );
}

export function isUnpaidReceivable(r: Revenue): boolean {
  return r.paymentStatus === 'unpaid' && r.orderStatus !== 'cancelled';
}

/** Cash events that count toward doanh thu (non-cancelled). */
export function cashEventsForOrder(r: Revenue): CashEvent[] {
  if (r.orderStatus === 'cancelled') return [];
  const events: CashEvent[] = [];
  if (hasDeposit(r)) {
    events.push({
      orderId: r.id,
      date: r.depositedAt!,
      amount: getDepositAmount(r),
      kind: 'deposit',
    });
  }
  if (isPaidRevenue(r)) {
    const amt = getPaidAmount(r);
    if (amt > 0) {
      events.push({
        orderId: r.id,
        date: r.paidAt!,
        amount: amt,
        kind: 'payment',
      });
    }
  }
  return events;
}

export function allCashEvents(revenues: Revenue[]): CashEvent[] {
  return revenues.flatMap(cashEventsForOrder);
}

export function sumCashEventsInRange(
  revenues: Revenue[],
  from?: string,
  to?: string,
): number {
  return allCashEvents(revenues)
    .filter((e) => {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    })
    .reduce((s, e) => s + e.amount, 0);
}

/** Total cash recognized (all time). */
export function sumPaidRevenue(revenues: Revenue[]): number {
  return allCashEvents(revenues).reduce((s, e) => s + e.amount, 0);
}

export function sumUnpaidReceivable(revenues: Revenue[]): number {
  return revenues.filter(isUnpaidReceivable).reduce((s, r) => s + getRemainingBalance(r), 0);
}

export function paidRevenueByMonth(
  revenues: Revenue[],
): Array<{ month: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();
  const orderMonths = new Set<string>();
  for (const e of allCashEvents(revenues)) {
    const month = e.date.slice(0, 7);
    const entry = map.get(month) ?? { total: 0, count: 0 };
    entry.total += e.amount;
    map.set(month, entry);
    orderMonths.add(`${month}:${e.orderId}`);
  }
  for (const key of orderMonths) {
    const month = key.slice(0, 7);
    const entry = map.get(month);
    if (entry) entry.count += 1;
  }
  return Array.from(map.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Cash recognized on a single calendar day. */
export function cashRevenueOnDate(revenues: Revenue[], dateStr: string): number {
  return allCashEvents(revenues)
    .filter((e) => e.date === dateStr)
    .reduce((s, e) => s + e.amount, 0);
}

/**
 * Normalize deposit/payment fields on load.
 * Legacy paid without paidAmount → paidAmount = finalAmount.
 */
export function normalizePaymentFields(revenues: Revenue[]): { records: Revenue[]; changed: boolean } {
  let changed = false;
  const records = revenues.map((r) => {
    let next: Revenue = { ...r };
    let localChanged = false;

    const raw = r as Revenue & { paymentStatus?: string };

    if (raw.paymentStatus !== 'paid' && raw.paymentStatus !== 'unpaid') {
      localChanged = true;
      next = { ...next, paymentStatus: 'paid', paidAt: r.date, paidAmount: r.finalAmount };
    } else if (next.paymentStatus === 'paid') {
      if (!next.paidAt || !DATE_RE.test(next.paidAt)) {
        localChanged = true;
        next = { ...next, paidAt: r.date };
      }
      if (typeof next.paidAmount !== 'number' || next.paidAmount < 0) {
        localChanged = true;
        const dep = getDepositAmount(next);
        next = {
          ...next,
          paidAmount: dep > 0 ? defaultPaidAmount(next.finalAmount, dep) : next.finalAmount,
        };
      }
    } else {
      // unpaid
      if (next.paidAt != null || next.paidAmount != null) {
        localChanged = true;
        next = { ...next, paidAt: undefined, paidAmount: undefined };
      }
    }

    // Deposit pair
    const depAmt = typeof next.depositAmount === 'number' ? next.depositAmount : 0;
    const depDateOk = typeof next.depositedAt === 'string' && DATE_RE.test(next.depositedAt);
    if (depAmt > 0 && depDateOk) {
      const capped = Math.min(depAmt, next.finalAmount);
      if (capped !== next.depositAmount) {
        localChanged = true;
        next = { ...next, depositAmount: capped };
      }
    } else if (depAmt > 0 || next.depositedAt) {
      // Incomplete pair → clear
      localChanged = true;
      next = { ...next, depositAmount: undefined, depositedAt: undefined };
    }

    if (localChanged) changed = true;
    return next;
  });
  return { records, changed };
}

export function assertPaymentInvariant(
  paymentStatus: Revenue['paymentStatus'],
  paidAt: string | undefined,
): void {
  if (paymentStatus === 'paid') {
    if (!paidAt || !DATE_RE.test(paidAt)) {
      throw new Error('paidAt must be yyyy-MM-dd when paymentStatus is paid');
    }
  }
}

/** Normalize deposit + payment fields for create/update write path. */
export function normalizeDepositPaymentOnWrite(
  input: {
    finalAmount: number;
    paymentStatus: Revenue['paymentStatus'];
    paidAt?: string;
    paidAmount?: number;
    depositAmount?: number;
    depositedAt?: string;
    fallbackDate: string;
  },
): Pick<Revenue, 'paymentStatus' | 'paidAt' | 'paidAmount' | 'depositAmount' | 'depositedAt'> {
  const { finalAmount, fallbackDate } = input;
  let depositAmount: number | undefined;
  let depositedAt: string | undefined;

  const rawDep =
    typeof input.depositAmount === 'number' && input.depositAmount > 0
      ? Math.min(input.depositAmount, finalAmount)
      : 0;
  const depDate =
    input.depositedAt && DATE_RE.test(input.depositedAt) ? input.depositedAt : undefined;

  if (rawDep > 0 && depDate) {
    depositAmount = rawDep;
    depositedAt = depDate;
  } else if (rawDep > 0) {
    depositAmount = rawDep;
    depositedAt = fallbackDate;
  }

  const status = input.paymentStatus ?? 'unpaid';
  if (status === 'paid') {
    const paidAt =
      input.paidAt && DATE_RE.test(input.paidAt) ? input.paidAt : fallbackDate;
    assertPaymentInvariant('paid', paidAt);
    const remaining = defaultPaidAmount(finalAmount, depositAmount ?? 0);
    const paidAmount =
      typeof input.paidAmount === 'number' && input.paidAmount >= 0
        ? input.paidAmount
        : remaining;
    return {
      paymentStatus: 'paid',
      paidAt,
      paidAmount,
      depositAmount,
      depositedAt,
    };
  }

  return {
    paymentStatus: 'unpaid',
    paidAt: undefined,
    paidAmount: undefined,
    depositAmount,
    depositedAt,
  };
}
