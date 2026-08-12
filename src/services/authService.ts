/**
 * Local authentication service — uses Web Crypto API for password hashing
 * and localStorage for multi-user credential storage.
 *
 * Storage key: `ql-tc-local-auth` — always stores `Record<string, StoredCredentials>`.
 * Lazy migration converts legacy single-object format on first read.
 */

const AUTH_STORAGE_KEY = 'ql-tc-local-auth';

export interface UserProfile {
  storeName: string;
  email: string;
  address?: string;
  phone?: string;
}

export interface StoredCredentials {
  email: string;
  passwordHash: string; // format: "salt:hash" (both hex-encoded), or "" for OTP-only
  profile: UserProfile;
  isAdmin?: boolean;
  hasPassword: boolean; // COMPUTED: passwordHash !== ""
  tokenSecret: string;  // 32 random hex bytes — HMAC key material for OTP-only users
}

type UserMap = Record<string, StoredCredentials>;

// ─── Helpers ───────────────────────────────────────────────────────────

/** Convert an ArrayBuffer to a lowercase hex string. */
function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Convert a hex string to a Uint8Array. */
function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Constant-time byte comparison to prevent timing attacks. */
function constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined || bi === undefined) return false;
    result |= ai ^ bi;
  }
  return result === 0;
}

/**
 * Generate a 32-byte random hex string for tokenSecret.
 * Used as HMAC key material for OTP-only users (no password).
 */
function generateTokenSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * Normalize legacy single-object credentials to the StoredCredentials
 * interface by computing hasPassword and generating tokenSecret.
 */
function normalizeCreds(raw: { email: string; passwordHash: string; profile: UserProfile; isAdmin?: boolean }): StoredCredentials {
  return {
    email: raw.email,
    passwordHash: raw.passwordHash,
    profile: raw.profile,
    isAdmin: raw.isAdmin,
    hasPassword: raw.passwordHash !== '',
    tokenSecret: generateTokenSecret(),
  };
}

/**
 * Check whether a parsed value looks like the legacy single-object format
 * (top-level `email` + `passwordHash`, not a multi-user Record).
 */
function isLegacySingleObject(raw: unknown): raw is { email: string; passwordHash: string; profile: UserProfile; isAdmin?: boolean } {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    !Array.isArray(raw) &&
    'email' in raw &&
    'passwordHash' in raw &&
    typeof (raw as { email?: unknown }).email === 'string' &&
    typeof (raw as { passwordHash?: unknown }).passwordHash === 'string' &&
    'profile' in raw
  );
}

/**
 * Single read entry-point. Reads raw JSON from localStorage, performs lazy
 * migration from legacy single-object to Record<string, StoredCredentials>,
 * then returns the user map.
 */
function getAllUsersMap(): UserMap {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);

    // Lazy migration: single-object format → wrapped into record
    if (isLegacySingleObject(parsed)) {
      const normalized = normalizeCreds(parsed);
      const map: UserMap = { [normalized.email.toLowerCase()]: normalized };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(map));
      return map;
    }

    // Already a map (or corrupted — return empty)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      // Ensure every entry has hasPassword + tokenSecret (forward-compat for future writes)
      const normalizedMap: UserMap = {};
      for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
        if (val && typeof val === 'object' && 'email' in val && 'passwordHash' in val && 'profile' in val) {
          const v = val as StoredCredentials;
          normalizedMap[key] = {
            email: v.email,
            passwordHash: v.passwordHash,
            profile: v.profile,
            isAdmin: v.isAdmin,
            hasPassword: typeof v.hasPassword === 'boolean' ? v.hasPassword : v.passwordHash !== '',
            tokenSecret: v.tokenSecret || generateTokenSecret(),
          };
        }
      }
      return normalizedMap;
    }

    // Corrupted / unrecognized — return empty map
    return {};
  } catch {
    return {};
  }
}

// ─── Exports ───────────────────────────────────────────────────────────

/**
 * Generate a 6-digit random OTP using crypto.getRandomValues.
 */
