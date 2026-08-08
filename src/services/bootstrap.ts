/**
 * Bootstrap — hydrate Zustand stores from IndexedDB on app start.
 */

import { getAllExpenses } from '@/services/expenseService';
import { getAllRevenues } from '@/services/revenueService';
import { getAllCustomers } from '@/services/customerService';
import { getAllProducts } from '@/services/productService';
import { getAllPlatforms } from '@/services/platformService';
import { initAdminAccount } from '@/services/authService';

let bootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

async function hydrateStores(): Promise<void> {
  await Promise.all([
    getAllExpenses(),
    getAllRevenues(),
    getAllCustomers(),
    getAllProducts(),
    getAllPlatforms(),
  ]);
}

/** Load core stores from IndexedDB. Safe to call multiple times. */
export function bootstrapAppData(): Promise<void> {
  if (bootstrapped) return Promise.resolve();
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      await initAdminAccount();
      await hydrateStores();
      bootstrapped = true;
    } catch (err) {
      console.error('Bootstrap data failed:', err);
      bootstrapPromise = null;
      throw err;
    }
  })();

  return bootstrapPromise;
}

/** Force re-read IndexedDB into Zustand (e.g. after cloud pull). */
export async function reloadAppData(): Promise<void> {
  bootstrapped = false;
  bootstrapPromise = null;
  await bootstrapAppData();
}

export function isAppDataReady(): boolean {
  return bootstrapped;
}
