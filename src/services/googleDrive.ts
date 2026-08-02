/**
 * Google Drive — GIS OAuth + app-data.json sync (IndexedDB snapshot).
 *
 * Requires VITE_GOOGLE_CLIENT_ID. Never uses client_secret in the browser.
 */

import { cacheGet, cacheSet, cacheDelete } from './cacheManager';

const TOKEN_KEY = 'google_drive_token';
const FOLDER_NAME = 'QuanLyThuChi';
const DATA_FILE_NAME = 'app-data.json';
const SYNC_VERSION = 1;
const DATA_KEYS = ['expenses', 'revenues', 'customers', 'products', 'orderPlatforms'] as const;

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
}

interface StoredToken {
  access_token: string;
  expires_at: number;
  email?: string;
  name?: string;
  picture?: string;
}

export interface AppDataSnapshot {
  version: number;
  exportedAt: string;
  expenses: unknown[];
  revenues: unknown[];
  customers: unknown[];
  products: unknown[];
  orderPlatforms: unknown[];
}

export interface DriveUser {
  email: string;
  name: string;
  picture?: string;
}

export type SyncDirection = 'pulled' | 'pushed' | 'noop';

export interface SyncResult {
  direction: SyncDirection;
  exportedAt: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

let accessToken: string | null = null;
let tokenMeta: StoredToken | null = null;
let gisLoadPromise: Promise<void> | null = null;

function getClientId(): string | undefined {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  return id?.trim() || undefined;
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(getClientId());
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function isDriveConnected(): boolean {
  return Boolean(accessToken && tokenMeta && tokenMeta.expires_at > Date.now());
}

export function getDriveUser(): DriveUser | null {
  if (!tokenMeta?.email) return null;
  return {
    email: tokenMeta.email,
    name: tokenMeta.name ?? tokenMeta.email,
    picture: tokenMeta.picture,
  };
}

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Không tải được Google Identity Services')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.gis = '1';
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Không tải được Google Identity Services'));
    };
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

async function persistToken(token: StoredToken): Promise<void> {
  tokenMeta = token;
  accessToken = token.access_token;
  await cacheSet(TOKEN_KEY, token);
}

async function clearToken(): Promise<void> {
  accessToken = null;
  tokenMeta = null;
  await cacheDelete(TOKEN_KEY);
}

async function fetchUserProfile(token: string): Promise<Pick<StoredToken, 'email' | 'name' | 'picture'>> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as { email?: string; name?: string; picture?: string };
  return { email: data.email, name: data.name, picture: data.picture };
}

async function ensureFreshToken(): Promise<string> {
  if (accessToken && tokenMeta && tokenMeta.expires_at > Date.now() + 60_000) {
    return accessToken;
  }

  const cached = await cacheGet<StoredToken>(TOKEN_KEY);
  if (cached?.access_token && cached.expires_at > Date.now() + 60_000) {
    tokenMeta = cached;
    accessToken = cached.access_token;
    return accessToken;
  }

  try {
    await connectGoogleDrive({ silent: true });
  } catch {
    await clearToken();
    throw new Error('Phiên Google Drive đã hết hạn — kết nối lại trong Cài đặt');
  }
  if (!accessToken) {
    throw new Error('Chưa kết nối Google Drive');
  }
  return accessToken;
}

/**
 * Start GIS token OAuth. `silent` reuses consent when possible (token refresh UX).
 */
export async function connectGoogleDrive(opts?: { silent?: boolean }): Promise<boolean> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error(
      'Thiếu VITE_GOOGLE_CLIENT_ID. Thêm vào .env.local (dev) hoặc GitHub Actions secret (deploy).',
    );
  }

  await loadGisScript();
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services chưa sẵn sàng');
  }

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        void (async () => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error || 'Người dùng từ chối hoặc OAuth thất bại'));
            return;
          }
          const expiresIn = response.expires_in ?? 3600;
          const profile = await fetchUserProfile(response.access_token);
          await persistToken({
            access_token: response.access_token,
            expires_at: Date.now() + expiresIn * 1000,
            ...profile,
          });
          resolve(true);
        })();
      },
      error_callback: (err) => {
        reject(new Error(err.message || err.type || 'OAuth lỗi'));
      },
    });

    client.requestAccessToken({ prompt: opts?.silent ? '' : 'consent' });
  });
}

export async function disconnectDrive(): Promise<void> {
  const token = accessToken;
  await clearToken();
  if (token && window.google?.accounts?.oauth2) {
    await new Promise<void>((resolve) => {
      window.google!.accounts.oauth2.revoke(token, () => resolve());
    });
  }
}

export async function restoreDriveToken(): Promise<boolean> {
  const cached = await cacheGet<StoredToken>(TOKEN_KEY);
  if (!cached?.access_token) {
    await clearToken();
    return false;
  }
  if (cached.expires_at <= Date.now()) {
    await clearToken();
    return false;
  }
  tokenMeta = cached;
  accessToken = cached.access_token;
  return true;
}

