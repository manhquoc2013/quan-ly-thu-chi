import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './authService';

describe('authService', () => {
  it('hashPassword and verifyPassword round-trip', async () => {
    const password = 'test-password-123';
    const hash = await hashPassword(password);
    expect(hash).toContain(':');
    expect(hash.split(':')).toHaveLength(2);
    const parts = hash.split(':');
    expect(parts).toHaveLength(2);
    const saltHex = parts[0]!;
    const hashHex = parts[1]!;
    expect(saltHex.length).toBe(32); // 16 bytes * 2 hex chars
    expect(hashHex.length).toBe(64); // 32 bytes * 2 hex chars

    const valid = await verifyPassword(password, hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword('wrong-password', hash);
    expect(invalid).toBe(false);
  });

  it('different passwords produce different hashes', async () => {
    const hash1 = await hashPassword('password-1');
    const hash2 = await hashPassword('password-2');
    expect(hash1).not.toBe(hash2);
  });

  it('same password produces different hashes (different salt)', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');
    expect(hash1).not.toBe(hash2);
  });

  it('hashPassword rejects empty password', async () => {
    await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string.');
  });

  it('hashPassword rejects null input', async () => {
    await expect(hashPassword(null as unknown as string)).rejects.toThrow('Password must be a non-empty string.');
  });

  it('verifyPassword returns false for malformed hash', async () => {
    const result = await verifyPassword('test', 'bad-hash');
    expect(result).toBe(false);
  });

  it('verifyPassword returns false for hash with missing parts', async () => {
    const result = await verifyPassword('test', 'only-salt');
    expect(result).toBe(false);
  });

  it('verifyPassword returns false for empty inputs', async () => {
    expect(await verifyPassword('', 'salt:hash')).toBe(false);
    expect(await verifyPassword('password', '')).toBe(false);
    expect(await verifyPassword('', '')).toBe(false);
  });
});
