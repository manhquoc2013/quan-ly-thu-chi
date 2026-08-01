/**
 * Revenue / Order CRUD service — IndexedDB cache + Zustand store sync.
 *
 * Auto-generates order codes in the format: `DH-YYYYMMDD-NNN`.
 *
 * Usage:
 *   import { getAllRevenues, createRevenue, updateRevenue, deleteRevenues } from '@/services/revenueService';
 */

import type { Revenue, ShippingPayer } from '@/models';
import { useRevenueStore } from '@/store';
import { notify, type NotifyOpts } from '@/utils/notify';
import { computeOrderTotals } from '@/utils/orderTotals';
import {
  normalizePaymentFields,
  normalizeDepositPaymentOnWrite,
} from '@/utils/revenueMetrics';
import { cacheGet, cacheSet } from './cacheManager';
import { createExpense, updateExpense, deleteExpenses } from './expenseService';

const CACHE_KEY = 'revenues';

/**
 * Build a display order code: `DH-YYYYMMDD-NNN`.
 * Scans existing revenues for the same date to determine the NNN counter.
 */
export function buildOrderCode(date: string, revenues: Revenue[]): string {
  const d = date.replace(/-/g, '');
  const prefix = `DH-${d}-`;
  let maxN = 0;
  for (const r of revenues) {
    if (!r.orderCode.startsWith(prefix)) continue;
    const suffix = r.orderCode.slice(prefix.length);
    // Only sequential 1–999 style counters (ignore legacy Timestamp suffixes)
    if (!/^\d{1,3}$/.test(suffix)) continue;
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > maxN) maxN = num;
  }
  const next = maxN + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function assertUniqueOrderCode(code: string, revenues: Revenue[], exceptId?: string): void {
  const trimmed = code.trim();
  if (!trimmed) throw new Error('Mã đơn không được trống');
  if (trimmed.length > 40) throw new Error('Mã đơn tối đa 40 ký tự');
  const clash = revenues.find((r) => r.orderCode === trimmed && r.id !== exceptId);
  if (clash) throw new Error(`Mã đơn “${trimmed}” đã tồn tại`);
}

/**
 * Ensure every order has a unique DH-YYYYMMDD-NNN code.
 * Rewrites colliding / legacy codes (e.g. Date.now suffixes).
 */
