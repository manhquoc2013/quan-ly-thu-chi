/**
 * Dashboard action-first snapshot — month KPIs, work queue, products, chart, recent.
 */

import {
  EXPENSE_CATEGORY_LABELS,
  type Expense,
  type ExpenseCategory,
  type Revenue,
} from '@/models';
import { getMonthRange } from '@/utils/date';
import {
  cashRevenueOnDate,
  isUnpaidReceivable,
  sumCashEventsInRange,
  sumUnpaidReceivable,
} from '@/utils/revenueMetrics';

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;
const QUEUE_MAX = 6;
const RECENT_MAX = 6;

function isOpenOrder(r: Revenue): boolean {
  return r.orderStatus !== 'completed' && r.orderStatus !== 'cancelled';
}

function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function orderSummary(order: Revenue): string {
  const first = order.items[0]?.name?.trim();
  if (!first) return order.orderCode;
  const extra = order.items.length > 1 ? ` +${order.items.length - 1}` : '';
  return `${first}${extra}`;
}

export interface DashboardProductSummary {
  name: string;
  totalQty: number;
  orderCount: number;
  hasPriority: boolean;
}

export interface DashboardChartDay {
  day: string;
  date: string;
  thu: number;
  chi: number;
}

export interface DashboardRecentItem {
  id: string;
  desc: string;
  amount: number;
  type: 'expense' | 'income';
  date: string;
  cat: string;
  sortAt: string;
}

export interface DashboardSnapshot {
  monthCashIn: number;
  monthExpense: number;
  monthProfit: number;
  unpaidTotal: number;
  unpaidCount: number;
  pendingCount: number;
  priorityCount: number;
  queue: Revenue[];
  products: DashboardProductSummary[];
  chart7d: DashboardChartDay[];
  recent: DashboardRecentItem[];
}

function buildPendingProducts(revenues: Revenue[]): DashboardProductSummary[] {
  const pendingOrders = revenues.filter(isOpenOrder);
  const map = new Map<string, DashboardProductSummary>();
  for (const order of pendingOrders) {
    for (const item of order.items) {
      const key = item.name.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.totalQty += item.quantity;
        existing.orderCount += 1;
        existing.hasPriority = existing.hasPriority || !!order.priority;
      } else {
        map.set(key, {
          name: item.name.trim(),
          totalQty: item.quantity,
          orderCount: 1,
          hasPriority: !!order.priority,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.hasPriority !== b.hasPriority) return a.hasPriority ? -1 : 1;
    return b.totalQty - a.totalQty;
  });
}

function buildQueue(revenues: Revenue[]): Revenue[] {
  const open = revenues.filter(isOpenOrder);
  const priority = open
    .filter((r) => r.priority)
    .slice()
    .sort(
      (a, b) =>
        (b.priorityAt ?? '').localeCompare(a.priorityAt ?? '') ||
        b.date.localeCompare(a.date) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const pendingRest = open
    .filter((r) => !r.priority)
    .slice()
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt),
    );
  return [...priority, ...pendingRest].slice(0, QUEUE_MAX);
}

function buildChart7d(
  revenues: Revenue[],
  expenses: Expense[],
  now: Date,
): DashboardChartDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - i));
    const dateStr = localDateISO(date);
    return {
      day: DAY_LABELS[date.getDay()]!,
      date: dateStr,
      thu: cashRevenueOnDate(revenues, dateStr),
      chi: expenses.filter((e) => e.date === dateStr).reduce((s, e) => s + e.amount, 0),
    };
  });
}

function buildRecent(revenues: Revenue[], expenses: Expense[]): DashboardRecentItem[] {
  const items: DashboardRecentItem[] = [
    ...expenses.map((e) => ({
      id: e.id,
      desc: e.description,
      amount: e.amount,
      type: 'expense' as const,
      date: e.date,
      cat: EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category,
      sortAt: e.updatedAt || e.createdAt || e.date,
    })),
    ...revenues.map((r) => ({
      id: r.id,
      desc: r.orderCode,
      amount: r.finalAmount,
      type: 'income' as const,
      date: r.date,
      cat: orderSummary(r),
      sortAt: r.updatedAt || r.createdAt || r.date,
    })),
  ];
  return items.sort((a, b) => b.sortAt.localeCompare(a.sortAt)).slice(0, RECENT_MAX);
}

export function buildDashboardSnapshot(
  revenues: Revenue[],
  expenses: Expense[],
  now: Date = new Date(),
): DashboardSnapshot {
  const { start, end } = getMonthRange(now);
  const monthCashIn = sumCashEventsInRange(revenues, start, end);
  const monthExpense = expenses
    .filter((e) => e.date >= start && e.date <= end)
    .reduce((s, e) => s + e.amount, 0);
  const unpaid = revenues.filter(isUnpaidReceivable);
  const open = revenues.filter(isOpenOrder);

  return {
    monthCashIn,
    monthExpense,
    monthProfit: monthCashIn - monthExpense,
    unpaidTotal: sumUnpaidReceivable(revenues),
    unpaidCount: unpaid.length,
    pendingCount: open.length,
    priorityCount: open.filter((r) => r.priority).length,
    queue: buildQueue(revenues),
    products: buildPendingProducts(revenues),
    chart7d: buildChart7d(revenues, expenses, now),
    recent: buildRecent(revenues, expenses),
  };
}
