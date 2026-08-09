/**
 * Hybrid paged list queries — Supabase `.range` when cloud household is active,
 * IndexedDB filter/sort/slice fallback otherwise (or on cloud failure).
 */

import type {
  Customer,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  OrderPlatform,
  OrderStatus,
  PaymentStatus,
  Product,
  Revenue,
} from '@/models';
import { toast } from 'sonner';
import {
  useCustomerStore,
  useExpenseStore,
  usePlatformStore,
  useProductStore,
  useRevenueStore,
} from '@/store';
import { cacheGet } from './cacheManager';
import { getActiveHouseholdId, isCloudSyncActive } from './cloudSync';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import {
  mapCustomer,
  mapExpense,
  mapPlatform,
  mapProduct,
  mapRevenue,
  type CustomerRow,
  type ExpenseRow,
  type PlatformRow,
  type ProductRow,
  type RevenueItemRow,
  type RevenueRow,
} from './supabaseMappers';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

export interface ListPageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  source: 'cloud' | 'local';
}

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface ExpenseListFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
}

export interface RevenueListFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  customerId?: string;
  priorityOnly?: boolean;
}

export interface SearchListFilters {
  search?: string;
}

export type ListEntity = 'expenses' | 'revenues' | 'products' | 'customers' | 'platforms';

const INVALIDATE_EVENT = 'ledger-list-invalidate';

let cloudFallbackToastAt = 0;

function toastCloudFallbackOnce(message: string): void {
  const now = Date.now();
  if (now - cloudFallbackToastAt < 8_000) return;
  cloudFallbackToastAt = now;
  toast.message(message);
}

export function notifyListInvalidated(entity?: ListEntity | 'all'): void {
  window.dispatchEvent(
    new CustomEvent(INVALIDATE_EVENT, { detail: { entity: entity ?? 'all' } }),
  );
}

export function onListInvalidated(
  handler: (entity: ListEntity | 'all') => void,
): () => void {
  const listener = (ev: Event) => {
    const detail = (ev as CustomEvent<{ entity?: ListEntity | 'all' }>).detail;
    handler(detail?.entity ?? 'all');
  };
  window.addEventListener(INVALIDATE_EVENT, listener);
  return () => window.removeEventListener(INVALIDATE_EVENT, listener);
}

function clampPage(page: number, pageSize: number, total: number): number {
  const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
  return Math.min(Math.max(1, page), maxPage);
}

function slicePage<T>(items: T[], page: number, pageSize: number): ListPageResult<T> {
  const total = items.length;
  const safePage = clampPage(page, pageSize, total);
  const from = (safePage - 1) * pageSize;
  return {
    items: items.slice(from, from + pageSize),
    total,
    page: safePage,
    pageSize,
    source: 'local',
  };
}

function rangeBounds(page: number, pageSize: number): { from: number; to: number } {
  const from = Math.max(0, (page - 1) * pageSize);
  return { from, to: from + pageSize - 1 };
}

function escapeIlike(value: string): string {
  return value.replace(/[%_,.\\()"]/g, '').trim();
}

function ilikeOr(columns: string[], raw: string): string {
  const pat = `%${escapeIlike(raw)}%`;
  // Quote so spaces / special chars are valid in PostgREST `.or()`
  return columns.map((c) => `${c}.ilike."${pat}"`).join(',');
}

/* ── Local filters ───────────────────────────────────────────────────────── */

function filterExpensesLocal(records: Expense[], filters: ExpenseListFilters): Expense[] {
  let result = [...records];
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        (r.supplier?.toLowerCase().includes(q) ?? false) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  if (filters.dateFrom) result = result.filter((r) => r.date >= filters.dateFrom!);
  if (filters.dateTo) result = result.filter((r) => r.date <= filters.dateTo!);
  if (filters.category) result = result.filter((r) => r.category === filters.category);
  if (filters.status) result = result.filter((r) => r.status === filters.status);
  result.sort((a, b) => b.date.localeCompare(a.date));
  return result;
}

function filterRevenuesLocal(records: Revenue[], filters: RevenueListFilters): Revenue[] {
  let result = [...records];
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (x) =>
        x.orderCode.toLowerCase().includes(q) ||
        (x.notes?.toLowerCase().includes(q) ?? false),
    );
  }
  if (filters.dateFrom) result = result.filter((x) => x.date >= filters.dateFrom!);
  if (filters.dateTo) result = result.filter((x) => x.date <= filters.dateTo!);
  if (filters.orderStatus) result = result.filter((x) => x.orderStatus === filters.orderStatus);
  if (filters.paymentStatus) {
    result = result.filter((x) => x.paymentStatus === filters.paymentStatus);
  }
  if (filters.customerId) result = result.filter((x) => x.customerId === filters.customerId);
  if (filters.priorityOnly) result = result.filter((x) => x.priority === true);
  result.sort((a, b) => {
    const pa = a.priority ? 1 : 0;
    const pb = b.priority ? 1 : 0;
    if (pa !== pb) return pb - pa;
    if (pa && pb) {
      const at = a.priorityAt ?? '';
      const bt = b.priorityAt ?? '';
      if (at !== bt) return bt.localeCompare(at);
    }
    return b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt);
  });
  return result;
}

