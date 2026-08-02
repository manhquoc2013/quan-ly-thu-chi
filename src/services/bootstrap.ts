/**
 * Bootstrap — hydrate Zustand stores from IndexedDB on app start.
 */

import { getAllExpenses } from '@/services/expenseService';
import { getAllRevenues } from '@/services/revenueService';
import { getAllCustomers } from '@/services/customerService';
import { getAllProducts } from '@/services/productService';
import { getAllPlatforms } from '@/services/platformService';
import { restoreDriveToken, getDriveUser, isDriveConnected } from '@/services/googleDrive';
import { useAuthStore } from '@/store/authStore';

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

async function hydrateDriveAuth(): Promise<void> {
  const ok = await restoreDriveToken();
  const auth = useAuthStore.getState();
  if (ok && isDriveConnected()) {
    const user = getDriveUser();
    auth.setGoogleConnected(true);
    auth.setGoogleUser(
      user
        ? { id: user.email, name: user.name, email: user.email, picture: user.picture }
        : null,
    );
  } else {
    auth.disconnectGoogle();
  }
}

/** Load core stores from IndexedDB. Safe to call multiple times. */
export function bootstrapAppData(): Promise<void> {
  if (bootstrapped) return Promise.resolve();
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      await hydrateDriveAuth();
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

/** Force re-read IndexedDB into Zustand (e.g. after Drive pull). */
export async function reloadAppData(): Promise<void> {
  bootstrapped = false;
  bootstrapPromise = null;
  await bootstrapAppData();
}

export function isAppDataReady(): boolean {
  return bootstrapped;
}
