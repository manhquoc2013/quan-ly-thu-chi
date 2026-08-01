/**
 * Storage Service — IndexedDB via `idb` with in-memory Map fallback.
 *
 * Provides a uniform interface for reading/writing entity stores.
 * When `idb` is available, data persists across sessions.
 * Otherwise, a simple in-memory Map acts as a temporary cache.
 */

// ── IndexedDB store names ────────────────────────────────────────────────────

export type StoreName = 'expenses' | 'revenues' | 'customers' | 'settings';

const DB_NAME = 'quan-ly-thu-chi';
const DB_VERSION = 1;

// ── In-memory fallback ───────────────────────────────────────────────────────

class MemoryStorage {
  private stores = new Map<StoreName, Map<string, any>>();

  private getStore(name: StoreName): Map<string, any> {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    return this.stores.get(name)!;
  }

  async getAll(name: StoreName): Promise<any[]> {
    const store = this.getStore(name);
    return [...store.values()];
  }

  async getById(name: StoreName, id: string): Promise<any | undefined> {
    const store = this.getStore(name);
    return store.get(id);
  }

  async putOne(name: StoreName, item: any): Promise<void> {
    const store = this.getStore(name);
    store.set(item.id, item);
  }

  async putAll(name: StoreName, items: any[]): Promise<void> {
    const store = this.getStore(name);
    for (const item of items) {
      store.set(item.id, item);
    }
  }

  async deleteOne(name: StoreName, id: string): Promise<boolean> {
    const store = this.getStore(name);
    return store.delete(id);
  }

  async clear(name: StoreName): Promise<void> {
    const store = this.getStore(name);
    store.clear();
  }
}

// ── IndexedDB wrapper (lazy init) ───────────────────────────────────────────

let idbFallback: MemoryStorage | null = null;

async function initIdb(): Promise<IDBDatabase | null> {
  try {
    // Dynamic import avoids build issues when `idb` is not yet installed.
    const { openDB } = await import('idb');
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const stores: StoreName[] = ['expenses', 'revenues', 'customers', 'settings'];
        for (const storeName of stores) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      },
    }) as unknown as Promise<IDBDatabase>;
  } catch {
    // `idb` not installed — fall back to memory storage.
    if (!idbFallback) {
      idbFallback = new MemoryStorage();
    }
    return null;
  }
}

// ── IndexedDB implementation ─────────────────────────────────────────────────

async function idbGetAll(db: IDBDatabase, name: StoreName): Promise<any[]> {
  const tx = db.transaction(name, 'readonly');
  const store = tx.objectStore(name);
  return await store.getAll() as unknown as any[];
}

async function idbGetById(db: IDBDatabase, name: StoreName, id: string): Promise<any | undefined> {
  const tx = db.transaction(name, 'readonly');
  const store = tx.objectStore(name);
  return await store.get(id);
}

async function idbPutOne(db: IDBDatabase, name: StoreName, item: any): Promise<void> {
  const tx = db.transaction(name, 'readwrite');
  const store = tx.objectStore(name);
  await store.put(item);
}

async function idbPutAll(db: IDBDatabase, name: StoreName, items: any[]): Promise<void> {
  const tx = db.transaction(name, 'readwrite');
  const store = tx.objectStore(name);
  for (const item of items) {
    await store.put(item);
  }
}

async function idbDeleteOne(db: IDBDatabase, name: StoreName, id: string): Promise<boolean> {
  const tx = db.transaction(name, 'readwrite');
  const store = tx.objectStore(name);
  await store.delete(id);
  return true;
}

async function idbClear(db: IDBDatabase, name: StoreName): Promise<void> {
  const tx = db.transaction(name, 'readwrite');
  const store = tx.objectStore(name);
  await store.clear();
}

// ── Public API ───────────────────────────────────────────────────────────────

let _dbPromise: Promise<IDBDatabase | null> | null = null;

async function getDb(): Promise<IDBDatabase | null> {
  if (!_dbPromise) {
    _dbPromise = initIdb();
  }
  return _dbPromise;
}

async function resolveStore(_name: StoreName): Promise<{
  db: IDBDatabase | null;
  memory: MemoryStorage | null;
}> {
  const db = await getDb();
  return { db, memory: idbFallback };
}

/**
 * Storage service object with methods for IndexedDB operations.
 * Falls back to in-memory storage when `idb` is unavailable.
 */
export const storageService = {
  /**
   * Read all items from a store.
   */
  async getAll(name: StoreName): Promise<any[]> {
    const { db, memory } = await resolveStore(name);
    if (db) {
      return idbGetAll(db, name);
    }
    if (memory) {
      return memory.getAll(name);
    }
    return [];
  },

  /**
   * Read a single item by its primary key.
   */
  async getById(name: StoreName, id: string): Promise<any | undefined> {
    const { db, memory } = await resolveStore(name);
    if (db) {
      return idbGetById(db, name, id);
    }
    if (memory) {
      return memory.getById(name, id);
    }
    return undefined;
  },

  /**
   * Upsert a single item (insert or update by primary key).
   */
  async putOne(name: StoreName, item: any): Promise<void> {
    const { db, memory } = await resolveStore(name);
    if (db) {
      return idbPutOne(db, name, item);
    }
    if (memory) {
      return memory.putOne(name, item);
    }
  },

  /**
   * Upsert multiple items at once.
   */
  async putAll(name: StoreName, items: any[]): Promise<void> {
    const { db, memory } = await resolveStore(name);
    if (db) {
      return idbPutAll(db, name, items);
    }
    if (memory) {
      return memory.putAll(name, items);
    }
  },

  /**
   * Delete a single item by its primary key.
   */
  async deleteOne(name: StoreName, id: string): Promise<boolean> {
    const { db, memory } = await resolveStore(name);
    if (db) {
      return idbDeleteOne(db, name, id);
    }
    if (memory) {
      return memory.deleteOne(name, id);
    }
    return false;
  },

  /**
   * Clear all items from a store.
   */
  async clear(name: StoreName): Promise<void> {
    const { db, memory } = await resolveStore(name);
    if (db) {
      return idbClear(db, name);
    }
    if (memory) {
      return memory.clear(name);
    }
  },
};
