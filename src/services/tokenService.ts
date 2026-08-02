/**
 * Session token management using Web Crypto API (HMAC-SHA256).
 *
 * Token format: base64url(JSON payload).hex(HMAC-SHA256 signature)
 * Stored in sessionStorage under key `ql-tc-session`.
 */

const TOKEN_STORAGE_KEY = 'ql-tc-session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SessionToken {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface SignedToken {
  payload: SessionToken;
  signature: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64urlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(encoded: string): string {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) { base64 += '='; }
  return atob(base64);
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function deriveHmacKey(passwordHash: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passwordHash),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// ─── Token operations ───────────────────────────────────────────────────────

/** Generate a signed session token. Returns `base64url(payload).hex(signature)`. */
export async function generateToken(userId: string, passwordHash: string): Promise<string> {
  const now = Date.now();
  const payload: SessionToken = { userId, issuedAt: now, expiresAt: now + SESSION_DURATION_MS };
  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = base64urlEncode(payloadJson);
  const key = await deriveHmacKey(passwordHash);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadEncoded));
  const signatureHex = toHex(sigBuf);
  const token = `${payloadEncoded}.${signatureHex}`;
  storeToken(token);
  return token;
}

/** Parse a token string into SessionToken, or null if malformed/expired. */
export function parseToken(token: string): SessionToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const part0 = parts[0];
    if (!part0) return null;
    const payloadJson = base64urlDecode(part0);
    const payload = JSON.parse(payloadJson) as SessionToken;
    if (typeof payload.userId !== 'string' || typeof payload.issuedAt !== 'number' || typeof payload.expiresAt !== 'number') return null;
    return payload;
  } catch { return null; }
}

/** Verify a token: check signature and expiration. Returns true if valid. */
export async function verifyToken(token: string, passwordHash: string): Promise<boolean> {
  const session = parseToken(token);
  if (!session) return false;
  if (session.expiresAt <= Date.now()) return false;
  const key = await deriveHmacKey(passwordHash);
  const payloadEncoded = base64urlEncode(JSON.stringify(session));
  const sigPart = token.split('.')[1];
  if (!sigPart) return false;
  const sigBytes = fromHex(sigPart);
  const sigBuf = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes.buffer as ArrayBuffer,
    new TextEncoder().encode(payloadEncoded),
  );
  return sigBuf;
}

/** Refresh a token: if valid, generate a new one with extended expiry. Returns null if expired. */
export async function refreshToken(token: string, passwordHash: string): Promise<string | null> {
  const session = parseToken(token);
  if (!session || session.expiresAt <= Date.now()) return null;
  return generateToken(session.userId, passwordHash);
}

/** Check whether a raw token string is expired. */
export function isTokenExpired(token: string): boolean {
  const session = parseToken(token);
  if (!session) return true;
  return session.expiresAt <= Date.now();
}

/** Get remaining milliseconds until expiry, or 0 if expired/malformed. */
export function getRemainingTime(token: string): number {
  const session = parseToken(token);
  if (!session) return 0;
  const remaining = session.expiresAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

// ─── Storage helpers ────────────────────────────────────────────────────────

export function storeToken(token: string): void { sessionStorage.setItem(TOKEN_STORAGE_KEY, token); }
export function getStoredToken(): string | null { return sessionStorage.getItem(TOKEN_STORAGE_KEY); }
export function clearToken(): void { sessionStorage.removeItem(TOKEN_STORAGE_KEY); }