function filterProductsLocal(records: Product[], filters: SearchListFilters): Product[] {
  let list = [...records];
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false) ||
        (p.notes?.toLowerCase().includes(q) ?? false),
    );
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return list;
}

function filterCustomersLocal(records: Customer[], filters: SearchListFilters): Customer[] {
  let list = [...records];
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    );
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return list;
}

function filterPlatformsLocal(records: OrderPlatform[], filters: SearchListFilters): OrderPlatform[] {
  let list = [...records];
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code?.toLowerCase().includes(q) ?? false),
    );
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return list;
}

/* ── Cloud queries ───────────────────────────────────────────────────────── */

async function queryExpensesCloud(
  householdId: string,
  params: PageParams,
  filters: ExpenseListFilters,
): Promise<ListPageResult<Expense>> {
  const sb = getSupabase();
  const { from, to } = rangeBounds(params.page, params.pageSize);
  let q = sb
    .from('expenses')
    .select('*', { count: 'exact' })
    .eq('household_id', householdId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  const search = filters.search?.trim();
  if (search && escapeIlike(search)) {
    q = q.or(ilikeOr(['description', 'supplier'], search));
  }
  if (filters.dateFrom) q = q.gte('date', filters.dateFrom);
  if (filters.dateTo) q = q.lte('date', filters.dateTo);
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.status) q = q.eq('status', filters.status);

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  const items = ((data ?? []) as ExpenseRow[]).map(mapExpense);
  return {
    items,
    total: count ?? items.length,
    page: params.page,
    pageSize: params.pageSize,
    source: 'cloud',
  };
}

async function queryRevenuesCloud(
  householdId: string,
  params: PageParams,
  filters: RevenueListFilters,
): Promise<ListPageResult<Revenue>> {
  const sb = getSupabase();
  const { from, to } = rangeBounds(params.page, params.pageSize);
  let q = sb
    .from('revenues')
    .select('*', { count: 'exact' })
    .eq('household_id', householdId)
    .order('priority', { ascending: false })
    .order('priority_at', { ascending: false, nullsFirst: false })
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  const search = filters.search?.trim();
  if (search && escapeIlike(search)) {
    q = q.or(ilikeOr(['order_code', 'notes'], search));
  }
  if (filters.dateFrom) q = q.gte('date', filters.dateFrom);
  if (filters.dateTo) q = q.lte('date', filters.dateTo);
  if (filters.orderStatus) q = q.eq('order_status', filters.orderStatus);
  if (filters.paymentStatus) q = q.eq('payment_status', filters.paymentStatus);
  if (filters.customerId) q = q.eq('customer_id', filters.customerId);
  if (filters.priorityOnly) q = q.eq('priority', true);

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RevenueRow[];
  const ids = rows.map((r) => r.id);
  const itemsByRevenue = new Map<string, RevenueItemRow[]>();
  if (ids.length > 0) {
    const itemsRes = await sb
      .from('revenue_items')
      .select('*')
      .eq('household_id', householdId)
      .in('revenue_id', ids);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    for (const item of (itemsRes.data ?? []) as RevenueItemRow[]) {
      const list = itemsByRevenue.get(item.revenue_id) ?? [];
      list.push(item);
      itemsByRevenue.set(item.revenue_id, list);
    }
  }

  const items = rows.map((row) => mapRevenue(row, itemsByRevenue.get(row.id) ?? []));
  return {
    items,
    total: count ?? items.length,
    page: params.page,
    pageSize: params.pageSize,
    source: 'cloud',
  };
}

