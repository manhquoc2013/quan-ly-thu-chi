/**
 * Bootstrap — hydrate Zustand stores from IndexedDB on app start.
 */

import { getAllExpenses } from '@/services/expenseService';
import { getAllRevenues } from '@/services/revenueService';
import { getAllCustomers } from '@/services/customerService';
import { getAllProducts } from '@/services/productService';
import { getAllPlatforms } from '@/services/platformService';

let bootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

/** Load core stores from IndexedDB. Safe to call multiple times. */
export function bootstrapAppData(): Promise<void> {
  if (bootstrapped) return Promise.resolve();
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      await Promise.all([
        getAllExpenses(),
        getAllRevenues(),
        getAllCustomers(),
        getAllProducts(),
        getAllPlatforms(),
      ]);
      bootstrapped = true;
    } catch (err) {
      console.error('Bootstrap data failed:', err);
      bootstrapPromise = null;
      throw err;
    }
  })();

  return bootstrapPromise;
}

export function isAppDataReady(): boolean {
  return bootstrapped;
}
