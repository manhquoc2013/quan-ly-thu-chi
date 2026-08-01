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
  Customer,
  Product,
  OrderPlatform,
  CustomerReportRow,
  ProductReportRow,
  PlatformReportRow,
} from "@/models";
import {
  allCashEvents,
  sumPaidRevenue,
  paidRevenueByMonth,
} from "@/utils/revenueMetrics";

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
 * Group paid revenues by payment month (paidAt YYYY-MM).
 */
export function getRevenueByMonth(revenues: Revenue[]): RevenueByMonth[] {
  return paidRevenueByMonth(revenues);
}

// ── Profit summary ──────────────────────────────────────────────────────────

/**
 * Compute a profit summary from paid revenue and total expense.
 */
export function getProfitSummary(
  expenses: Expense[],
  revenues: Revenue[],
): ProfitSummary {
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalRevenue = sumPaidRevenue(revenues);
  const profit = totalRevenue - totalExpense;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const allMonths = [
    ...expenses.map((e) => toMonth(e.date)),
    ...allCashEvents(revenues).map((e) => toMonth(e.date)),
  ].sort();
  const period = allMonths[allMonths.length - 1] ?? "";

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
  const totalRevenue = sumPaidRevenue(revenues);
  const profit = totalRevenue - totalExpense;

  const pendingOrders = revenues.filter(
    (r) =>
      r.orderStatus === "new" ||
      r.orderStatus === "confirmed" ||
      r.orderStatus === "processing",
  ).length;

  const expenseTx: DashboardSummary["recentTransactions"] = expenses.map(
    (e) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      amount: e.amount,
      type: "expense" as const,
    }),
  );
  const revenueTx: DashboardSummary["recentTransactions"] = revenues.map(
    (r) => ({
      id: r.id,
      date: r.date,
      description: r.orderCode,
      amount: r.finalAmount,
      type: "revenue" as const,
    }),
  );

  const allTransactions = [...expenseTx, ...revenueTx]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return {
    totalExpense,
    totalRevenue,
    profit,
    pendingOrders,
    recentTransactions: allTransactions,
  };
}

// ── Customer report functions ────────────────────────────────────────────────

/**
 * Top N customers by order count (excluding cancelled orders, using finalAmount).
 */
export function getTopCustomersByOrderCount(
  revenues: Revenue[],
  customers: Customer[],
  limit: number = 10,
): CustomerReportRow[] {
  const map = new Map<string, { orderCount: number; totalRevenue: number }>();

  for (const r of revenues) {
    if (r.orderStatus === "cancelled") continue;
    const key = r.customerId;
    const entry = map.get(key) ?? { orderCount: 0, totalRevenue: 0 };
    entry.orderCount += 1;
    entry.totalRevenue += r.finalAmount;
    map.set(key, entry);
  }

  return [...map.entries()]
    .map(([customerId, { orderCount, totalRevenue }]) => {
      const customer = customers.find((c) => c.id === customerId);
      return {
        customerId,
        customerName: customer?.name ?? "Không xác định",
        orderCount,
        totalRevenue,
      };
    })
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
}

/**
 * Top N customers by total revenue (excluding cancelled, using finalAmount).
 */