async function queryProductsCloud(
  householdId: string,
  params: PageParams,
  filters: SearchListFilters,
): Promise<ListPageResult<Product>> {
  const sb = getSupabase();
  const { from, to } = rangeBounds(params.page, params.pageSize);
  let q = sb
    .from('products')
    .select('*', { count: 'exact' })
    .eq('household_id', householdId)
    .order('name', { ascending: true });

  const search = filters.search?.trim();
  if (search && escapeIlike(search)) {
    q = q.or(ilikeOr(['name', 'sku', 'notes'], search));
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  const items = ((data ?? []) as ProductRow[]).map(mapProduct);
  return {
    items,
    total: count ?? items.length,
    page: params.page,
    pageSize: params.pageSize,
    source: 'cloud',
  };
}

async function queryCustomersCloud(
  householdId: string,
  params: PageParams,
  filters: SearchListFilters,
): Promise<ListPageResult<Customer>> {
  const sb = getSupabase();
  const { from, to } = rangeBounds(params.page, params.pageSize);
  let q = sb
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('household_id', householdId)
    .order('name', { ascending: true });

  const search = filters.search?.trim();
  if (search && escapeIlike(search)) {
    q = q.or(ilikeOr(['name', 'phone', 'email'], search));
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  const items = ((data ?? []) as CustomerRow[]).map(mapCustomer);
  return {
    items,
    total: count ?? items.length,
    page: params.page,
    pageSize: params.pageSize,
    source: 'cloud',
  };
}

async function queryPlatformsCloud(
  householdId: string,
  params: PageParams,
  filters: SearchListFilters,
): Promise<ListPageResult<OrderPlatform>> {
  const sb = getSupabase();
  const { from, to } = rangeBounds(params.page, params.pageSize);
  let q = sb
    .from('order_platforms')
    .select('*', { count: 'exact' })
    .eq('household_id', householdId)
    .order('name', { ascending: true });

  const search = filters.search?.trim();
  if (search && escapeIlike(search)) {
    q = q.or(ilikeOr(['name', 'code'], search));
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  const items = ((data ?? []) as PlatformRow[]).map(mapPlatform);
  return {
    items,
    total: count ?? items.length,
    page: params.page,
    pageSize: params.pageSize,
    source: 'cloud',
  };
}

/* ── Public API ──────────────────────────────────────────────────────────── */

async function withHybrid<T>(
  entity: ListEntity,
  cloud: (householdId: string) => Promise<ListPageResult<T>>,
  local: () => Promise<ListPageResult<T>>,
): Promise<ListPageResult<T>> {
  const householdId = getActiveHouseholdId();
  if (isCloudSyncActive() && householdId && isSupabaseConfigured() && navigator.onLine) {
    try {
      return await cloud(householdId);
    } catch (err) {
      console.warn(`[listQuery] cloud ${entity} failed, falling back to local:`, err);
      toastCloudFallbackOnce('Không tải được từ sổ chung — đang dùng dữ liệu local');
      return local();
    }
  }
  return local();
}

export async function queryExpensesPage(
  params: PageParams,
  filters: ExpenseListFilters = {},
): Promise<ListPageResult<Expense>> {
  return withHybrid(
    'expenses',
    (hid) => queryExpensesCloud(hid, params, filters),
    async () => {
      const cached = (await cacheGet<Expense[]>('expenses')) ?? [];
      const all = cached.length > 0 ? cached : useExpenseStore.getState().records;
      return slicePage(filterExpensesLocal(all, filters), params.page, params.pageSize);
    },
  );
}

export async function queryRevenuesPage(
  params: PageParams,
  filters: RevenueListFilters = {},
): Promise<ListPageResult<Revenue>> {
  return withHybrid(
    'revenues',
    (hid) => queryRevenuesCloud(hid, params, filters),
    async () => {
      const cached = (await cacheGet<Revenue[]>('revenues')) ?? [];
      const all = cached.length > 0 ? cached : useRevenueStore.getState().records;
      return slicePage(filterRevenuesLocal(all, filters), params.page, params.pageSize);
    },
  );
}

export async function queryProductsPage(
  params: PageParams,
  filters: SearchListFilters = {},
): Promise<ListPageResult<Product>> {
  return withHybrid(
    'products',
    (hid) => queryProductsCloud(hid, params, filters),
    async () => {
      const cached = (await cacheGet<Product[]>('products')) ?? [];
      const all = cached.length > 0 ? cached : useProductStore.getState().products;
      return slicePage(filterProductsLocal(all, filters), params.page, params.pageSize);
    },
  );
}

export async function queryCustomersPage(
  params: PageParams,
  filters: SearchListFilters = {},
): Promise<ListPageResult<Customer>> {
  return withHybrid(
    'customers',
    (hid) => queryCustomersCloud(hid, params, filters),
    async () => {
      const cached = (await cacheGet<Customer[]>('customers')) ?? [];
      const all = cached.length > 0 ? cached : useCustomerStore.getState().customers;
      return slicePage(filterCustomersLocal(all, filters), params.page, params.pageSize);
    },
  );
}

export async function queryPlatformsPage(
  params: PageParams,
  filters: SearchListFilters = {},
): Promise<ListPageResult<OrderPlatform>> {
  return withHybrid(
    'platforms',
    (hid) => queryPlatformsCloud(hid, params, filters),
    async () => {
      const cached = (await cacheGet<OrderPlatform[]>('orderPlatforms')) ?? [];
      const all = cached.length > 0 ? cached : usePlatformStore.getState().platforms;
      return slicePage(filterPlatformsLocal(all, filters), params.page, params.pageSize);
    },
  );
}
