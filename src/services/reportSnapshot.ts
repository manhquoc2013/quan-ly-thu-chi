/**
 * Report period snapshot — cash P&L + unpaid receivable for Overview.
 */

import type { Expense, Revenue } from '@/models';
import { isDateInRange } from '@/utils/date';
import {
  getRemainingBalance,
  isUnpaidReceivable,
  sumCashEventsInRange,
  sumUnpaidReceivable,
} from '@/utils/revenueMetrics';

export interface UnpaidTopItem {
  id: string;
  orderCode: string;
  date: string;
  customerId: string;
  remaining: number;
  finalAmount: number;
}

export interface ReportSnapshot {
  cashIn: number;
  expenseTotal: number;
  profit: number;
  marginPct: number;
  unpaidTotal: number;
  unpaidCount: number;
  unpaidTop: UnpaidTopItem[];
}

export function buildReportSnapshot(
  revenues: Revenue[],
  expenses: Expense[],
  from: string,
  to: string,
): ReportSnapshot {
  const cashIn = sumCashEventsInRange(revenues, from, to);
  const expenseTotal = expenses
    .filter((e) => isDateInRange(e.date, from, to))
    .reduce((sum, e) => sum + e.amount, 0);
  const profit = cashIn - expenseTotal;
  const marginPct = cashIn > 0 ? (profit / cashIn) * 100 : 0;

  const unpaidInRange = revenues.filter(
    (r) => isUnpaidReceivable(r) && isDateInRange(r.date, from, to),
  );
  const unpaidTotal = sumUnpaidReceivable(unpaidInRange);
  const unpaidCount = unpaidInRange.length;
  const unpaidTop = unpaidInRange
    .slice()
    .sort((a, b) => getRemainingBalance(b) - getRemainingBalance(a))
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      orderCode: r.orderCode,
      date: r.date,
      customerId: r.customerId,
      remaining: getRemainingBalance(r),
      finalAmount: r.finalAmount,
    }));

  return {
    cashIn,
    expenseTotal,
    profit,
    marginPct,
    unpaidTotal,
    unpaidCount,
    unpaidTop,
  };
}
