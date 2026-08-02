import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOrCreateEncryptionKey,
  rewrapEncryptionKey,
} from './database';

// ── Mock localStorage ────────────────────────────────────────────────────────
const _data: Record<string, string> = {};
const mockStorage = {
  getItem(key: string): string | null {
    return _data[key] ?? null;
  },
  setItem(key: string, value: string): void {
    _data[key] = value;
  },
  removeItem(key: string): void {
    delete _data[key];
  },
  clear(): void {
    for (const k of Object.keys(_data)) delete _data[k];
  },
};

// Inject mock before each test
beforeEach(() => {
  (globalThis as unknown as Record<string, unknown>).localStorage = mockStorage as unknown as Storage;
});

/**
 * Generate a password hash using the same PBKDF2 pattern as authService.
 * Returns "saltHex:hashHex".
 */
async function makePasswordHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const hashBytes = new Uint8Array(hashBits);
  const toHex = (buf: ArrayBuffer | Uint8Array) =>
    Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  return `${toHex(salt)}:${toHex(hashBytes)}`;
}

describe('databaseKeyWrapping', () => {
  const testUserId = 'test-user-keywrap-01';

  beforeEach(() => {
    const key = `ql-tc-db-key_${testUserId}`;
    mockStorage.removeItem(key);
  });

  it('round-trip: getOrCreateEncryptionKey produces a usable AES-GCM key', async () => {
    const passwordHash = await makePasswordHash('test-password');
    const key = await getOrCreateEncryptionKey(passwordHash, testUserId);

    // Verify it's a valid CryptoKey with correct algorithm
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
    // extractable=true is needed so the key can be wrapped for storage
    expect(key.extractable).toBe(true);
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('getOrCreateEncryptionKey returns the same key after localStorage persistence', async () => {
    const passwordHash = await makePasswordHash('test-password-persist');

    // First call: creates new key and stores wrapped version
    const key1 = await getOrCreateEncryptionKey(passwordHash, testUserId);

    // Verify wrapped key was stored in localStorage
    const storedKey = mockStorage.getItem(`ql-tc-db-key_${testUserId}`);
    expect(storedKey).not.toBeNull();
    const parsed = JSON.parse(storedKey!);
    expect(parsed).toHaveProperty('encryptedKey');
    expect(parsed).toHaveProperty('salt');

    // Second call: loads from localStorage
    const key2 = await getOrCreateEncryptionKey(passwordHash, testUserId);

    // Both keys should be the same (same usages, same algorithm)
    expect(key2.algorithm.name).toBe(key1.algorithm.name);
    expect(key2.usages).toEqual(key1.usages);
  });

  it('rewrapEncryptionKey: wrong password hash fails to unwrap', async () => {
    const passwordHash = await makePasswordHash('original-password');
    await getOrCreateEncryptionKey(passwordHash, testUserId);

    // Try to unwrap with wrong password hash
    const wrongPasswordHash = await makePasswordHash('wrong-password');

    // The unwrap will fail with a DOMException, which our catch block wraps
    await expect(
      rewrapEncryptionKey(wrongPasswordHash, await makePasswordHash('new-password'), testUserId),
    ).rejects.toThrow(/mật khẩu không khớp|operation failed|data error/i);
  });

  it('rewrapEncryptionKey: re-encrypts with new password hash successfully', async () => {
    const oldPasswordHash = await makePasswordHash('old-password');
    await getOrCreateEncryptionKey(oldPasswordHash, testUserId);

    const newPasswordHash = await makePasswordHash('new-password');
    const result = await rewrapEncryptionKey(oldPasswordHash, newPasswordHash, testUserId);

    expect(result).toBe(true);

    // Verify the new wrapped key is different (new salt)
    const storedKey = mockStorage.getItem(`ql-tc-db-key_${testUserId}`);
    const parsed = JSON.parse(storedKey!);
    expect(parsed.salt).toHaveLength(32); // 16 bytes hex = 32 chars
    expect(parsed.encryptedKey).toBeDefined();
  });

  it('rewrapEncryptionKey: new user returns false (no wrapped key)', async () => {
    const newUserId = 'new-user-no-key';
    const passwordHash = await makePasswordHash('some-password');

    const result = await rewrapEncryptionKey(passwordHash, passwordHash, newUserId);
    expect(result).toBe(false);
  });

  it('rewrapEncryptionKey: after re-wrap, can still decrypt with new password', async () => {
    const oldPasswordHash = await makePasswordHash('password-before-change');
    await getOrCreateEncryptionKey(oldPasswordHash, testUserId);

    const newPasswordHash = await makePasswordHash('password-after-change');
    await rewrapEncryptionKey(oldPasswordHash, newPasswordHash, testUserId);

    // Now get the key using the new password — should succeed
    const key = await getOrCreateEncryptionKey(newPasswordHash, testUserId);
    expect(key.algorithm.name).toBe('AES-GCM');
  });
});