export function generateOTP(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
   
  const num = arr[0]! * 256 ** 3 + arr[1]! * 256 ** 2 + arr[2]! * 256 + arr[3]!;
  return String(num % 1_000_000).padStart(6, '0');
}

/**
 * Hash a password using PBKDF2 with SHA-256.
 *
 * - Generates a 16-byte random salt via crypto.getRandomValues
 * - Derives a key with 100 000 iterations
 * - Returns "saltHex:hashHex"
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string.');
  }

  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const hashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  const hashBytes = new Uint8Array(hashBits);
  return `${toHex(saltBytes)}:${toHex(hashBytes)}`;
}

/**
 * Verify a password against a stored "salt:hash" string.
 *
 * Re-derives the hash with the same salt and compares in constant time.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;

  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;

  const saltHex = parts[0];
  const hashHex = parts[1];
  if (!saltHex || !hashHex) return false;

  const saltBytes = fromHex(saltHex) as BufferSource;

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedHashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  const derivedHashBytes = new Uint8Array(derivedHashBits);
  const storedHashBytes = fromHex(hashHex);

  return constantTimeCompare(derivedHashBytes, storedHashBytes);
}

// ─── Multi-user storage layer ──────────────────────────────────────────

/**
 * Get user credentials by email from the multi-user map.
 * Returns null if the user does not exist.
 */
export function getUserByEmail(email: string): StoredCredentials | null {
  const map = getAllUsersMap();
  return map[email.toLowerCase()] ?? null;
}

/**
 * Get all stored users as an array.
 */
export function getAllUsers(): StoredCredentials[] {
  return Object.values(getAllUsersMap());
}

/**
 * Store credentials into the multi-user map by email key.
 * Upserts: if the email already exists, replaces the entry.
 */
export function storeUserCredentials(credentials: StoredCredentials): void {
  const map = getAllUsersMap();
  map[credentials.email.toLowerCase()] = {
    ...credentials,
    hasPassword: credentials.passwordHash !== '',
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(map));
}

/**
 * Convenience alias for storeUserCredentials — stores by explicit email key.
 */
export function storeUserByEmail(email: string, credentials: StoredCredentials): void {
  storeUserCredentials({ ...credentials, email: email.toLowerCase() });
}

/**
 * Check if a user exists by email.
 */
export function userExists(email: string): boolean {
  return getUserByEmail(email) !== null;
}

/**
 * Register a new user into the multi-user map.
 *
 * @param email — unique email address
 * @param password — optional; if omitted the user is OTP-only (hasPassword=false, tokenSecret generated)
 * @param profile — user profile object
 * @returns the stored StoredCredentials
 */
export async function registerUser(email: string, password?: string, profile?: UserProfile): Promise<StoredCredentials> {
  const emailLower = email.toLowerCase();

  // If user already exists, return existing
  const existing = getUserByEmail(emailLower);
  if (existing) return existing;

  const passwordHash = password ? await hashPassword(password) : '';
  const normalizedProfile = profile || { storeName: '', email: emailLower };

  const creds: StoredCredentials = {
    email: emailLower,
    passwordHash,
    profile: normalizedProfile,
    hasPassword: passwordHash !== '',
    tokenSecret: generateTokenSecret(),
    isAdmin: false,
  };

  storeUserCredentials(creds);
  return creds;
}

/**
 * Update profile fields while preserving the existing password hash and token secret.
 * Multi-user variant: reads/writes the entry keyed by email.
 */
export function updateProfileInternal(email: string, profile: Partial<UserProfile>): void {
  const map = getAllUsersMap();
  const key = email.toLowerCase();
  const existing = map[key];
  if (!existing) return;

  map[key] = {
    ...existing,
    profile: { ...existing.profile, ...profile },
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(map));
}

/**
 * Update profile fields while preserving the existing password hash.
 * Backward-compatible wrapper for wave-1 callers (no email arg).
 * Uses the first user from the multi-user map when multiple exist.
 */
