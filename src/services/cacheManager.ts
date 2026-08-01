/**
 * IndexedDB cache wrapper — thin layer around the `idb` library.
 *
 * Usage:
 *   import { cacheGet, cacheSet, cacheDelete, cacheClear } from '@/services/cacheManager';
 *   const val = await cacheGet<Expense[]>('expenses');
 *   await cacheSet('expenses', records);
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'quan-ly-thu-chi';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Lazy-init the IndexedDB connection.
 * Creates the `cache` object store on first open if it does not exist.
 */
function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Read a value from IndexedDB cache by key.
 * Returns `undefined` when the key does not exist.
 */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('cache', key);
}

/**
 * Store a value in IndexedDB cache under the given key.
 * Overwrites any existing value for the same key.
 */
export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('cache', value, key);
}

/**
 * Remove a single key from IndexedDB cache.
 */
export async function cacheDelete(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('cache', key);
}

/**
 * Clear all keys from the `cache` object store.
 */
export async function cacheClear(): Promise<void> {
  const db = await getDB();
  await db.clear('cache');
}
