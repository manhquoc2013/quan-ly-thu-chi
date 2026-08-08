/**
 * Inventory report helpers — stock-in cash summary + FIFO COGS for paid sales.
 * Lots are derived from applied stock-in expenses (no persistent lot table).
 */

import type { Expense, Product, Revenue } from '@/models';
import { isDateInRange } from '@/utils/date';
import { expenseHasStockIn } from './stockService';

export interface StockInProductRow {
  productId: string;
  productName: string;
  qty: number;
  amount: number;
}

export interface StockInCashSummary {
  totalAmount: number;
  totalQty: number;
  byProduct: StockInProductRow[];
  entries: Array<{
    expenseId: string;
    date: string;
    productId: string;
    productName: string;
    qty: number;
    amount: number;
    unitCost: number;
  }>;
}

export interface GrossProductRow {
  productId: string;
  productName: string;
  qtySold: number;
  goodsRevenue: number;
  cogs: number;
  estimatedCogs: number;
  grossProfit: number;
  hasEstimated: boolean;
}

export interface GrossMarginSummary {
  goodsRevenue: number;
  cogs: number;
  estimatedCogs: number;
  grossProfit: number;
  marginPct: number;
  qtySold: number;
  byProduct: GrossProductRow[];
}

export interface RemainingLotRow {
  productId: string;
  productName: string;
  qty: number;
  value: number;
}

export interface RemainingInventorySummary {
  totalQty: number;
  totalValue: number;
  byProduct: RemainingLotRow[];
}

export interface InventoryReportResult {
  stockIn: StockInCashSummary;
  gross: GrossMarginSummary;
  remaining: RemainingInventorySummary;
}

interface Lot {
  expenseId: string;
  productId: string;
  date: string;
  createdAt: string;
  qty: number;
  unitCost: number;
}

interface Outflow {
  revenueId: string;
  productId: string;
  date: string;
  createdAt: string;
  qty: number;
  unitPrice: number;
}

function productNameMap(products: Product[]): Map<string, Product> {
  return new Map(products.map((p) => [p.id, p]));
}

function nameOf(map: Map<string, Product>, productId: string): string {
  return map.get(productId)?.name ?? productId.slice(0, 8);
}

function defaultUnitCost(map: Map<string, Product>, productId: string): number {
  const p = map.get(productId);
  const n = p?.defaultUnitPrice;
  return typeof n === 'number' && n > 0 ? Math.round(n) : 1;
}

export function isStockInExpense(e: Expense): boolean {
  return (
    expenseHasStockIn(e) &&
    Boolean(e.stockApplied) &&
    e.status !== 'cancelled'
  );
}

export function unitCostFromStockIn(e: Expense): number {
  const qty = e.stockQtyIn ?? 0;
  if (qty <= 0) return 1;
  return Math.max(1, Math.round(e.amount / qty));
}

function saleEventDate(r: Revenue): string {
  if (typeof r.paidAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.paidAt)) {
    return r.paidAt;
  }
  return r.date;
}

function isPaidSale(r: Revenue): boolean {
  return r.paymentStatus === 'paid' && r.orderStatus !== 'cancelled';
}

function compareEvent(
  a: { date: string; createdAt: string; id: string },
  b: { date: string; createdAt: string; id: string },
): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function stockInCashSummary(
  expenses: Expense[],
  products: Product[],
  from: string,
  to: string,
): StockInCashSummary {
  const map = productNameMap(products);
  const byProduct = new Map<string, StockInProductRow>();
  const entries: StockInCashSummary['entries'] = [];
  let totalAmount = 0;
  let totalQty = 0;

  for (const e of expenses) {
    if (!isStockInExpense(e)) continue;
    if (!isDateInRange(e.date, from, to)) continue;
    const productId = e.stockProductId!;
    const qty = e.stockQtyIn!;
    const unitCost = unitCostFromStockIn(e);
    totalAmount += e.amount;
    totalQty += qty;
    entries.push({
      expenseId: e.id,
      date: e.date,
      productId,
      productName: nameOf(map, productId),
      qty,
      amount: e.amount,
      unitCost,
    });
    const row = byProduct.get(productId) ?? {
      productId,
      productName: nameOf(map, productId),
      qty: 0,
      amount: 0,
    };
    row.qty += qty;
    row.amount += e.amount;
    byProduct.set(productId, row);
  }

  entries.sort((a, b) => (a.date === b.date ? a.expenseId.localeCompare(b.expenseId) : a.date.localeCompare(b.date)));

  return {
    totalAmount,
    totalQty,
    byProduct: Array.from(byProduct.values()).sort((a, b) => b.amount - a.amount),
    entries,
  };
}

type TimelineEvent =
  | {
      kind: 'in';
      date: string;
      createdAt: string;
      id: string;
      lot: Lot;
    }
  | {
      kind: 'out';
      date: string;
      createdAt: string;
      id: string;
      flow: Outflow;
    };