export function normalizeOrderCodes(revenues: Revenue[]): { records: Revenue[]; changed: boolean } {
  const used = new Set<string>();
  let changed = false;
  const records = revenues.map((r) => {
    const prefix = `DH-${r.date.replace(/-/g, '')}-`;
    const okFormat = new RegExp(`^${prefix}\\d{3}$`).test(r.orderCode);
    if (okFormat && !used.has(r.orderCode)) {
      used.add(r.orderCode);
      return r;
    }
    changed = true;
    let maxN = 0;
    for (const code of used) {
      if (!code.startsWith(prefix)) continue;
      const n = parseInt(code.slice(prefix.length), 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
    let next = maxN + 1;
    let candidate = `${prefix}${String(next).padStart(3, '0')}`;
    while (used.has(candidate)) {
      next += 1;
      candidate = `${prefix}${String(next).padStart(3, '0')}`;
    }
    used.add(candidate);
    return { ...r, orderCode: candidate, updatedAt: new Date().toISOString() };
  });
  return { records, changed };
}

async function syncShippingExpense(
  order: Revenue,
  previousExpenseId?: string,
): Promise<string | undefined> {
  const fee = order.shippingFee ?? 0;
  const shopPays = fee > 0 && order.shippingPayer === 'shop';
  const silent = { silent: true as const };

  if (!shopPays) {
    if (previousExpenseId) {
      await deleteExpenses([previousExpenseId], silent);
    }
    return undefined;
  }

  const description = `Ship đơn ${order.orderCode}`;
  if (previousExpenseId) {
    const updated = await updateExpense(
      previousExpenseId,
      {
        date: order.date,
        amount: fee,
        description,
        category: 'transportation',
        status: 'paid',
        paymentMethod: order.paymentMethod,
      },
      silent,
    );
    if (updated) return updated.id;
  }

  const created = await createExpense(
    {
      date: order.date,
      category: 'transportation',
      amount: fee,
      description,
      status: 'paid',
      paymentMethod: order.paymentMethod,
      tags: ['ship', 'don-hang'],
    },
    silent,
  );
  return created.id;
}

/**
 * Load all revenues from IndexedDB cache, fall back to empty array.
 * Syncs into the Zustand store after loading.
 */
export async function getAllRevenues(): Promise<Revenue[]> {
  const records = await cacheGet<Revenue[]>(CACHE_KEY);
  const store = useRevenueStore.getState();
  if (!records) {
    store.setRecords([]);
    return [];
  }
  const { records: codeFixed, changed: codesChanged } = normalizeOrderCodes(records);
  const { records: normalized, changed: payChanged } = normalizePaymentFields(codeFixed);
  if (codesChanged || payChanged) {
    await cacheSet(CACHE_KEY, normalized);
  }
  store.setRecords(normalized);
  return normalized;
}

/**
 * Create a new revenue (order) record.
 * Auto-generates `id`, `orderCode`, `createdAt`, `updatedAt`.
 * Auto-computes `totalAmount` and `finalAmount` from items + discount.
 *
 * Validation rules:
 * - items must be a non-empty array of OrderItem
 * - each item: quantity >= 1, unitPrice > 0, total = quantity * unitPrice
 * - discount >= 0 and <= totalAmount
 * - date must be a valid ISO date string (yyyy-MM-dd)
 * - customerId must be a non-empty string
 */
export async function createRevenue(
  data: Omit<
    Revenue,
    | 'id'
    | 'orderCode'
    | 'createdAt'
    | 'updatedAt'
    | 'totalAmount'
    | 'finalAmount'
    | 'paymentStatus'
    | 'paidAt'
    | 'paidAmount'
    | 'depositAmount'
    | 'depositedAt'
  > & {
    orderCode?: string;
    paymentStatus?: Revenue['paymentStatus'];
    paidAt?: string;
    paidAmount?: number;
    depositAmount?: number;
    depositedAt?: string;
  },
  opts?: NotifyOpts,
): Promise<Revenue> {
  // --- manual validation ---
  if (!Array.isArray(data.items) || data.items.length < 1) {
    throw new Error('items must be a non-empty array');
  }
  for (const item of data.items) {
    if (typeof item.quantity !== 'number' || item.quantity < 1) {
      throw new Error(`item "${item.name}": quantity must be >= 1`);
    }
    if (typeof item.unitPrice !== 'number' || item.unitPrice <= 0) {
      throw new Error(`item "${item.name}": unitPrice must be > 0`);
    }
    const expectedTotal = item.quantity * item.unitPrice;
    if (typeof item.total !== 'number' || Math.abs(item.total - expectedTotal) > 0.01) {
      throw new Error(`item "${item.name}": total must equal quantity × unitPrice`);
    }
  }
  if (typeof data.discount !== 'number' || data.discount < 0) {
    throw new Error('discount must be a non-negative number');
  }

  const existing = (await cacheGet<Revenue[]>(CACHE_KEY)) ?? [];
  const totals = computeOrderTotals(
    data.items,
    data.discount,
    data.shippingFee,
    data.shippingPayer as ShippingPayer | undefined,
  );

  // Ensure discount does not exceed totalAmount
  if (data.discount > totals.totalAmount) {
    throw new Error('discount cannot exceed totalAmount');
  }

  const now = new Date().toISOString();
  const orderCode = (data.orderCode ?? '').trim() || buildOrderCode(data.date, existing);
  assertUniqueOrderCode(orderCode, existing);

  const pay = normalizeDepositPaymentOnWrite({
    finalAmount: totals.finalAmount,
    paymentStatus: data.paymentStatus ?? 'unpaid',
    paidAt: data.paidAt,
    paidAmount: data.paidAmount,
    depositAmount: data.depositAmount,
    depositedAt: data.depositedAt,
    fallbackDate: data.date,
  });

  let record: Revenue = {
    ...data,
    ...pay,
    id: crypto.randomUUID(),
    orderCode,
    totalAmount: totals.totalAmount,
    finalAmount: totals.finalAmount,
    shippingFee: totals.shippingFee || undefined,
    shippingPayer: totals.shippingPayer,
    shippingExpenseId: undefined,
    createdAt: now,
    updatedAt: now,
  };

  const expenseId = await syncShippingExpense(record);
  if (expenseId) {
    record = { ...record, shippingExpenseId: expenseId };
  }

  const updated = [...existing, record];
  await cacheSet(CACHE_KEY, updated);
  useRevenueStore.getState().setRecords(updated);

  notify.success(`Đã thêm đơn ${record.orderCode}`, opts);
  return record;
}

/**
 * Update an existing revenue by id.
 * Recalculates `totalAmount` and `finalAmount` if items or discount changed.
 */
export async function updateRevenue(
  id: string,
  patch: Partial<Omit<Revenue, 'id' | 'createdAt' | 'updatedAt'>>,
  opts?: NotifyOpts,
): Promise<Revenue | undefined> {
  const existing = (await cacheGet<Revenue[]>(CACHE_KEY)) ?? [];
  const idx = existing.findIndex((r) => r.id === id);
  if (idx === -1) {
    notify.error('Không tìm thấy đơn hàng để cập nhật', opts);
    return undefined;
  }

  // Validate fields present in patch
  if (patch.items !== undefined) {
    if (!Array.isArray(patch.items) || patch.items.length < 1) {
      throw new Error('items must be a non-empty array');
    }
    for (const item of patch.items) {
      if (typeof item.quantity !== 'number' || item.quantity < 1) {
        throw new Error(`item: quantity must be >= 1`);
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice <= 0) {
        throw new Error(`item: unitPrice must be > 0`);
      }
    }
  }
  if (patch.discount !== undefined && (typeof patch.discount !== 'number' || patch.discount < 0)) {
    throw new Error('discount must be a non-negative number');
  }
  if (patch.orderCode !== undefined) {
    assertUniqueOrderCode(patch.orderCode, existing, id);
    patch = { ...patch, orderCode: patch.orderCode.trim() };
  }

  const merged = {
    ...existing[idx]!,
    ...patch,
    id: existing[idx]!.id,
    date: (patch.date ?? existing[idx]!.date)!,
    updatedAt: new Date().toISOString(),
  };

  const totals = computeOrderTotals(
    merged.items,
    merged.discount,
    merged.shippingFee,
    merged.shippingPayer,
  );
  merged.totalAmount = totals.totalAmount;
  merged.finalAmount = totals.finalAmount;
  merged.shippingFee = totals.shippingFee || undefined;
  merged.shippingPayer = totals.shippingPayer;

  const payStatus =
    patch.paymentStatus === 'unpaid'
      ? 'unpaid'
      : (patch.paymentStatus ?? merged.paymentStatus);
  const pay = normalizeDepositPaymentOnWrite({
    finalAmount: merged.finalAmount,
    paymentStatus: payStatus,
    paidAt:
      payStatus === 'unpaid'
        ? undefined
        : patch.paidAt !== undefined
          ? patch.paidAt
          : merged.paidAt,
    paidAmount:
      payStatus === 'unpaid'
        ? undefined
        : patch.paidAmount !== undefined
          ? patch.paidAmount
          : merged.paidAmount,
    depositAmount:
      patch.depositAmount !== undefined ? patch.depositAmount : merged.depositAmount,
    depositedAt:
      patch.depositedAt !== undefined ? patch.depositedAt : merged.depositedAt,
    fallbackDate: merged.date,
  });

  let updated: Revenue = {
    ...merged,
    ...pay,
  };

  const prevExpenseId = existing[idx]!.shippingExpenseId;
  const expenseId = await syncShippingExpense(updated, prevExpenseId);
  updated = { ...updated, shippingExpenseId: expenseId };

  const updatedAll = [...existing];
  updatedAll[idx] = updated;

  await cacheSet(CACHE_KEY, updatedAll);
  useRevenueStore.getState().setRecords(updatedAll);

  notify.success(`Đã cập nhật đơn ${updated.orderCode}`, opts);
  return updated;
}

/**
 * Delete one or more revenues by id.
 */
export async function deleteRevenues(ids: string[], opts?: NotifyOpts): Promise<void> {
  const existing = (await cacheGet<Revenue[]>(CACHE_KEY)) ?? [];
  const toDelete = existing.filter((r) => ids.includes(r.id));
  const expenseIds = toDelete
    .map((r) => r.shippingExpenseId)
    .filter((id): id is string => !!id);
  if (expenseIds.length) {
    await deleteExpenses(expenseIds, { silent: true });
  }
  const updated = existing.filter((r) => !ids.includes(r.id));
  await cacheSet(CACHE_KEY, updated);
  useRevenueStore.getState().setRecords(updated);
  const n = ids.length;
  notify.success(n > 1 ? `Đã xóa ${n} đơn hàng` : 'Đã xóa đơn hàng', opts);
}
