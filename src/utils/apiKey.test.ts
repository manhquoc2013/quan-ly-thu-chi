import { describe, expect, it } from 'vitest';
import { sanitizeApiKey, validateApiKey } from './apiKey';

describe('apiKey utils', () => {
  it('strips Bearer prefix and whitespace', () => {
    expect(sanitizeApiKey('  Bearer sk-or-v1-abc\n123  ')).toBe('sk-or-v1-abc123');
  });

  it('rejects oversized keys (prevents HTTP 431)', () => {
    const huge = `sk-or-v1-${'a'.repeat(600)}`;
    const result = validateApiKey(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toMatch(/quá dài/);
  });

  it('accepts normal OpenRouter keys', () => {
    const result = validateApiKey('sk-or-v1-abcdef0123456789');
    expect(result).toEqual({ ok: true, key: 'sk-or-v1-abcdef0123456789' });
  });
});