/** Push lots / consume sales in chronological order (no future lots before a sale). */
function buildTimeline(expenses: Expense[], revenues: Revenue[], to: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const e of expenses) {
    if (!isStockInExpense(e)) continue;
    if (to && e.date > to) continue;
    const lot: Lot = {
      expenseId: e.id,
      productId: e.stockProductId!,
      date: e.date,
      createdAt: e.createdAt,
      qty: e.stockQtyIn!,
      unitCost: unitCostFromStockIn(e),
    };
    events.push({
      kind: 'in',
      date: lot.date,
      createdAt: lot.createdAt,
      id: `in:${lot.expenseId}`,
      lot,
    });
  }

  for (const r of revenues) {
    if (!isPaidSale(r)) continue;
    const date = saleEventDate(r);
    if (to && date > to) continue;
    r.items.forEach((item, itemIndex) => {
      if (!item.productId) return;
      const qty = Math.max(0, Math.round(item.quantity));
      if (qty <= 0) return;
      const flow: Outflow = {
        revenueId: r.id,
        productId: item.productId,
        date,
        createdAt: r.createdAt,
        qty,
        unitPrice: Math.max(0, Math.round(item.unitPrice)),
      };
      events.push({
        kind: 'out',
        date: flow.date,
        createdAt: flow.createdAt,
        id: `out:${r.id}:${item.id ?? itemIndex}`,
        flow,
      });
    });
  }

  // Same timestamp: stock-in before sale so same-day nhập sớm hơn vẫn dùng được.
  events.sort((a, b) => {
    const byTime = compareEvent(a, b);
    if (byTime !== 0) return byTime;
    if (a.kind === b.kind) return a.id.localeCompare(b.id);
    return a.kind === 'in' ? -1 : 1;
  });

  return events;
}

export function buildInventoryReport(input: {
  expenses: Expense[];
  revenues: Revenue[];
  products: Product[];
  from: string;
  to: string;
}): InventoryReportResult {
  const { expenses, revenues, products, from, to } = input;
  const map = productNameMap(products);
  const stockIn = stockInCashSummary(expenses, products, from, to);

  const queues = new Map<string, Lot[]>();
  const byProduct = new Map<string, GrossProductRow>();
  let goodsRevenue = 0;
  let cogs = 0;
  let estimatedCogs = 0;
  let qtySold = 0;

  for (const ev of buildTimeline(expenses, revenues, to)) {
    if (ev.kind === 'in') {
      const q = queues.get(ev.lot.productId) ?? [];
      q.push({ ...ev.lot });
      queues.set(ev.lot.productId, q);
      continue;
    }

    const flow = ev.flow;
    const inRange = isDateInRange(flow.date, from, to);
    let remain = flow.qty;
    let flowCogs = 0;
    let flowEstimated = 0;

    const q = queues.get(flow.productId) ?? [];
    while (remain > 0 && q.length > 0) {
      const head = q[0]!;
      const take = Math.min(remain, head.qty);
      flowCogs += take * head.unitCost;
      head.qty -= take;
      remain -= take;
      if (head.qty <= 0) q.shift();
    }
    queues.set(flow.productId, q);

    if (remain > 0) {
      const fallback = defaultUnitCost(map, flow.productId);
      flowEstimated += remain * fallback;
      flowCogs += remain * fallback;
    }

    if (!inRange) continue;

    const lineRevenue = flow.qty * flow.unitPrice;
    goodsRevenue += lineRevenue;
    cogs += flowCogs;
    estimatedCogs += flowEstimated;
    qtySold += flow.qty;

    const row = byProduct.get(flow.productId) ?? {
      productId: flow.productId,
      productName: nameOf(map, flow.productId),
      qtySold: 0,
      goodsRevenue: 0,
      cogs: 0,
      estimatedCogs: 0,
      grossProfit: 0,
      hasEstimated: false,
    };
    row.qtySold += flow.qty;
    row.goodsRevenue += lineRevenue;
    row.cogs += flowCogs;
    row.estimatedCogs += flowEstimated;
    if (flowEstimated > 0) row.hasEstimated = true;
    row.grossProfit = row.goodsRevenue - row.cogs;
    byProduct.set(flow.productId, row);
  }

  const remainingByProduct = new Map<string, RemainingLotRow>();
  let remainingQty = 0;
  let remainingValue = 0;
  for (const [productId, q] of queues) {
    let qty = 0;
    let value = 0;
    for (const lot of q) {
      qty += lot.qty;
      value += lot.qty * lot.unitCost;
    }
    if (qty <= 0) continue;
    remainingQty += qty;
    remainingValue += value;
    remainingByProduct.set(productId, {
      productId,
      productName: nameOf(map, productId),
      qty,
      value,
    });
  }

  const grossProfit = goodsRevenue - cogs;
  return {
    stockIn,
    gross: {
      goodsRevenue,
      cogs,
      estimatedCogs,
      grossProfit,
      marginPct: goodsRevenue > 0 ? (grossProfit / goodsRevenue) * 100 : 0,
      qtySold,
      byProduct: Array.from(byProduct.values()).sort((a, b) => b.grossProfit - a.grossProfit),
    },
    remaining: {
      totalQty: remainingQty,
      totalValue: remainingValue,
      byProduct: Array.from(remainingByProduct.values()).sort((a, b) => b.value - a.value),
    },
  };
}
