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
import { cacheGet, cacheSet } from './cacheManager';

const CACHE_KEY = 'expenses';

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
): Promise<Expense> {
  // --- manual validation ---
  if (typeof data.amount !== 'number' || data.amount < 0) {
    throw new Error('amount must be a non-negative number');
  }
  if (
    typeof data.description !== 'string' ||
    data.description.length < 5 ||
    data.description.length > 500
  ) {
    throw new Error('description must be 5–500 characters');
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
  const record: Expense = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  // Append to cache, re-store, and sync
  const existing = (await cacheGet<Expense[]>(CACHE_KEY)) ?? [];
  const updated = [record, ...existing];
  await cacheSet(CACHE_KEY, updated);
  useExpenseStore.getState().setRecords(updated);

  return record;
}

/**
 * Update an existing expense by id.
 * Applies a patch (partial fields). Validates before persisting.
 */
export async function updateExpense(
  id: string,
  patch: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Expense | undefined> {
  const existing = (await cacheGet<Expense[]>(CACHE_KEY)) ?? [];
  const idx = existing.findIndex((r) => r.id === id);
  if (idx === -1) {
    return undefined;
  }

  // Validate patched fields if present
  if (patch.amount !== undefined && (typeof patch.amount !== 'number' || patch.amount < 0)) {
    throw new Error('amount must be a non-negative number');
  }
  if (
    patch.description !== undefined &&
    (patch.description.length < 5 || patch.description.length > 500)
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
  const updated: Expense = { ...current, ...patch, updatedAt: new Date().toISOString() };
  const updatedAll = [...existing];
  updatedAll[idx] = updated;

  await cacheSet(CACHE_KEY, updatedAll);
  useExpenseStore.getState().setRecords(updatedAll);

  return updated;
}

/**
 * Delete one or more expenses by id.
 */
export async function deleteExpenses(ids: string[]): Promise<void> {
  const existing = (await cacheGet<Expense[]>(CACHE_KEY)) ?? [];
  const updated = existing.filter((r) => !ids.includes(r.id));
  await cacheSet(CACHE_KEY, updated);
  useExpenseStore.getState().setRecords(updated);
}