export function updateProfile(profile: Partial<UserProfile>): void {
  const map = getAllUsersMap();
  const entries = Object.values(map);
  if (entries.length === 0) return;
  const first = entries[0];
  if (!first) return;
  updateProfileInternal(first.email, profile);
}

/**
 * Multi-user variant: change password for a specific email.
 */
export async function changePasswordInternal(email: string, oldPassword: string, newPassword: string): Promise<boolean> {
  const map = getAllUsersMap();
  const key = email.toLowerCase();
  const existing = map[key];
  if (!existing) return false;

  const valid = await verifyPassword(oldPassword, existing.passwordHash);
  if (!valid) return false;

  const newHash = await hashPassword(newPassword);

  map[key] = {
    ...existing,
    passwordHash: newHash,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(map));
  return true;
}

/**
 * Change password: verify oldPassword, hash newPassword, and save.
 * Backward-compatible wrapper for wave-1 callers (no email arg).
 * Uses the first user from the multi-user map when multiple exist.
 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
  const map = getAllUsersMap();
  const entries = Object.values(map);
  if (entries.length === 0) return false;
  const first = entries[0];
  if (!first) return false;
  return changePasswordInternal(first.email, oldPassword, newPassword);
}

/**
 * Reset password for the forgot-password flow.
 *
 * Caller must verify OTP before calling this. Upserts into the multi-user map.
 * Preserves existing profile if found; creates placeholder if not.
 */
export async function resetPassword(email: string, newPassword: string): Promise<void> {
  const newHash = await hashPassword(newPassword);
  const map = getAllUsersMap();
  const key = email.toLowerCase();

  const existing = map[key];
  const existingProfile = existing?.profile;
  const profile = existingProfile && existingProfile.email?.toLowerCase() === email.toLowerCase()
    ? existingProfile
    : { storeName: '', email };

  map[key] = {
    email,
    passwordHash: newHash,
    profile,
    hasPassword: true,
    tokenSecret: existing?.tokenSecret || generateTokenSecret(),
    isAdmin: existing?.isAdmin,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(map));
}

/**
 * BACKWARD-COMPATIBILITY WRAPPER: read the single stored user for legacy callers.
 * Internally delegates to getUserByEmail() with the first key from the map.
 * New code should use getUserByEmail(email) directly.
 *
 * NOTE: All 14 references across authStore.ts, AuthScreen.tsx, AuthProvider.tsx
 * are being migrated to getUserByEmail(email) in wave-2. This wrapper exists so
 * the import contract remains valid during the transition.
 */
export function getUserCredentials(): StoredCredentials | null {
  const map = getAllUsersMap();
  const entries = Object.values(map);
  if (entries.length === 0) return null;
  const first = entries[0];
  if (!first) return null;
  // Multiple users — return the first one (legacy behavior).
  // TODO: Remove this wrapper once all callers migrate to getUserByEmail(email).
  return first;
}

/**
 * Clear all stored auth data — empties the multi-user map.
 */
export function clearAuth(): void {
  localStorage.setItem(AUTH_STORAGE_KEY, '{}');
}

// ── Admin account bootstrap ──────────────────────────────────────────────

const DEFAULT_ADMIN_EMAIL = 'admin@quanlythuchi.app';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

/**
 * Initialize the default admin account if no user exists yet.
 * Called once on first app launch. Returns true if admin was created.
 */
export async function initAdminAccount(): Promise<boolean> {
  // Migrate legacy admin user with old email 'admin' → DEFAULT_ADMIN_EMAIL
  const map = getAllUsersMap();
  const legacy = map['admin'];
  if (legacy && legacy.isAdmin) {
    delete map['admin'];
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(map));
  }
  if (userExists(DEFAULT_ADMIN_EMAIL)) return false;

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  storeUserCredentials({
    email: DEFAULT_ADMIN_EMAIL,
    passwordHash,
    profile: {
      storeName: 'Cửa hàng của tôi',
      email: DEFAULT_ADMIN_EMAIL,
    },
    hasPassword: true,
    tokenSecret: generateTokenSecret(),
    isAdmin: true,
  });
  return true;
}
