/**
 * Customer CRUD service — IndexedDB cache + Zustand store sync.
 */

import type { Customer } from '@/models';
import { useCustomerStore } from '@/store';
import { useRevenueStore } from '@/store/revenueStore';
import { notify, type NotifyOpts } from '@/utils/notify';
import { cacheGet, cacheSet } from './cacheManager';

const CACHE_KEY = 'customers';
const PHONE_REGEX = /^(0|\+84)[0-9]{9,10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeOptional(value?: string): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

function assertName(name: string): void {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    throw new Error('Họ tên phải từ 2–100 ký tự');
  }
}

function assertPhone(phone: string): void {
  if (!phone) return;
  if (!PHONE_REGEX.test(phone)) {
    throw new Error('SĐT phải dạng 0xxxxxxxxx hoặc +84xxxxxxxxx');
  }
}

function assertEmail(email: string | undefined): void {
  if (email === undefined) return;
  if (!EMAIL_REGEX.test(email)) {
    throw new Error('Email không hợp lệ');
  }
}

function assertAddress(address: string | undefined): void {
  if (address === undefined) return;
  if (address.length < 5 || address.length > 200) {
    throw new Error('Địa chỉ phải từ 5–200 ký tự');
  }
}

export async function getAllCustomers(): Promise<Customer[]> {
  const records = await cacheGet<Customer[]>(CACHE_KEY);
  const store = useCustomerStore.getState();
  if (records) {
    store.setCustomers(records);
  } else {
    store.setCustomers([]);
  }
  return records ?? [];
}

export async function createCustomer(
  data: Omit<Customer, 'id' | 'createdAt'>,
  opts?: NotifyOpts,
): Promise<Customer> {
  const name = data.name.trim();
  assertName(name);
  const phone = (data.phone ?? '').trim();
  assertPhone(phone);
  const email = normalizeOptional(data.email);
  const address = normalizeOptional(data.address);
  assertEmail(email);
  assertAddress(address);

  const record: Customer = {
    id: crypto.randomUUID(),
    name,
    phone,
    email,
    address,
    createdAt: new Date().toISOString(),
  };

  const existing = (await cacheGet<Customer[]>(CACHE_KEY)) ?? [];
  const updated = [...existing, record];
  await cacheSet(CACHE_KEY, updated);
  useCustomerStore.getState().setCustomers(updated);

  void import('./cloudSync')
    .then((m) => m.cloudUpsertCustomer(record))
    .catch((err) => console.error('[cloud] customer create', err));

  notify.success(`Đã thêm khách: ${record.name}`, opts);
  return record;
}

/**
 * Find by name (case-insensitive) or create with optional phone.
 * Used by AI / intake when creating orders for new customers.
 */
export async function findOrCreateCustomerByName(
  name: string,
  opts?: NotifyOpts & { phone?: string },
): Promise<Customer> {
  const trimmed = name.trim();
  assertName(trimmed);

  const existing = useCustomerStore.getState().customers.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;

  const cached = (await cacheGet<Customer[]>(CACHE_KEY)) ?? [];
  const fromCache = cached.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (fromCache) {
    useCustomerStore.getState().setCustomers(cached);
    return fromCache;
  }

  return createCustomer(
    {
      name: trimmed,
      phone: (opts?.phone ?? '').trim(),
    },
    opts,
  );
}

export async function updateCustomer(
  id: string,
  patch: Partial<Omit<Customer, 'id' | 'createdAt'>>,
  opts?: NotifyOpts,
): Promise<Customer | undefined> {
  const existing = (await cacheGet<Customer[]>(CACHE_KEY)) ?? [];
  const idx = existing.findIndex((c) => c.id === id);
  if (idx === -1) {
    notify.error('Không tìm thấy khách hàng để cập nhật', opts);
    return undefined;
  }

  if (patch.name !== undefined) assertName(patch.name);
  if (patch.phone !== undefined) assertPhone(patch.phone.trim());
  if (patch.email !== undefined) {
    const email = normalizeOptional(patch.email);
    assertEmail(email);
    patch = { ...patch, email };
  }
  if (patch.address !== undefined) {
    const address = normalizeOptional(patch.address);
    assertAddress(address);
    patch = { ...patch, address };
  }

  const current = existing[idx]!;
  const updated: Customer = {
    ...current,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : current.name,
    phone: patch.phone !== undefined ? patch.phone.trim() : current.phone,
  };
  const updatedAll = [...existing];
  updatedAll[idx] = updated;

  await cacheSet(CACHE_KEY, updatedAll);
  useCustomerStore.getState().setCustomers(updatedAll);

  void import('./cloudSync')
    .then((m) => m.cloudUpsertCustomer(updated))
    .catch((err) => console.error('[cloud] customer update', err));

  notify.success(`Đã cập nhật khách: ${updated.name}`, opts);
  return updated;
}

/**
 * Delete customer by id. Blocked when any order references the customer.
 */
export async function deleteCustomer(id: string, opts?: NotifyOpts): Promise<void> {
  const revenues = useRevenueStore.getState().records;
  if (revenues.some((r) => r.customerId === id)) {
    notify.error('Không thể xóa khách còn đơn hàng', opts);
    throw new Error('Không thể xóa khách còn đơn hàng');
  }

  const existing = (await cacheGet<Customer[]>(CACHE_KEY)) ?? [];
  const updated = existing.filter((c) => c.id !== id);
  await cacheSet(CACHE_KEY, updated);
  useCustomerStore.getState().setCustomers(updated);
  void import('./cloudSync')
    .then((m) => m.cloudDeleteCustomer(id))
    .catch((err) => console.error('[cloud] customer delete', err));
  notify.success('Đã xóa khách hàng', opts);
}