export function getTopCustomersByRevenue(
  revenues: Revenue[],
  customers: Customer[],
  limit: number = 10,
): CustomerReportRow[] {
  const map = new Map<string, { orderCount: number; totalRevenue: number }>();

  for (const r of revenues) {
    if (r.orderStatus === "cancelled") continue;
    const key = r.customerId;
    const entry = map.get(key) ?? { orderCount: 0, totalRevenue: 0 };
    entry.orderCount += 1;
    entry.totalRevenue += r.finalAmount;
    map.set(key, entry);
  }

  return [...map.entries()]
    .map(([customerId, { orderCount, totalRevenue }]) => {
      const customer = customers.find((c) => c.id === customerId);
      return {
        customerId,
        customerName: customer?.name ?? "Không xác định",
        orderCount,
        totalRevenue,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

// ── Product report functions ─────────────────────────────────────────────────

/**
 * Top N products by quantity sold (across all non-cancelled order items).
 * Join with Product catalog by productId or fallback to item.name.
 */
export function getTopProductsByQuantity(
  revenues: Revenue[],
  products: Product[],
  limit: number = 10,
): ProductReportRow[] {
  const productMap = new Map<string, Product>();
  for (const p of products) {
    productMap.set(p.id, p);
  }

  const map = new Map<
    string,
    { totalQuantity: number; totalRevenue: number; orderCount: number }
  >();

  for (const r of revenues) {
    if (r.orderStatus === "cancelled") continue;
    for (const item of r.items) {
      const key = item.productId || item.name;
      const entry = map.get(key) ?? {
        totalQuantity: 0,
        totalRevenue: 0,
        orderCount: 0,
      };
      entry.totalQuantity += item.quantity;
      entry.totalRevenue += item.total;
      entry.orderCount += 1;
      map.set(key, entry);
    }
  }

  return [...map.entries()]
    .map(([productId, { totalQuantity, totalRevenue, orderCount }]) => {
      const product = productMap.get(productId);
      const productName = product?.name ?? productId;
      return {
        productId,
        productName,
        totalQuantity,
        totalRevenue,
        orderCount,
      };
    })
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, limit);
}

/**
 * Top N products by total revenue (across all non-cancelled order items).
 */
export function getTopProductsByRevenue(
  revenues: Revenue[],
  products: Product[],
  limit: number = 10,
): ProductReportRow[] {
  const productMap = new Map<string, Product>();
  for (const p of products) {
    productMap.set(p.id, p);
  }

  const map = new Map<
    string,
    { totalQuantity: number; totalRevenue: number; orderCount: number }
  >();

  for (const r of revenues) {
    if (r.orderStatus === "cancelled") continue;
    for (const item of r.items) {
      const key = item.productId || item.name;
      const entry = map.get(key) ?? {
        totalQuantity: 0,
        totalRevenue: 0,
        orderCount: 0,
      };
      entry.totalQuantity += item.quantity;
      entry.totalRevenue += item.total;
      entry.orderCount += 1;
      map.set(key, entry);
    }
  }

  return [...map.entries()]
    .map(([productId, { totalQuantity, totalRevenue, orderCount }]) => {
      const product = productMap.get(productId);
      const productName = product?.name ?? productId;
      return {
        productId,
        productName,
        totalQuantity,
        totalRevenue,
        orderCount,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

// ── Platform report function ─────────────────────────────────────────────────

/**
 * Group revenue by platform. Orders without platformId → "Không xác định".
 */
export function getRevenueByPlatform(
  revenues: Revenue[],
  platforms: OrderPlatform[],
): PlatformReportRow[] {
  const platformMap = new Map<string, OrderPlatform>();
  for (const p of platforms) {
    platformMap.set(p.id, p);
  }

  const map = new Map<string, { orderCount: number; totalRevenue: number }>();
  let grandTotal = 0;

  for (const r of revenues) {
    if (r.orderStatus === "cancelled") continue;
    const platformId = r.platformId ?? "";
    const entry = map.get(platformId) ?? { orderCount: 0, totalRevenue: 0 };
    entry.orderCount += 1;
    entry.totalRevenue += r.finalAmount;
    map.set(platformId, entry);
    grandTotal += r.finalAmount;
  }

  return [...map.entries()]
    .map(([platformId, { orderCount, totalRevenue }]) => {
      const platform = platformMap.get(platformId);
      return {
        platformId,
        platformName: platform?.name ?? "Không xác định",
        orderCount,
        totalRevenue,
        percentage: grandTotal > 0 ? (totalRevenue / grandTotal) * 100 : 0,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}
