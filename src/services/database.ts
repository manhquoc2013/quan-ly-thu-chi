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
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { cacheGet, cacheSet } from './cacheManager';

const DB_CACHE_KEY = 'database_binary';
const SCHEMA_VERSION = 1;

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

// ── User-scoped DB context ────────────────────────────────────────────────

let currentUserId: string | null = null;
let currentEncryptionKey: CryptoKey | null = null;

/** Storage key for the AES-GCM salt per user. */
const DB_SALT_KEY_PREFIX = 'ql-tc-db-salt_';

/** Storage key for the AES-GCM salt per user. */
function getDbSaltKey(userId: string): string {
  return `${DB_SALT_KEY_PREFIX}${userId}`;
}

function storeDbSalt(userId: string, salt: Uint8Array): void {
  localStorage.setItem(getDbSaltKey(userId), Array.from(salt).join(','));
}

function loadDbSalt(userId: string): Uint8Array | null {
  const raw = localStorage.getItem(getDbSaltKey(userId));
  if (!raw) return null;
  return new Uint8Array(raw.split(',').map(Number));
}

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

/**
 * Initialize the SQLite database.
 *
 * @param userId — optional user ID for multi-user isolation; if provided and
 *   differs from the current user, the existing DB is closed and a fresh one
 *   is loaded under the new user's cache key.
 * @param encryptionKey — optional AES-GCM key; if provided, the binary is
 *   encrypted/decrypted on save/load.
 */
