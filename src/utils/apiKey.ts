/**
 * Normalize provider API keys pasted from dashboards / password managers.
 * Prevents HTTP 431 (header too large) from whitespace, "Bearer " prefix, or junk.
 */

const MAX_API_KEY_LEN = 512;

export function sanitizeApiKey(raw: string): string {
  let key = raw.trim();
  // Strip accidental "Bearer " prefix
  key = key.replace(/^Bearer\s+/i, '');
  // Remove all whitespace / newlines (common when copying from emails)
  key = key.replace(/\s+/g, '');
  // Drop non-ASCII (headers must be ISO-8859-1; keys are always ASCII)
  key = key.replace(/[^\x20-\x7E]/g, '');
  return key;
}

export function validateApiKey(raw: string): { ok: true; key: string } | { ok: false; detail: string } {
  const key = sanitizeApiKey(raw);
  if (!key) return { ok: false, detail: 'API key trống' };
  if (key.length > MAX_API_KEY_LEN) {
    return {
      ok: false,
      detail: `API key quá dài (${key.length} ký tự). Chỉ dán đúng key (thường sk-or-v1-…), không dán cả JSON/token.`,
    };
  }
  return { ok: true, key };
}
