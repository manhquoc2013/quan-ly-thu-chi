/**
 * Report computation functions — pure functions that derive aggregated
 * views from expense and revenue data arrays.
 *
 * No I/O, no side effects. Designed to receive data from stores or
 * cache and return typed report objects.
 *
 * Usage:
 *   import { getDashboardSummary, getExpenseByCategory, ... } from '@/services/reportService';
 */

import type {
  Expense,
  Revenue,
  DashboardSummary,
  ExpenseByCategory,
  ExpenseByMonth,
  RevenueByMonth,
  ProfitSummary,
} from '@/models';

// ── Helper: extract YYYY-MM from ISO date ───────────────────────────────────

function toMonth(date: string): string {
  return date.slice(0, 7); // "2026-07"
}

// ── Expense by category ─────────────────────────────────────────────────────

/**
 * Group expenses by category and compute total, count, percentage.
 */
export function getExpenseByCategory(expenses: Expense[]): ExpenseByCategory[] {
  const map: Record<string, { total: number; count: number }> = {};
  let grandTotal = 0;

  for (const e of expenses) {
    const entry = map[e.category] ?? { total: 0, count: 0 };
    entry.total += e.amount;
    entry.count += 1;
    map[e.category] = entry;
    grandTotal += e.amount;
  }

  return Object.entries(map)
    .map(([category, { total, count }]) => ({
      category,
      total,
      count,
      percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// ── Expense by month ────────────────────────────────────────────────────────

/**
 * Group expenses by month (YYYY-MM) and compute total, count.
 */
export function getExpenseByMonth(expenses: Expense[]): ExpenseByMonth[] {
  const map: Record<string, { total: number; count: number }> = {};

  for (const e of expenses) {
    const month = toMonth(e.date);
    const entry = map[month] ?? { total: 0, count: 0 };
    entry.total += e.amount;
    entry.count += 1;
    map[month] = entry;
  }

  return Object.entries(map)
    .map(([month, { total, count }]) => ({ month, total, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ── Revenue by month ────────────────────────────────────────────────────────

/**
 * Group revenues by month (YYYY-MM) and compute total (finalAmount), count.
 */
export function getRevenueByMonth(revenues: Revenue[]): RevenueByMonth[] {
  const map: Record<string, { total: number; count: number }> = {};

  for (const r of revenues) {
    const month = toMonth(r.date);
    const entry = map[month] ?? { total: 0, count: 0 };
    entry.total += r.finalAmount;
    entry.count += 1;
    map[month] = entry;
  }

  return Object.entries(map)
    .map(([month, { total, count }]) => ({ month, total, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ── Profit summary ──────────────────────────────────────────────────────────

/**
 * Compute a profit summary from total revenue and total expense.
 */
export function getProfitSummary(
  expenses: Expense[],
  revenues: Revenue[],
): ProfitSummary {
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalRevenue = revenues.reduce((sum, r) => sum + r.finalAmount, 0);
  const profit = totalRevenue - totalExpense;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // Use the month range of the most recent data
  const allMonths = [
    ...expenses.map((e) => toMonth(e.date)),
    ...revenues.map((r) => toMonth(r.date)),
  ].sort();
  const period = allMonths[allMonths.length - 1] ?? '';

  return { totalRevenue, totalExpense, profit, margin, period };
}

// ── Dashboard summary ───────────────────────────────────────────────────────

/**
 * Compute a dashboard snapshot: totals, profit, pending orders, recent transactions.
 */
export function getDashboardSummary(
  expenses: Expense[],
  revenues: Revenue[],
): DashboardSummary {
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalRevenue = revenues.reduce((sum, r) => sum + r.finalAmount, 0);
  const profit = totalRevenue - totalExpense;

  // Count pending / processing orders
  const pendingOrders = revenues.filter(
    (r) => r.orderStatus === 'new' || r.orderStatus === 'confirmed' || r.orderStatus === 'processing',
  ).length;

  // Gather recent transactions (up to 10)
  const expenseTx: DashboardSummary['recentTransactions'] = expenses.map((e) => ({
    id: e.id,
    date: e.date,
    description: e.description,
    amount: e.amount,
    type: 'expense' as const,
  }));
  const revenueTx: DashboardSummary['recentTransactions'] = revenues.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.orderCode,
    amount: r.finalAmount,
    type: 'revenue' as const,
  }));

  const allTransactions = [...expenseTx, ...revenueTx]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return { totalExpense, totalRevenue, profit, pendingOrders, recentTransactions: allTransactions };
}
