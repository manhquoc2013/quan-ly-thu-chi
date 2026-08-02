import { describe, it, expect, beforeEach } from 'vitest';
import {
  setCacheUserId,
  getCacheUserId,
} from './cacheManager';

describe('cacheManager key scoping', () => {
  beforeEach(() => {
    setCacheUserId(null);
  });

  it('getCacheUserId returns null initially', () => {
    expect(getCacheUserId()).toBeNull();
  });

  it('setCacheUserId and getCacheUserId round-trip', () => {
    setCacheUserId('user-alpha-001');
    expect(getCacheUserId()).toBe('user-alpha-001');

    setCacheUserId('user-beta-002');
    expect(getCacheUserId()).toBe('user-beta-002');

    setCacheUserId(null);
    expect(getCacheUserId()).toBeNull();
  });

  it('setCacheUserId preserves string values', () => {
    setCacheUserId('a'.repeat(100));
    expect(getCacheUserId()).toBe('a'.repeat(100));
  });
});
