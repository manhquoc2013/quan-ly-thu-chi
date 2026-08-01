/**
 * Google Drive Service — OAuth2 authentication + file sync.
 *
 * Implements docs/01-architecture.md §6 and docs/05-technical-decisions.md §5.
 *
 * Flow:
 *   1. User clicks "Connect Google Drive" → OAuth2 popup
 *   2. Token stored in IndexedDB, auto-refreshed
 *   3. database.db synced: upload on save, download on startup if newer
 *   4. Invoice images stored in invoices/ folder
 *
 * Requires Google Cloud Console OAuth2 credentials in environment:
 *   VITE_GOOGLE_CLIENT_ID — OAuth2 client ID
 *   VITE_GOOGLE_API_KEY  — API key for Drive API
 *
 * Without these, falls back to stub mode (local-only, no sync).
 */

import { cacheGet, cacheSet } from './cacheManager';

const TOKEN_KEY = 'google_drive_token';
const FOLDER_NAME = 'QuanLyThuChi';
const DB_FILE_NAME = 'database.db';
const INVOICES_FOLDER = 'invoices';

// ── Types ─────────────────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

// ── State ─────────────────────────────────────────────────────────────────

let accessToken: string | null = null;

// ── Public API ────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  return accessToken;
}

export function isDriveConnected(): boolean {
  return accessToken !== null;
}

/**
 * Start Google OAuth2 implicit flow using popup.
 * Falls back to stub mode if VITE_GOOGLE_CLIENT_ID is not set.
 */
export async function connectGoogleDrive(): Promise<boolean> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    console.warn('VITE_GOOGLE_CLIENT_ID not set — using local-only mode');
    accessToken = 'stub_token';
    await cacheSet(TOKEN_KEY, { access_token: 'stub_token', expires_in: 3600 });
    return true;
  }

  return new Promise((resolve) => {
    const scope = 'https://www.googleapis.com/auth/drive.file';
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(window.location.origin)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=consent`;

    const popup = window.open(authUrl, 'GoogleOAuth', 'width=500,height=600');
    if (!popup) { resolve(false); return; }

    const timer = setInterval(() => {
      if (popup.closed) { clearInterval(timer); resolve(false); }
    }, 500);
  });
}

export async function disconnectDrive(): Promise<void> {
  accessToken = null;
  await cacheSet(TOKEN_KEY, null);
}

export async function restoreDriveToken(): Promise<boolean> {
  const cached = await cacheGet<{ access_token: string }>(TOKEN_KEY);
  if (cached?.access_token) {
    accessToken = cached.access_token;
    return true;
  }
  return false;
}

// ── Drive API ─────────────────────────────────────────────────────────────

async function driveRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!accessToken) throw new Error('Not connected to Google Drive');
  const apiKey = (import.meta.env.VITE_GOOGLE_API_KEY as string) || '';
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://www.googleapis.com/drive/v3${path}${sep}key=${apiKey}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers as Record<string, string>,
    },
  });
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  return res.json();
}

async function ensureFolder(): Promise<string> {
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const r = await driveRequest<{ files: DriveFile[] }>(`/files?q=${q}`);
  if (r.files.length > 0) return r.files[0]!.id;

  const created = await driveRequest<DriveFile>('/files', {
    method: 'POST',
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return created.id;
}

export async function syncFromDrive(): Promise<Uint8Array | null> {
  if (!accessToken) return null;
  try {
    const folderId = await ensureFolder();
    const q = encodeURIComponent(`name='${DB_FILE_NAME}' and '${folderId}' in parents and trashed=false`);
    const r = await driveRequest<{ files: DriveFile[] }>(`/files?q=${q}&fields=files(id)`);
    if (r.files.length === 0) return null;

    const apiKey = (import.meta.env.VITE_GOOGLE_API_KEY as string) || '';
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${r.files[0]!.id}?alt=media&key=${apiKey}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.error('syncFromDrive failed:', e);
    return null;
  }
}

export async function syncToDrive(binary: Uint8Array): Promise<void> {
  if (!accessToken) return;
  try {
    const folderId = await ensureFolder();
    const q = encodeURIComponent(`name='${DB_FILE_NAME}' and '${folderId}' in parents and trashed=false`);
    const r = await driveRequest<{ files: DriveFile[] }>(`/files?q=${q}`);

    const metadata = { name: DB_FILE_NAME, mimeType: 'application/octet-stream', parents: [folderId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([binary as BlobPart], { type: 'application/octet-stream' }));

    const apiKey = (import.meta.env.VITE_GOOGLE_API_KEY as string) || '';
    const url = r.files.length > 0
      ? `https://www.googleapis.com/upload/drive/v3/files/${r.files[0]!.id}?uploadType=multipart&key=${apiKey}`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&key=${apiKey}`;

    await fetch(r.files.length > 0 ? url : url.replace('files?', 'files?'), {
      method: r.files.length > 0 ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
  } catch (e) {
    console.error('syncToDrive failed:', e);
  }
}

export async function uploadInvoiceImage(file: File): Promise<string | null> {
  if (!accessToken) return `local_${crypto.randomUUID()}`;
  try {
    const folderId = await ensureFolder();
    const q = encodeURIComponent(`name='${INVOICES_FOLDER}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const sr = await driveRequest<{ files: DriveFile[] }>(`/files?q=${q}`);
    let invFolderId: string;
    if (sr.files.length > 0) {
      invFolderId = sr.files[0]!.id;
    } else {
      const c = await driveRequest<DriveFile>('/files', {
        method: 'POST',
        body: JSON.stringify({ name: INVOICES_FOLDER, mimeType: 'application/vnd.google-apps.folder', parents: [folderId] }),
      });
      invFolderId = c.id;
    }

    const metadata = {
      name: `inv_${Date.now()}_${file.name}`,
      mimeType: file.type,
      parents: [invFolderId],
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const apiKey = (import.meta.env.VITE_GOOGLE_API_KEY as string) || '';
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&key=${apiKey}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const result = await res.json() as DriveFile;
    return result.id;
  } catch (e) {
    console.error('uploadInvoiceImage failed:', e);
    return null;
  }
}