export async function initDatabase(
  userId?: string,
  encryptionKey?: CryptoKey,
): Promise<Database> {
  // If userId provided and differs from current, close existing DB
  if (userId && userId !== currentUserId) {
    if (db) {
      db.close();
      db = null;
    }
    currentUserId = userId;
    currentEncryptionKey = encryptionKey ?? null;
  } else if (userId) {
    // Same user — just update encryption key if provided
    currentEncryptionKey = encryptionKey ?? currentEncryptionKey;
  }

  if (db) return db;

  // Load sql.js WASM (Vite emits correct URL for / and GitHub Pages base)
  SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });

  // Use user-scoped cache key
  const cacheKey = userId ? `database_binary_${userId}` : DB_CACHE_KEY;
  const cached = await cacheGet<number[]>(cacheKey);

  if (cached) {
    let binary: Uint8Array = Uint8Array.from(cached);
    // Decrypt if encryption key is available
    if (currentEncryptionKey && binary.length > 0) {
      try {
        binary = await decryptBinary(binary, currentEncryptionKey);
      } catch {
        throw new Error('Không thể giải mã dữ liệu. Vui lòng kiểm tra lại mật khẩu.');
      }
    }
    db = new SQL.Database(binary as unknown as Uint8Array<ArrayBuffer>);
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

/** Load database from binary buffer (e.g., downloaded from Google Drive). */
export async function loadFromBinary(binary: Uint8Array): Promise<void> {
  if (!SQL) throw new Error('SQL.js not loaded. Call initDatabase() first.');
    db = new SQL.Database(binary as unknown as Uint8Array<ArrayBuffer>);
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

// ── Key Wrapping Storage ────────────────────────────────────────────────────

/** Prefix for wrapped DB encryption key in localStorage. */
const DB_KEY_STORAGE_PREFIX = 'ql-tc-db-key_';

interface WrappedKey {
  encryptedKey: string; // hex-encoded AES-KW wrapped key
  salt: string;         // hex-encoded PBKDF2 salt for wrapping key derivation
}

function getWrappedKeyStorageKey(userId: string): string {
  return `${DB_KEY_STORAGE_PREFIX}${userId}`;
}

function storeWrappedKey(userId: string, wrapped: WrappedKey): void {
  localStorage.setItem(getWrappedKeyStorageKey(userId), JSON.stringify(wrapped));
}

function loadWrappedKey(userId: string): WrappedKey | null {
  try {
    const raw = localStorage.getItem(getWrappedKeyStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as WrappedKey;
  } catch {
    return null;
  }
}

/** Convert an ArrayBuffer to a lowercase hex string. */
function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Convert a hex string to a Uint8Array. */
function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// ── AES-GCM Encryption Helpers ──────────────────────────────────────────────

const IV_LENGTH = 12;

/** Derive a wrapping key from password hash + salt for key wrapping. */
async function deriveWrappingKey(
  passwordHash: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passwordHash),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

/**
 * Get or create a stable DB encryption key for a user.
 * The actual DB key is randomly generated once and never changes.
 * It is wrapped (encrypted) with a key derived from the password hash,
 * so it can be unwrapped after password changes.
 */
export async function getOrCreateEncryptionKey(
  passwordHash: string,
  userId: string,
): Promise<CryptoKey> {
  const wrapped = loadWrappedKey(userId);

  if (wrapped) {
    const wrapKey = await deriveWrappingKey(passwordHash, fromHex(wrapped.salt));
    const encryptedKeyBytes = new Uint8Array(fromHex(wrapped.encryptedKey));

    try {
      const decrypted = await crypto.subtle.unwrapKey(
        'raw',
        encryptedKeyBytes as Uint8Array<ArrayBuffer>,
        wrapKey,
        { name: 'AES-KW' },
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
      currentEncryptionKey = decrypted;
      return decrypted;
    } catch {
      throw new Error(
        'Không thể giải mã khóa dữ liệu. Mật khẩu không khớp hoặc dữ liệu bị hỏng.',
      );
    }
  }

  // No existing wrapped key — create new DB key
  const dbKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable=true so we can wrap it
    ['encrypt', 'decrypt'],
  );

  // Wrap it with password-derived key using AES-KW
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const wrapKey = await deriveWrappingKey(passwordHash, salt);

  const wrappedKeyBytes = await crypto.subtle.wrapKey(
    'raw', dbKey, wrapKey, { name: 'AES-KW' },
  );

  storeWrappedKey(userId, {
    encryptedKey: toHex(wrappedKeyBytes),
    salt: toHex(salt),
  });

  currentEncryptionKey = dbKey;
  return dbKey;
}

/**
 * Re-wrap the DB encryption key after a password change.
 * Decrypts with old password hash, re-encrypts with new.
 * Returns true if re-wrapping succeeded, false if no wrapped key exists (new user).
 */
export async function rewrapEncryptionKey(
  oldPasswordHash: string,
  newPasswordHash: string,
  userId: string,
): Promise<boolean> {
  const wrapped = loadWrappedKey(userId);
  if (!wrapped) return false;

  const oldWrapKey = await deriveWrappingKey(oldPasswordHash, fromHex(wrapped.salt));
  const encryptedKeyBytes = new Uint8Array(fromHex(wrapped.encryptedKey));

  const dbKey = await crypto.subtle.unwrapKey(
    'raw',
    encryptedKeyBytes as Uint8Array<ArrayBuffer>,
    oldWrapKey,
    { name: 'AES-KW' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );

  const newSalt = new Uint8Array(16);
  crypto.getRandomValues(newSalt);
  const newWrapKey = await deriveWrappingKey(newPasswordHash, newSalt);

  const newWrappedBytes = await crypto.subtle.wrapKey(
    'raw', dbKey, newWrapKey, { name: 'AES-KW' },
  );

  storeWrappedKey(userId, {
    encryptedKey: toHex(newWrappedBytes),
    salt: toHex(newSalt),
  });

  return true;
}

/** @deprecated Use getOrCreateEncryptionKey — provides stable wrapped-key persistence. */
export async function deriveEncryptionKey(
  passwordHash: string,
  userId: string,
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const saltBytes = loadDbSalt(userId) ?? new Uint8Array(16);
  if (!loadDbSalt(userId)) crypto.getRandomValues(saltBytes);

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passwordHash),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  currentEncryptionKey = key;
  storeDbSalt(userId, saltBytes);
  return { key, salt: saltBytes };
}

/** Encrypt a Uint8Array with AES-GCM. Format: [12-byte IV][encrypted data]. */
export async function encryptBinary(
  data: Uint8Array,
  key: CryptoKey,
): Promise<Uint8Array> {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data as unknown as BufferSource,
  );

  // Prepend IV to ciphertext
  const result = new Uint8Array(iv.length + (encrypted as ArrayBuffer).byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), IV_LENGTH);
  return result;
}

/** Decrypt a Uint8Array with AES-GCM. Reads first 12 bytes as IV. */
export async function decryptBinary(
  encryptedData: Uint8Array,
  key: CryptoKey,
): Promise<Uint8Array> {
  if (encryptedData.length < IV_LENGTH) {
    throw new Error('Encrypted data too short — invalid format.');
  }

  const iv = encryptedData.slice(0, IV_LENGTH);
  const ciphertext = encryptedData.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new Uint8Array(decrypted);
}

// ── User-scoped Persistence ─────────────────────────────────────────────────

/** Save current database state to IndexedDB cache (user-scoped). */
export async function saveToCache(): Promise<void> {
  let binary = exportDatabase();
  // Encrypt if encryption key is available
  if (currentEncryptionKey) {
    binary = await encryptBinary(binary, currentEncryptionKey);
  }
  const cacheKey = currentUserId ? `database_binary_${currentUserId}` : DB_CACHE_KEY;
  await cacheSet(cacheKey, Array.from(binary));
}

/** Close the current database and reset user-scoped state. */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
  currentUserId = null;
  currentEncryptionKey = null;
}
