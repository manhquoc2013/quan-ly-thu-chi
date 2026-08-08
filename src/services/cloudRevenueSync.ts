/**
 * Ensure FK parents exist on Supabase before upserting a revenue row.
 */

import type { Customer, Revenue } from '@/models';
import {
  useCustomerStore,
  usePlatformStore,
  useProductStore,
} from '@/store';
import {
  upsertCustomer,
  upsertPlatform,
  upsertProduct,
  upsertRevenue,
  WALK_IN_CUSTOMER_ID,
} from './ledgerRepository';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stubCustomer(id: string, createdAt: string): Customer {
  return { id, name: 'Khách', phone: '', createdAt };
}

/** Upsert customer / platform / products referenced by the order, then the order itself. */
export async function upsertRevenueToCloud(
  householdId: string,
  revenue: Revenue,
): Promise<void> {
  const customers = useCustomerStore.getState().customers;
  const platforms = usePlatformStore.getState().platforms;
  const products = useProductStore.getState().products;

  const customerId = revenue.customerId;
  if (customerId && customerId !== 'walk-in' && UUID_RE.test(customerId)) {
    const existing = customers.find((c) => c.id === customerId);
    await upsertCustomer(
      householdId,
      existing ?? stubCustomer(customerId, revenue.createdAt),
    );
  } else {
    await upsertCustomer(householdId, {
      id: WALK_IN_CUSTOMER_ID,
      name: 'Khách vãng lai',
      phone: '',
      createdAt: revenue.createdAt,
    });
  }

  if (revenue.platformId) {
    const platform = platforms.find((p) => p.id === revenue.platformId);
    if (platform) await upsertPlatform(householdId, platform);
  }

  const seen = new Set<string>();
  for (const item of revenue.items) {
    const pid = item.productId;
    if (!pid || seen.has(pid) || !UUID_RE.test(pid)) continue;
    seen.add(pid);
    const product = products.find((p) => p.id === pid);
    if (product) await upsertProduct(householdId, product);
  }

  await upsertRevenue(householdId, revenue);
}
