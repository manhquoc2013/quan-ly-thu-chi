/**
 * Inventory helpers — adjust product stockQty for expense stock-in and order stock-out.
 */

import type { Expense, OrderItem, Product, Revenue } from '@/models';
import { notify, type NotifyOpts } from '@/utils/notify';
import { cacheGet, cacheSet } from './cacheManager';
import { useProductStore } from '@/store/productStore';

const PRODUCT_CACHE = 'products';

export function productStockQty(p: Product): number {
  return typeof p.stockQty === 'number' && Number.isFinite(p.stockQty) ? p.stockQty : 0;
}

/** Paid and not cancelled → order currently holds (deducted) stock. */
export function orderHoldsStock(order: Pick<Revenue, 'paymentStatus' | 'orderStatus'>): boolean {
  return order.paymentStatus === 'paid' && order.orderStatus !== 'cancelled';
}

export function expenseHasStockIn(
  e: Pick<Expense, 'stockProductId' | 'stockQtyIn'>,
): boolean {
  return Boolean(e.stockProductId && e.stockQtyIn && e.stockQtyIn > 0);
}

function qtyByProduct(items: OrderItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const it of items) {
    if (!it.productId) continue;
    const q = Math.max(0, Math.round(it.quantity));
    if (q <= 0) continue;
    map.set(it.productId, (map.get(it.productId) ?? 0) + q);
  }
  return map;
}

/**
 * Apply deltas to product stockQty. Returns products that went negative (after apply).
 */
export async function adjustProductStocks(
  deltas: Map<string, number>,
  opts?: NotifyOpts & { warnNegative?: boolean },
): Promise<{ negatives: Array<{ product: Product; stockQty: number }> }> {
  if (deltas.size === 0) return { negatives: [] };

  const existing = (await cacheGet<Product[]>(PRODUCT_CACHE)) ?? [];
  const negatives: Array<{ product: Product; stockQty: number }> = [];
  let changed = false;
  const next = existing.map((p) => {
    const delta = deltas.get(p.id);
    if (delta === undefined || delta === 0) return p;
    changed = true;
    const stockQty = productStockQty(p) + delta;
    const updated: Product = { ...p, stockQty };
    if (stockQty < 0) negatives.push({ product: updated, stockQty });
    return updated;
  });

  if (!changed) return { negatives: [] };

  await cacheSet(PRODUCT_CACHE, next);
  useProductStore.getState().setProducts(next);

  for (const p of next) {
    if (!deltas.has(p.id)) continue;
    void import('./cloudSync')
      .then((m) => m.cloudUpsertProduct(p))
      .catch((err) => console.error('[cloud] product stock', err));
  }

  if (opts?.warnNegative !== false && negatives.length > 0) {
    const names = negatives.map((n) => `${n.product.name} (${n.stockQty})`).join(', ');
    notify.warning(`Tồn kho âm: ${names}`, { force: true });
  }

  return { negatives };
}

export async function applyExpenseStockIn(
  expense: Expense,
  opts?: NotifyOpts,
): Promise<Expense> {
  if (!expenseHasStockIn(expense) || expense.stockApplied || expense.status === 'cancelled') {
    return expense;
  }
  const deltas = new Map<string, number>([[expense.stockProductId!, expense.stockQtyIn!]]);
  await adjustProductStocks(deltas, { ...opts, warnNegative: false });
  return { ...expense, stockApplied: true };
}

export async function reverseExpenseStockIn(
  expense: Expense,
  opts?: NotifyOpts,
): Promise<Expense> {
  if (!expenseHasStockIn(expense) || !expense.stockApplied) {
    return expense;
  }
  const deltas = new Map<string, number>([[expense.stockProductId!, -expense.stockQtyIn!]]);
  await adjustProductStocks(deltas, { ...opts, warnNegative: false });
  return { ...expense, stockApplied: false };
}

export async function applyOrderStockOut(
  order: Revenue,
  opts?: NotifyOpts,
): Promise<boolean> {
  const map = qtyByProduct(order.items);
  if (map.size === 0) return false;
  const deltas = new Map<string, number>();
  for (const [id, q] of map) deltas.set(id, -q);
  await adjustProductStocks(deltas, opts);
  return true;
}

export async function reverseOrderStockOut(
  order: Revenue,
  opts?: NotifyOpts,
): Promise<boolean> {
  const map = qtyByProduct(order.items);
  if (map.size === 0) return false;
  await adjustProductStocks(map, { ...opts, warnNegative: false });
  return true;
}

/**
 * Sync stock for order create/update based on hold state and item changes.
 * Returns whether the order should have stockApplied=true after sync.
 */
export async function syncOrderStock(
  prev: Revenue | null,
  next: Revenue,
  opts?: NotifyOpts,
): Promise<boolean> {
  const prevHeld = prev ? Boolean(prev.stockApplied) : false;
  const nextShouldHold = orderHoldsStock(next);

  if (prevHeld && nextShouldHold && prev) {
    const prevMap = qtyByProduct(prev.items);
    const nextMap = qtyByProduct(next.items);
    const same =
      prevMap.size === nextMap.size &&
      [...prevMap].every(([id, q]) => nextMap.get(id) === q);
    if (same) return true;

    const deltas = new Map<string, number>();
    for (const [id, q] of prevMap) deltas.set(id, (deltas.get(id) ?? 0) + q);
    for (const [id, q] of nextMap) deltas.set(id, (deltas.get(id) ?? 0) - q);
    await adjustProductStocks(deltas, opts);
    return true;
  }

  if (prevHeld && !nextShouldHold && prev) {
    await reverseOrderStockOut(prev, opts);
    return false;
  }

  if (!prevHeld && nextShouldHold) {
    await applyOrderStockOut(next, opts);
    return true;
  }

  return false;
}

/** Parse leading qty from phrases like "10 con mèo", "3 × kẹp tóc". */
export function parseStockQtyFromDescription(text: string): {
  quantity: number;
  productName: string;
} {
  const t = text.trim();
  const m =
    /^(?:nhập\s+(?:hàng\s+)?)?(\d{1,5})\s*(?:×|x|cái|con|chiếc|bộ|cặp|set|hộp)?\s*(.+)$/i.exec(
      t,
    ) || /^(\d{1,5})\s*[×x]\s*(.+)$/i.exec(t);
  if (m) {
    const quantity = Math.max(1, parseInt(m[1]!, 10) || 1);
    const productName = m[2]!
      .replace(/^(?:cái|con|chiếc|bộ|cặp|set|hộp)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { quantity, productName: productName || t };
  }
  return { quantity: 1, productName: t };
}
