/**
 * Household-scoped ledger CRUD against Supabase tables / RPCs.
 */

import type { Customer, Expense, OrderPlatform, Product, Revenue } from '@/models';
import { getSupabase } from './supabaseClient';
import {
  customerToRow,
  expenseToRow,
  mapCustomer,
  mapExpense,
  mapPlatform,
  mapProduct,
  mapRevenue,
  platformToRow,
  productToRow,
  revenueToUpsertPayload,
  type CustomerRow,
  type ExpenseRow,
  type PlatformRow,
  type ProductRow,
  type RevenueItemRow,
  type RevenueRow,
} from './supabaseMappers';

/** Replaces local sentinel `walk-in` (Postgres `customer_id` is uuid FK). */
export { WALK_IN_CUSTOMER_ID } from './walkIn';
import { WALK_IN_CUSTOMER_ID } from './walkIn';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LedgerSnapshot {
  expenses: Expense[];
  revenues: Revenue[];
  customers: Customer[];
  products: Product[];
  platforms: OrderPlatform[];
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const PAGE = 1000;

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE - 1;
    const { data, error } = await fetchPage(from, to);
    throwIfError(error);
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export async function loadLedger(householdId: string): Promise<LedgerSnapshot> {
  const sb = getSupabase();

  const [expenses, customers, products, platforms, revenues, items] = await Promise.all([
    fetchAllRows<ExpenseRow>((from, to) =>
      sb
        .from('expenses')
        .select('*')
        .eq('household_id', householdId)
        .order('date', { ascending: false })
        .range(from, to),
    ),
    fetchAllRows<CustomerRow>((from, to) =>
      sb.from('customers').select('*').eq('household_id', householdId).range(from, to),
    ),
    fetchAllRows<ProductRow>((from, to) =>
      sb.from('products').select('*').eq('household_id', householdId).range(from, to),
    ),
    fetchAllRows<PlatformRow>((from, to) =>
      sb.from('order_platforms').select('*').eq('household_id', householdId).range(from, to),
    ),
    fetchAllRows<RevenueRow>((from, to) =>
      sb
        .from('revenues')
        .select('*')
        .eq('household_id', householdId)
        .order('date', { ascending: false })
        .range(from, to),
    ),
    fetchAllRows<RevenueItemRow>((from, to) =>
      sb.from('revenue_items').select('*').eq('household_id', householdId).range(from, to),
    ),
  ]);

  const itemsByRevenue = new Map<string, RevenueItemRow[]>();
  for (const item of items) {
    const list = itemsByRevenue.get(item.revenue_id) ?? [];
    list.push(item);
    itemsByRevenue.set(item.revenue_id, list);
  }

  return {
    expenses: expenses.map(mapExpense),
    customers: customers.map(mapCustomer),
    products: products.map(mapProduct),
    platforms: platforms.map(mapPlatform),
    revenues: revenues.map((row) => mapRevenue(row, itemsByRevenue.get(row.id) ?? [])),
  };
}

export async function upsertExpense(householdId: string, expense: Expense): Promise<void> {
  const { error } = await getSupabase()
    .from('expenses')
    .upsert(expenseToRow(householdId, expense), { onConflict: 'id' });
  throwIfError(error);
}

export async function deleteExpenseRemote(householdId: string, id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('expenses')
    .delete()
    .eq('household_id', householdId)
    .eq('id', id);
  throwIfError(error);
}

export async function upsertCustomer(householdId: string, customer: Customer): Promise<void> {
  const { error } = await getSupabase()
    .from('customers')
    .upsert(customerToRow(householdId, customer), { onConflict: 'id' });
  throwIfError(error);
}

export async function deleteCustomerRemote(householdId: string, id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('customers')
    .delete()
    .eq('household_id', householdId)
    .eq('id', id);
  throwIfError(error);
}

export async function upsertProduct(householdId: string, product: Product): Promise<void> {
  const row = productToRow(householdId, product);
  const sb = getSupabase();
  const { error } = await sb.from('products').upsert(row, { onConflict: 'id' });
  if (!error) return;

  // onConflict:id does not cover unique (household_id, sku) when local id ≠ cloud id.
  const skuClash =
    error.code === '23505' ||
    /products_household_sku_uidx|duplicate key/i.test(error.message ?? '');
  if (!skuClash || !row.sku) {
    throwIfError(error);
    return;
  }

  const { error: retryErr } = await sb
    .from('products')
    .upsert({ ...row, sku: null }, { onConflict: 'id' });
  throwIfError(retryErr);
}

export async function deleteProductRemote(householdId: string, id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('products')
    .delete()
    .eq('household_id', householdId)
    .eq('id', id);
  throwIfError(error);
}

export async function upsertPlatform(householdId: string, platform: OrderPlatform): Promise<void> {
  const { error } = await getSupabase()
    .from('order_platforms')
    .upsert(platformToRow(householdId, platform), { onConflict: 'id' });
  throwIfError(error);
}

export async function deletePlatformRemote(householdId: string, id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('order_platforms')
    .delete()
    .eq('household_id', householdId)
    .eq('id', id);
  throwIfError(error);
}

export async function upsertRevenue(householdId: string, revenue: Revenue): Promise<void> {
  let customerId = revenue.customerId;
  if (!customerId || customerId === 'walk-in' || !UUID_RE.test(customerId)) {
    await upsertCustomer(householdId, {
      id: WALK_IN_CUSTOMER_ID,
      name: 'Khách vãng lai',
      phone: '',
      createdAt: revenue.createdAt,
    });
    customerId = WALK_IN_CUSTOMER_ID;
  }
  const payload = revenueToUpsertPayload(householdId, { ...revenue, customerId });
  const { error } = await getSupabase().rpc('upsert_revenue_with_items', {
    p_revenue: payload.revenue,
    p_items: payload.items,
  });
  throwIfError(error);

  // Remote RPC may still be an older definition that ignores priority / stock_applied
  // (columns exist; INSERT/UPDATE omit them). Patch explicitly so star/DB stay in sync.
  const rid = String(payload.revenue.id);
  const { error: patchError } = await getSupabase()
    .from('revenues')
    .update({
      priority: revenue.priority === true,
      priority_at:
        revenue.priority === true
          ? (revenue.priorityAt ?? revenue.updatedAt ?? new Date().toISOString())
          : null,
      stock_applied: revenue.stockApplied === true,
    })
    .eq('household_id', householdId)
    .eq('id', rid);
  throwIfError(patchError);
}

export async function deleteRevenueRemote(householdId: string, id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('revenues')
    .delete()
    .eq('household_id', householdId)
    .eq('id', id);
  throwIfError(error);
}

export async function pushFullLedger(householdId: string, snapshot: LedgerSnapshot): Promise<void> {
  for (const p of snapshot.platforms) await upsertPlatform(householdId, p);
  for (const c of snapshot.customers) await upsertCustomer(householdId, c);
  for (const p of snapshot.products) await upsertProduct(householdId, p);
  for (const e of snapshot.expenses) await upsertExpense(householdId, e);
  for (const r of snapshot.revenues) await upsertRevenue(householdId, r);
}
