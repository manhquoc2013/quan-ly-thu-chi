/**
 * Local sync outbox — coalesce pending upserts per (entity, entityId).
 * Phase 1 entities: profiles, user_settings.
 */

const STORAGE_KEY = 'ql-tc-sync-outbox';

export type OutboxEntity = 'profiles' | 'user_settings';
export type OutboxOp = 'upsert' | 'delete';

export interface OutboxItem {
  id: string;
  userId: string;
  entity: OutboxEntity;
  entityId: string;
  op: OutboxOp;
  payload: Record<string, unknown>;
  mutatedAt: string;
  tries: number;
  lastError: string | null;
}

type OutboxStore = Record<string, OutboxItem[]>;

/** In-memory fallback when localStorage is unavailable (Vitest / SSR). */
let memoryStore: OutboxStore = {};

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage != null;
  } catch {
    return false;
  }
}

function readStore(): OutboxStore {
  if (!canUseLocalStorage()) return memoryStore;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OutboxStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: OutboxStore): void {
  memoryStore = store;
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

export function listOutbox(userId: string): OutboxItem[] {
  return [...(readStore()[userId] ?? [])];
}

export function pendingCount(userId: string): number {
  return listOutbox(userId).length;
}

export function clearOutbox(userId: string): void {
  const store = { ...readStore() };
  delete store[userId];
  writeStore(store);
}

export function removeOutbox(id: string): void {
  const store = { ...readStore() };
  for (const uid of Object.keys(store)) {
    const next = (store[uid] ?? []).filter((item) => item.id !== id);
    if (next.length === 0) delete store[uid];
    else store[uid] = next;
  }
  writeStore(store);
}

export function updateOutboxError(id: string, lastError: string): void {
  const store = { ...readStore() };
  for (const uid of Object.keys(store)) {
    const items = [...(store[uid] ?? [])];
    const idx = items.findIndex((item) => item.id === id);
    if (idx >= 0) {
      const prev = items[idx]!;
      items[idx] = {
        ...prev,
        tries: prev.tries + 1,
        lastError,
      };
      store[uid] = items;
      writeStore(store);
      return;
    }
  }
}

export function enqueueOutbox(
  item: Omit<OutboxItem, 'id' | 'tries' | 'lastError'> & { id?: string },
): OutboxItem {
  const store = { ...readStore() };
  const list = [...(store[item.userId] ?? [])];
  const nextItem: OutboxItem = {
    id: item.id ?? crypto.randomUUID(),
    userId: item.userId,
    entity: item.entity,
    entityId: item.entityId,
    op: item.op,
    payload: item.payload,
    mutatedAt: item.mutatedAt,
    tries: 0,
    lastError: null,
  };

  if (item.op === 'upsert') {
    const existingIdx = list.findIndex(
      (row) => row.entity === item.entity && row.entityId === item.entityId && row.op === 'upsert',
    );
    if (existingIdx >= 0) {
      const keepId = list[existingIdx]!.id;
      list[existingIdx] = { ...nextItem, id: keepId };
      store[item.userId] = list;
      writeStore(store);
      return list[existingIdx]!;
    }
  }

  list.push(nextItem);
  store[item.userId] = list;
  writeStore(store);
  return nextItem;
}
