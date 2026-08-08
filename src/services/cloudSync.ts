/**
 * Cloud sync orchestration — hydrate stores from Supabase and dual-write helpers.
 */

import {
  useCustomerStore,
  useExpenseStore,
  usePlatformStore,
  useProductStore,
  useRevenueStore,
  useAuthStore,
} from '@/store';
import { cacheSet } from './cacheManager';
import { getMyHousehold, type HouseholdInfo } from './householdService';
import {
  deleteCustomerRemote,
  deleteExpenseRemote,
  deletePlatformRemote,
  deleteProductRemote,
  deleteRevenueRemote,
  loadLedger,
  pushFullLedger,
  upsertCustomer,
  upsertExpense,
  upsertPlatform,
  upsertProduct,
  upsertRevenue,
} from './ledgerRepository';
import { isSupabaseConfigured } from './supabaseClient';
import type { Customer, Expense, OrderPlatform, Product, Revenue } from '@/models';

export function getActiveHouseholdId(): string | null {
  return useAuthStore.getState().householdId;
}

export function isCloudSyncActive(): boolean {
  return Boolean(isSupabaseConfigured() && getActiveHouseholdId());
}

async function safeCloud(run: () => Promise<void>): Promise<void> {
  if (!isCloudSyncActive()) return;
  try {
    await run();
  } catch (err) {
    console.error('[cloudSync]', err);
    throw err;
  }
}

export async function refreshHouseholdFromCloud(): Promise<HouseholdInfo | null> {
  if (!isSupabaseConfigured()) {
    useAuthStore.getState().setHousehold(null);
    return null;
  }
  try {
    const info = await getMyHousehold();
    useAuthStore.getState().setHousehold(info);
    return info;
  } catch (err) {
    console.error('[cloudSync] getMyHousehold failed', err);
    useAuthStore.getState().setHousehold(null);
    return null;
  }
}

export async function hydrateStoresFromCloud(householdId: string): Promise<void> {
  const snap = await loadLedger(householdId);
  useExpenseStore.getState().setRecords(snap.expenses);
  useRevenueStore.getState().setRecords(snap.revenues);
  useCustomerStore.getState().setCustomers(snap.customers);
  useProductStore.getState().setProducts(snap.products);
  usePlatformStore.getState().setPlatforms(snap.platforms);

  await Promise.all([
    cacheSet('expenses', snap.expenses),
    cacheSet('revenues', snap.revenues),
    cacheSet('customers', snap.customers),
    cacheSet('products', snap.products),
    cacheSet('orderPlatforms', snap.platforms),
  ]);
}

export async function migrateLocalCacheToCloud(householdId: string): Promise<void> {
  const snapshot = {
    expenses: useExpenseStore.getState().records,
    revenues: useRevenueStore.getState().records,
    customers: useCustomerStore.getState().customers,
    products: useProductStore.getState().products,
    platforms: usePlatformStore.getState().platforms,
  };
  await pushFullLedger(householdId, snapshot);
}

export async function cloudUpsertExpense(expense: Expense): Promise<void> {
  const hid = getActiveHouseholdId();
  if (!hid) return;
  await safeCloud(() => upsertExpense(hid, expense));
}

export async function cloudDeleteExpense(id: string): Promise<void> {
  const hid = getActiveHouseholdId();
  if (!hid) return;
  await safeCloud(() => deleteExpenseRemote(hid, id));
}

export async function cloudUpsertCustomer(customer: Customer): Promise<void> {
  const hid = getActiveHouseholdId();
  if (!hid) return;
  await safeCloud(() => upsertCustomer(hid, customer));
}

export async function cloudDeleteCustomer(id: string): Promise<void> {
  const hid = getActiveHouseholdId();
  if (!hid) return;
  await safeCloud(() => deleteCustomerRemote(hid, id));
}

export async function cloudUpsertProduct(product: Product): Promise<void> {
  const hid = getActiveHouseholdId();
  if (!hid) return;
  await safeCloud(() => upsertProduct(hid, product));
}

export async function cloudDeleteProduct(id: string): Promise<void> {
  const hid = getActiveHouseholdId();
  if (!hid) return;
  await safeCloud(() => deleteProductRemote(hid, id));
}

export async function cloudUpsertPlatform(platform: OrderPlatform): Promise<void> {
  const hid = getActiveHouseholdId();
  if (!hid) return;
  await safeCloud(() => upsertPlatform(hid, platform));
}

export async function cloudDeletePlatform(id: string): Promise<void> {
  const hid = getActiveHouseholdId();
  if (!hid) return;
  await safeCloud(() => deletePlatformRemote(hid, id));
}

export async function cloudUpsertRevenue(revenue: Revenue): Promise<void> {
  const hid = getActiveHouseholdId();
  if (!hid) return;
  await safeCloud(() => upsertRevenue(hid, revenue));
}

export async function cloudDeleteRevenue(id: string): Promise<void> {
  const hid = getActiveHouseholdId();
  if (!hid) return;
  await safeCloud(() => deleteRevenueRemote(hid, id));
}
