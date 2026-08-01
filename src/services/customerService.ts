/**
 * Customer CRUD service — IndexedDB cache + Zustand store sync.
 *
 * Usage:
 *   import { getAllCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/services/customerService';
 */

import type { Customer } from '@/models';
import { useCustomerStore } from '@/store';
import { cacheGet, cacheSet } from './cacheManager';

const CACHE_KEY = 'customers';

/**
 * Load all customers from IndexedDB cache, fall back to empty array.
 * Syncs into the Zustand store after loading.
 */
export async function getAllCustomers(): Promise<Customer[]> {
  const records = await cacheGet<Customer[]>(CACHE_KEY);
  const store = useCustomerStore.getState();
  if (records) { store.setCustomers(records); } else { store.setCustomers([]); }
  return records ?? [];
}

/**
 * Create a new customer record.
 * Auto-generates `id` and `createdAt`.
 *
 * Validation rules:
 * - name must be 2–100 characters
 * - phone must match: ^(0|\+84)[0-9]{9,10}$
 * - email (if provided) must be a valid email format
 * - address (if provided) must be 5–200 characters
 */
export async function createCustomer(
  data: Omit<Customer, 'id' | 'createdAt'>,
): Promise<Customer> {
  // --- manual validation ---
  if (typeof data.name !== 'string' || data.name.length < 2 || data.name.length > 100) {
    throw new Error('name must be 2–100 characters');
  }
  const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
  if (!phoneRegex.test(data.phone)) {
    throw new Error('phone must match ^(0|\\+84)[0-9]{9,10}$');
  }
  if (data.email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('email must be a valid email address');
    }
  }
  if (data.address !== undefined && (data.address.length < 5 || data.address.length > 200)) {
    throw new Error('address must be 5–200 characters');
  }

  const record: Customer = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  const existing = (await cacheGet<Customer[]>(CACHE_KEY)) ?? [];
  const updated = [...existing, record];
  await cacheSet(CACHE_KEY, updated);
  useCustomerStore.getState().setCustomers(updated);

  return record;
}

/**
 * Update an existing customer by id.
 * Validates fields present in the patch.
 */
export async function updateCustomer(
  id: string,
  patch: Partial<Omit<Customer, 'id' | 'createdAt'>>,
): Promise<Customer | undefined> {
  const existing = (await cacheGet<Customer[]>(CACHE_KEY)) ?? [];
  const idx = existing.findIndex((c) => c.id === id);
  if (idx === -1) {
    return undefined;
  }

  // Validate patched fields
  if (patch.name !== undefined) {
    if (typeof patch.name !== 'string' || patch.name.length < 2 || patch.name.length > 100) {
      throw new Error('name must be 2–100 characters');
    }
  }
  if (patch.phone !== undefined) {
    const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
    if (!phoneRegex.test(patch.phone)) {
      throw new Error('phone must match ^(0|\\+84)[0-9]{9,10}$');
    }
  }
  if (patch.email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(patch.email)) {
      throw new Error('email must be a valid email address');
    }
  }
  if (patch.address !== undefined && (patch.address.length < 5 || patch.address.length > 200)) {
    throw new Error('address must be 5–200 characters');
  }

  const current = existing[idx]!;
  const updated: Customer = { ...current, ...patch };
  const updatedAll = [...existing];
  updatedAll[idx] = updated;

  await cacheSet(CACHE_KEY, updatedAll);
  useCustomerStore.setState({ customers: updatedAll });

  return updated;
}

/**
 * Delete a single customer by id.
 */
export async function deleteCustomer(id: string): Promise<void> {
  const existing = (await cacheGet<Customer[]>(CACHE_KEY)) ?? [];
  const updated = existing.filter((c) => c.id !== id);
  await cacheSet(CACHE_KEY, updated);
  useCustomerStore.getState().setCustomers(updated);
}
