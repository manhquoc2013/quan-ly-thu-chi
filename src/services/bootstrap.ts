/**
 * Bootstrap — hydrate Zustand stores from IndexedDB on app start.
 */

import { getAllExpenses } from '@/services/expenseService';
import { getAllRevenues } from '@/services/revenueService';
import { getAllCustomers } from '@/services/customerService';

let bootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

/** Load expenses, revenues, customers into stores. Safe to call multiple times. */
export function bootstrapAppData(): Promise<void> {
  if (bootstrapped) return Promise.resolve();
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      await Promise.all([getAllExpenses(), getAllRevenues(), getAllCustomers()]);
      bootstrapped = true;
    } catch (err) {
      console.error('Bootstrap data failed:', err);
      // Allow retry on next call
      bootstrapPromise = null;
      throw err;
    }
  })();

  return bootstrapPromise;
}

export function isAppDataReady(): boolean {
  return bootstrapped;
}
