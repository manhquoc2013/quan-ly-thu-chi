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

export async function loadLedger(householdId: string): Promise<LedgerSnapshot> {
  const sb = getSupabase();

  const [expensesRes, customersRes, productsRes, platformsRes, revenuesRes, itemsRes] =
    await Promise.all([
      sb.from('expenses').select('*').eq('household_id', householdId).order('date', { ascending: false }),
      sb.from('customers').select('*').eq('household_id', householdId),
      sb.from('products').select('*').eq('household_id', householdId),
      sb.from('order_platforms').select('*').eq('household_id', householdId),
      sb.from('revenues').select('*').eq('household_id', householdId).order('date', { ascending: false }),
      sb.from('revenue_items').select('*').eq('household_id', householdId),
    ]);

  throwIfError(expensesRes.error);
  throwIfError(customersRes.error);
  throwIfError(productsRes.error);
  throwIfError(platformsRes.error);
  throwIfError(revenuesRes.error);
  throwIfError(itemsRes.error);

  const itemsByRevenue = new Map<string, RevenueItemRow[]>();
  for (const item of (itemsRes.data ?? []) as RevenueItemRow[]) {
    const list = itemsByRevenue.get(item.revenue_id) ?? [];
    list.push(item);
    itemsByRevenue.set(item.revenue_id, list);
  }

  return {
    expenses: ((expensesRes.data ?? []) as ExpenseRow[]).map(mapExpense),
    customers: ((customersRes.data ?? []) as CustomerRow[]).map(mapCustomer),
    products: ((productsRes.data ?? []) as ProductRow[]).map(mapProduct),
    platforms: ((platformsRes.data ?? []) as PlatformRow[]).map(mapPlatform),
    revenues: ((revenuesRes.data ?? []) as RevenueRow[]).map((row) =>
      mapRevenue(row, itemsByRevenue.get(row.id) ?? []),
    ),
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
  const { error } = await getSupabase()
    .from('products')
    .upsert(productToRow(householdId, product), { onConflict: 'id' });
  throwIfError(error);
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
  const payload = revenueToUpsertPayload(householdId, revenue);
  const { error } = await getSupabase().rpc('upsert_revenue_with_items', {
    p_revenue: payload.revenue,
    p_items: payload.items,
  });
  throwIfError(error);
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
