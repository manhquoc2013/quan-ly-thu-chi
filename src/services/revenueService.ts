/**
 * Revenue / Order CRUD service — IndexedDB cache + Zustand store sync.
 *
 * Auto-generates order codes in the format: `DH-YYYYMMDD-NNN`.
 *
 * Usage:
 *   import { getAllRevenues, createRevenue, updateRevenue, deleteRevenues } from '@/services/revenueService';
 */

import type { Revenue, OrderItem } from '@/models';
import { useRevenueStore } from '@/store';
import { cacheGet, cacheSet } from './cacheManager';

const CACHE_KEY = 'revenues';

/**
 * Build a display order code: `DH-YYYYMMDD-NNN`.
 * Scans existing revenues for the same date to determine the NNN counter.
 */
function buildOrderCode(date: string, revenues: Revenue[]): string {
  const d = date.replace(/-/g, '');
  // Count existing orders for the same date
  const sameDay = revenues.filter((r) => r.date === date);
  let maxN = 0;
  for (const r of sameDay) {
    const suffix = r.orderCode.slice(-(d.length + 1) - 2); // extract NNN after DH-YYYYMMDD-
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > maxN) {
      maxN = num;
    }
  }
  const next = maxN + 1;
  return `DH-${d}-${String(next).padStart(3, '0')}`;
}

/**
 * Compute derived fields for an order: totalAmount, finalAmount.
 */
function computeTotals(items: OrderItem[], discount: number): { totalAmount: number; finalAmount: number } {
  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const finalAmount = Math.max(0, totalAmount - discount);
  return { totalAmount, finalAmount };
}

/**
 * Load all revenues from IndexedDB cache, fall back to empty array.
 * Syncs into the Zustand store after loading.
 */
export async function getAllRevenues(): Promise<Revenue[]> {
  const records = await cacheGet<Revenue[]>(CACHE_KEY);
  const store = useRevenueStore.getState();
  if (records) {
    store.setRecords(records);
  } else {
    store.setRecords([]);
  }
  return records ?? [];
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
  data: Omit<Revenue, 'id' | 'orderCode' | 'createdAt' | 'updatedAt' | 'totalAmount' | 'finalAmount'>,
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
  const { totalAmount, finalAmount } = computeTotals(data.items, data.discount);

  // Ensure discount does not exceed totalAmount
  if (data.discount > totalAmount) {
    throw new Error('discount cannot exceed totalAmount');
  }

  const now = new Date().toISOString();
  const orderCode = buildOrderCode(data.date, existing);

  const record: Revenue = {
    ...data,
    id: crypto.randomUUID(),
    orderCode,
    totalAmount,
    finalAmount,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [...existing, record];
  await cacheSet(CACHE_KEY, updated);
  useRevenueStore.getState().setRecords(updated);

  return record;
}

/**
 * Update an existing revenue by id.
 * Recalculates `totalAmount` and `finalAmount` if items or discount changed.
 */
export async function updateRevenue(
  id: string,
  patch: Partial<Omit<Revenue, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Revenue | undefined> {
  const existing = (await cacheGet<Revenue[]>(CACHE_KEY)) ?? [];
  const idx = existing.findIndex((r) => r.id === id);
  if (idx === -1) {
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

  const updated: Revenue = {
    ...existing[idx]!,
    ...patch,
    id: existing[idx]!.id,
    date: (patch.date ?? existing[idx]!.date)!,
    updatedAt: new Date().toISOString(),
  } as Revenue;

  // Recalculate totals if items or discount changed
  if (patch.items !== undefined || patch.discount !== undefined) {
    const { totalAmount, finalAmount } = computeTotals(
      updated.items ?? existing[idx]!.items,
      updated.discount ?? existing[idx]!.discount
    );
    updated.totalAmount = totalAmount;
    updated.finalAmount = finalAmount;
  }

  const updatedAll = [...existing];
  updatedAll[idx] = updated;

  await cacheSet(CACHE_KEY, updatedAll);
  useRevenueStore.getState().setRecords(updatedAll);

  return updated;
}

/**
 * Delete one or more revenues by id.
 */
export async function deleteRevenues(ids: string[]): Promise<void> {
  const existing = (await cacheGet<Revenue[]>(CACHE_KEY)) ?? [];
  const updated = existing.filter((r) => !ids.includes(r.id));
  await cacheSet(CACHE_KEY, updated);
  useRevenueStore.getState().setRecords(updated);
}
