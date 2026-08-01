/**
 * SQLite Database — sql.js WASM implementation.
 *
 * Replaces raw IndexedDB key-value cache with proper SQL queries.
 * Database file is persisted in IndexedDB as binary buffer.
 * Sync with Google Drive by uploading/downloading the binary .db file.
 *
 * Schema matches docs/02-data-models.md §6.
 *
 * Usage:
 *   import { initDatabase, getDB } from '@/services/database';
 *   await initDatabase();
 *   const db = getDB();
 *   db.run('SELECT * FROM expenses WHERE date >= ?', ['2026-07-01']);
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { cacheGet, cacheSet } from './cacheManager';

const DB_CACHE_KEY = 'database_binary';
const SCHEMA_VERSION = 1;

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

// ── SQL Schema ─────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    supplier TEXT,
    notes TEXT,
    invoice_file_id TEXT,
    tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
  CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
  CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

  CREATE TABLE IF NOT EXISTS revenues (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    order_code TEXT NOT NULL UNIQUE,
    customer_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    total_amount INTEGER NOT NULL,
    discount INTEGER DEFAULT 0,
    final_amount INTEGER NOT NULL,
    order_status TEXT NOT NULL DEFAULT 'new',
    delivery_status TEXT DEFAULT 'pending',
    payment_method TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_revenues_date ON revenues(date);
  CREATE INDEX IF NOT EXISTS idx_revenues_status ON revenues(order_status);

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    revenue_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    total INTEGER NOT NULL,
    FOREIGN KEY (revenue_id) REFERENCES revenues(id)
  );
  CREATE INDEX IF NOT EXISTS idx_order_items_revenue ON order_items(revenue_id);

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;

// ── Init ────────────────────────────────────────────────────────────────────

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  // Load sql.js WASM (cached by browser after first load)
  SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
  });

  // Try loading existing database from IndexedDB cache
  const cached = await cacheGet<number[]>(DB_CACHE_KEY);
  if (cached) {
    db = new SQL.Database(new Uint8Array(cached));
  } else {
    db = new SQL.Database();
    createSchema(db);
  }

  return db;
}

function createSchema(database: Database): void {
  database.run(SCHEMA_SQL);
  database.run('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)', [
    SCHEMA_VERSION,
    new Date().toISOString(),
  ]);
}

// ── Getter ──────────────────────────────────────────────────────────────────

export function getDB(): Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

// ── Persistence ─────────────────────────────────────────────────────────────

/** Export entire database as Uint8Array binary (for upload to Drive or cache). */
export function exportDatabase(): Uint8Array {
  return getDB().export();
}

/** Save current database state to IndexedDB cache. */
export async function saveToCache(): Promise<void> {
  const binary = Array.from(exportDatabase());
  await cacheSet(DB_CACHE_KEY, binary);
}

/** Load database from binary buffer (e.g., downloaded from Google Drive). */
export async function loadFromBinary(binary: Uint8Array): Promise<void> {
  if (!SQL) throw new Error('SQL.js not loaded. Call initDatabase() first.');
  db = new SQL.Database(binary);
  await saveToCache();
}

// ── Migration ───────────────────────────────────────────────────────────────

export function getSchemaVersion(): number {
  try {
    const result = getDB().exec('SELECT MAX(version) as v FROM schema_version');
    if (result.length > 0 && result[0]!.values.length > 0) {
      return (result[0]!.values[0]![0] as number) ?? 0;
    }
  } catch {
    // Table might not exist yet
  }
  return 0;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a SQL.js result row to a plain object using column names. */
export function rowToObject<T extends Record<string, unknown>>(
  columns: string[],
  row: unknown[],
): T {
  const obj = {} as Record<string, unknown>;
  columns.forEach((col, i) => {
    obj[col] = row[i];
  });
  return obj as T;
}

/** Execute a SELECT query and return typed results. */
export function queryAll<T extends Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): T[] {
  const stmt = getDB().prepare(sql);
  if (params) stmt.bind(params as import('sql.js').SqlValue[]);
  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as unknown as T);
  }
  stmt.free();
  return results;
}

/** Execute a SELECT query and return first row or null. */
export function queryOne<T extends Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): T | null {
  const results = queryAll<T>(sql, params);
  return results.length > 0 ? results[0]! : null;
}

/** Execute INSERT/UPDATE/DELETE and return number of changes. */
export function execute(sql: string, params?: import('sql.js').SqlValue[]): number {
  getDB().run(sql, params);
  saveToCache(); // Auto-save after mutation
  return getDB().getRowsModified();
}
