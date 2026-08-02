/**
 * IndexedDB cache wrapper — thin layer around the `idb` library.
 *
 * Usage:
 *   import { cacheGet, cacheSet, cacheDelete, cacheClear } from '@/services/cacheManager';
 *   const val = await cacheGet<Expense[]>('expenses');
 *   await cacheSet('expenses', records);
 *
 * Per-user key scoping:
 *   import { setCacheUserId, getCacheUserId } from '@/services/cacheManager';
 *   setCacheUserId(userId);  // call after login
 *   // All subsequent cache operations use 'key_<userId>' automatically.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'quan-ly-thu-chi';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

/** Current user ID for key scoping. Set after login via setCacheUserId(). */
let currentUserId: string | null = null;

/** Set the current user ID for key scoping. Call after login. */
export function setCacheUserId(userId: string | null): void {
  currentUserId = userId;
}

/** Return the current user ID used for key scoping. */
export function getCacheUserId(): string | null {
  return currentUserId;
}

/** Scope a cache key to the current user if available. */
function scopeKey(key: string): string {
  return currentUserId ? `${key}_${currentUserId}` : key;
}

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
 * Key is automatically scoped to current user if available.
 */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('cache', scopeKey(key));
}

/**
 * Store a value in IndexedDB cache under the given key.
 * Overwrites any existing value for the same key.
 * Key is automatically scoped to current user if available.
 */
export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('cache', value, scopeKey(key));
}

/**
 * Remove a single key from IndexedDB cache.
 * Key is automatically scoped to current user if available.
 */
export async function cacheDelete(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('cache', scopeKey(key));
}

/**
 * Clear all keys from the `cache` object store.
 */
export async function cacheClear(): Promise<void> {
  const db = await getDB();
  await db.clear('cache');
}