async function driveRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await ensureFreshToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function ensureFolder(): Promise<string> {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const listed = await driveRequest<{ files: DriveFile[] }>(
    `/files?q=${q}&fields=files(id,name)&spaces=drive&pageSize=1`,
  );
  if (listed.files[0]?.id) return listed.files[0].id;

  const created = await driveRequest<DriveFile>('/files?fields=id,name', {
    method: 'POST',
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  return created.id;
}

async function findDataFile(folderId: string): Promise<DriveFile | null> {
  const q = encodeURIComponent(
    `name='${DATA_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
  );
  const listed = await driveRequest<{ files: DriveFile[] }>(
    `/files?q=${q}&fields=files(id,name,modifiedTime)&spaces=drive&pageSize=1`,
  );
  return listed.files[0] ?? null;
}

export async function buildLocalSnapshot(): Promise<AppDataSnapshot> {
  const [expenses, revenues, customers, products, orderPlatforms] = await Promise.all(
    DATA_KEYS.map((key) => cacheGet<unknown[]>(key).then((v) => v ?? [])),
  );
  return {
    version: SYNC_VERSION,
    exportedAt: new Date().toISOString(),
    expenses: expenses as unknown[],
    revenues: revenues as unknown[],
    customers: customers as unknown[],
    products: products as unknown[],
    orderPlatforms: orderPlatforms as unknown[],
  };
}

export async function applySnapshot(snapshot: AppDataSnapshot): Promise<void> {
  await Promise.all([
    cacheSet('expenses', snapshot.expenses ?? []),
    cacheSet('revenues', snapshot.revenues ?? []),
    cacheSet('customers', snapshot.customers ?? []),
    cacheSet('products', snapshot.products ?? []),
    cacheSet('orderPlatforms', snapshot.orderPlatforms ?? []),
  ]);
}

export async function syncFromDrive(): Promise<AppDataSnapshot | null> {
  if (!isDriveConnected() && !(await restoreDriveToken())) return null;
  try {
    const folderId = await ensureFolder();
    const file = await findDataFile(folderId);
    if (!file) return null;

    const token = await ensureFreshToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AppDataSnapshot;
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (err) {
    console.error('syncFromDrive failed:', err);
    throw err;
  }
}

export async function syncToDrive(snapshot?: AppDataSnapshot): Promise<AppDataSnapshot> {
  const payload = snapshot ?? (await buildLocalSnapshot());
  const folderId = await ensureFolder();
  const existing = await findDataFile(folderId);
  const body = JSON.stringify(payload);
  const metadata = existing
    ? { name: DATA_FILE_NAME, mimeType: 'application/json' }
    : { name: DATA_FILE_NAME, mimeType: 'application/json', parents: [folderId] };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([body], { type: 'application/json' }));

  const token = await ensureFreshToken();
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const res = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload Drive thất bại (${res.status}): ${text || res.statusText}`);
  }
  return payload;
}

function isSnapshotEmpty(snapshot: AppDataSnapshot): boolean {
  return DATA_KEYS.every((key) => {
    const rows = snapshot[key];
    return !Array.isArray(rows) || rows.length === 0;
  });
}

/**
 * Sync strategy:
 * - No remote → push local
 * - Local empty + remote has data → pull
 * - Otherwise → push local (device is source of truth)
 */
export async function syncAppData(): Promise<SyncResult> {
  const local = await buildLocalSnapshot();
  const remote = await syncFromDrive();

  if (!remote) {
    const pushed = await syncToDrive(local);
    await cacheSet('drive_last_sync_at', pushed.exportedAt);
    return { direction: 'pushed', exportedAt: pushed.exportedAt };
  }

  if (isSnapshotEmpty(local) && !isSnapshotEmpty(remote)) {
    await applySnapshot(remote);
    await cacheSet('drive_last_sync_at', remote.exportedAt);
    return { direction: 'pulled', exportedAt: remote.exportedAt };
  }

  const pushed = await syncToDrive(local);
  await cacheSet('drive_last_sync_at', pushed.exportedAt);
  return { direction: 'pushed', exportedAt: pushed.exportedAt };
}

/** Force overwrite local cache from Drive. */
export async function restoreFromDrive(): Promise<AppDataSnapshot> {
  const remote = await syncFromDrive();
  if (!remote) throw new Error('Chưa có dữ liệu trên Google Drive');
  await applySnapshot(remote);
  await cacheSet('drive_last_sync_at', remote.exportedAt);
  return remote;
}

/** @deprecated Prefer syncToDrive / syncAppData — kept for barrel compat. */
export async function uploadInvoiceImage(file: File): Promise<string | null> {
  if (!isDriveConnected() && !(await restoreDriveToken())) {
    return `local_${crypto.randomUUID()}`;
  }
  try {
    const folderId = await ensureFolder();
    const q = encodeURIComponent(
      `name='invoices' and '${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const listed = await driveRequest<{ files: DriveFile[] }>(`/files?q=${q}&fields=files(id)&pageSize=1`);
    let invFolderId = listed.files[0]?.id;
    if (!invFolderId) {
      const created = await driveRequest<DriveFile>('/files?fields=id', {
        method: 'POST',
        body: JSON.stringify({
          name: 'invoices',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [folderId],
        }),
      });
      invFolderId = created.id;
    }

    const metadata = {
      name: `inv_${Date.now()}_${file.name}`,
      mimeType: file.type || 'application/octet-stream',
      parents: [invFolderId],
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const token = await ensureFreshToken();
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) return null;
    const result = (await res.json()) as DriveFile;
    return result.id;
  } catch (err) {
    console.error('uploadInvoiceImage failed:', err);
    return null;
  }
}
