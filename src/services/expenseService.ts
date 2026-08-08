/**
 * Expense CRUD service — IndexedDB cache (via cacheManager) + Zustand store sync.
 *
 * Each function: validates inputs (manual validation), reads/writes to cache
 * under the key 'expenses', and updates the Zustand store.
 *
 * Usage:
 *   import { getAllExpenses, createExpense, updateExpense, deleteExpenses } from '@/services/expenseService';
 */

import type { Expense } from '@/models';
import { useExpenseStore } from '@/store';
import { notify, type NotifyOpts } from '@/utils/notify';
import { cacheGet, cacheSet } from './cacheManager';
import {
  applyExpenseStockIn,
  expenseHasStockIn,
  reverseExpenseStockIn,
} from './stockService';

const CACHE_KEY = 'expenses';
const STOCK_TAG = 'nhap-hang';

/**
 * Load all expenses from IndexedDB cache, fall back to empty array.
 * Syncs into the Zustand store after loading.
 */
export async function getAllExpenses(): Promise<Expense[]> {
  const records = await cacheGet<Expense[]>(CACHE_KEY);
  const store = useExpenseStore.getState();
  if (records) {
    store.setRecords(records);
  } else {
    store.setRecords([]);
  }
  return records ?? [];
}

/**
 * Create a new expense record, persist to cache, and sync the store.
 *
 * Validation rules:
 * - amount must be a non-negative number
 * - description must be 5–500 characters
 * - date must be a valid ISO date string (yyyy-MM-dd)
 * - tags must be a string array (max 10 items, each 2–30 characters)
 */
export async function createExpense(
  data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
  opts?: NotifyOpts,
): Promise<Expense> {
  // --- manual validation ---
  if (typeof data.amount !== 'number' || data.amount < 0) {
    throw new Error('amount must be a non-negative number');
  }
  if (
    typeof data.description !== 'string' ||
    data.description.length < 2 ||
    data.description.length > 500
  ) {
    throw new Error('description must be 2–500 characters');
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof data.date !== 'string' || !dateRegex.test(data.date)) {
    throw new Error('date must be an ISO date string (yyyy-MM-dd)');
  }
  if (
    !Array.isArray(data.tags) ||
    data.tags.length > 10 ||
    data.tags.some((t) => typeof t !== 'string' || t.length < 2 || t.length > 30)
  ) {
    throw new Error('tags must be a string array (max 10 items, each 2–30 characters)');
  }

  const now = new Date().toISOString();
  let tags = [...data.tags];
  const stockQtyIn =
    data.stockQtyIn != null && data.stockQtyIn > 0 ? Math.round(data.stockQtyIn) : undefined;
  const stockProductId = data.stockProductId?.trim() || undefined;
  if (stockProductId && stockQtyIn && !tags.includes(STOCK_TAG)) {
    tags = [...tags, STOCK_TAG].slice(0, 10);
  }

  let record: Expense = {
    ...data,
    tags,
    stockProductId,
    stockQtyIn,
    stockApplied: false,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  if (expenseHasStockIn(record) && record.status !== 'cancelled') {
    record = await applyExpenseStockIn(record, { silent: true });
  }

  // Append to cache, re-store, and sync
  const existing = (await cacheGet<Expense[]>(CACHE_KEY)) ?? [];
  const updated = [record, ...existing];
  await cacheSet(CACHE_KEY, updated);
  useExpenseStore.getState().setRecords(updated);

  void import('./cloudSync')
    .then((m) => m.cloudUpsertExpense(record))
    .catch((err) => console.error('[cloud] expense create', err));

  const stockNote =
    record.stockApplied && record.stockQtyIn
      ? ` (+${record.stockQtyIn} tồn)`
      : '';
  notify.success(`Đã thêm chi phí: ${record.description}${stockNote}`, opts);
  return record;
}

/**
 * Update an existing expense by id.
 * Applies a patch (partial fields). Validates before persisting.
 */
export async function updateExpense(
  id: string,
  patch: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>,
  opts?: NotifyOpts,
): Promise<Expense | undefined> {
  const existing = (await cacheGet<Expense[]>(CACHE_KEY)) ?? [];
  const idx = existing.findIndex((r) => r.id === id);
  if (idx === -1) {
    notify.error('Không tìm thấy chi phí để cập nhật', opts);
    return undefined;
  }

  // Validate patched fields if present
  if (patch.amount !== undefined && (typeof patch.amount !== 'number' || patch.amount < 0)) {
    throw new Error('amount must be a non-negative number');
  }
  if (
    patch.description !== undefined &&
    (patch.description.length < 2 || patch.description.length > 500)
  ) {
    throw new Error('description must be 5–500 characters');
  }
  if (patch.date !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof patch.date !== 'string' || !dateRegex.test(patch.date)) {
      throw new Error('date must be an ISO date string (yyyy-MM-dd)');
    }
  }
  if (patch.tags !== undefined) {
    if (
      !Array.isArray(patch.tags) ||
      patch.tags.length > 10 ||
      patch.tags.some((t) => typeof t !== 'string' || t.length < 2 || t.length > 30)
    ) {
      throw new Error('tags must be a string array (max 10 items, each 2–30 characters)');
    }
  }

  const current = existing[idx]!;
  // Stock qty/product are immutable after create (edit SL does not adjust tồn).
  let updated: Expense = {
    ...current,
    ...patch,
    stockProductId: current.stockProductId,
    stockQtyIn: current.stockQtyIn,
    stockApplied: current.stockApplied,
    updatedAt: new Date().toISOString(),
  };

  const becameCancelled =
    current.status !== 'cancelled' && updated.status === 'cancelled';
  const leftCancelled =
    current.status === 'cancelled' && updated.status !== 'cancelled';

  if (becameCancelled) {
    updated = await reverseExpenseStockIn(updated, { silent: true });
  } else if (leftCancelled) {
    updated = await applyExpenseStockIn(updated, { silent: true });
  }

  const updatedAll = [...existing];
  updatedAll[idx] = updated;

  await cacheSet(CACHE_KEY, updatedAll);
  useExpenseStore.getState().setRecords(updatedAll);

  void import('./cloudSync')
    .then((m) => m.cloudUpsertExpense(updated))
    .catch((err) => console.error('[cloud] expense update', err));

  notify.success(`Đã cập nhật chi phí: ${updated.description}`, opts);
  return updated;
}

/**
 * Delete one or more expenses by id.
 */
export async function deleteExpenses(ids: string[], opts?: NotifyOpts): Promise<void> {
  const existing = (await cacheGet<Expense[]>(CACHE_KEY)) ?? [];
  const toDelete = existing.filter((r) => ids.includes(r.id));
  for (const exp of toDelete) {
    if (exp.stockApplied) {
      await reverseExpenseStockIn(exp, { silent: true });
    }
  }
  const updated = existing.filter((r) => !ids.includes(r.id));
  await cacheSet(CACHE_KEY, updated);
  useExpenseStore.getState().setRecords(updated);
  void import('./cloudSync')
    .then(async (m) => {
      for (const id of ids) await m.cloudDeleteExpense(id);
    })
    .catch((err) => console.error('[cloud] expense delete', err));
  const n = ids.length;
  notify.success(n > 1 ? `Đã xóa ${n} chi phí` : 'Đã xóa chi phí', opts);
}
