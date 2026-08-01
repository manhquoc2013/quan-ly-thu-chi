/**
 * Order platform CRUD + seed defaults.
 */

import type { OrderPlatform } from '@/models';
import {
  DEFAULT_PLATFORM_SEEDS,
  PLATFORM_DIRECT_ID,
} from '@/models/platform';
import { usePlatformStore } from '@/store/platformStore';
import { useRevenueStore } from '@/store/revenueStore';
import { notify, type NotifyOpts } from '@/utils/notify';
import { cacheGet, cacheSet } from './cacheManager';

const CACHE_KEY = 'orderPlatforms';

function assertName(name: string): void {
  if (name.trim().length < 2 || name.trim().length > 80) {
    throw new Error('Tên kênh phải từ 2–80 ký tự');
  }
}

export async function getAllPlatforms(): Promise<OrderPlatform[]> {
  let records = await cacheGet<OrderPlatform[]>(CACHE_KEY);
  if (!records || records.length === 0) {
    const now = new Date().toISOString();
    records = DEFAULT_PLATFORM_SEEDS.map((s) => ({ ...s, createdAt: now }));
    await cacheSet(CACHE_KEY, records);
  } else {
    // Ensure direct platform exists for upgrades
    if (!records.some((p) => p.id === PLATFORM_DIRECT_ID || p.code === 'direct')) {
      records = [
        {
          ...DEFAULT_PLATFORM_SEEDS[0]!,
          createdAt: new Date().toISOString(),
        },
        ...records,
      ];
      await cacheSet(CACHE_KEY, records);
    }
  }
  usePlatformStore.getState().setPlatforms(records);
  return records;
}

export function getDefaultPlatformId(): string {
  const list = usePlatformStore.getState().platforms;
  const direct =
    list.find((p) => p.id === PLATFORM_DIRECT_ID) ||
    list.find((p) => p.code === 'direct') ||
    list.find((p) => p.active);
  return direct?.id ?? PLATFORM_DIRECT_ID;
}

export function getActivePlatforms(): OrderPlatform[] {
  return usePlatformStore
    .getState()
    .platforms.filter((p) => p.active)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export async function createPlatform(
  data: Omit<OrderPlatform, 'id' | 'createdAt'>,
  opts?: NotifyOpts,
): Promise<OrderPlatform> {
  assertName(data.name);
  const name = data.name.trim();
  const code = data.code?.trim().toLowerCase() || undefined;
  const existing = (await cacheGet<OrderPlatform[]>(CACHE_KEY)) ?? [];
  if (code && existing.some((p) => p.code === code)) {
    throw new Error(`Mã kênh “${code}” đã tồn tại`);
  }
  if (existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`Kênh “${name}” đã tồn tại`);
  }

  const record: OrderPlatform = {
    id: crypto.randomUUID(),
    name,
    code,
    active: data.active ?? true,
    createdAt: new Date().toISOString(),
  };
  const updated = [...existing, record];
  await cacheSet(CACHE_KEY, updated);
  usePlatformStore.getState().setPlatforms(updated);
  notify.success(`Đã thêm kênh: ${record.name}`, opts);
  return record;
}

export async function updatePlatform(
  id: string,
  patch: Partial<Omit<OrderPlatform, 'id' | 'createdAt'>>,
  opts?: NotifyOpts,
): Promise<OrderPlatform | undefined> {
  const existing = (await cacheGet<OrderPlatform[]>(CACHE_KEY)) ?? [];
  const idx = existing.findIndex((p) => p.id === id);
  if (idx === -1) {
    notify.error('Không tìm thấy kênh', opts);
    return undefined;
  }
  if (patch.name !== undefined) assertName(patch.name);
  const current = existing[idx]!;
  const updated: OrderPlatform = {
    ...current,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : current.name,
    code:
      patch.code !== undefined
        ? patch.code.trim().toLowerCase() || undefined
        : current.code,
  };
  const updatedAll = [...existing];
  updatedAll[idx] = updated;
  await cacheSet(CACHE_KEY, updatedAll);
  usePlatformStore.getState().setPlatforms(updatedAll);
  notify.success(`Đã cập nhật kênh: ${updated.name}`, opts);
  return updated;
}

export async function deletePlatform(id: string, opts?: NotifyOpts): Promise<void> {
  if (id === PLATFORM_DIRECT_ID) {
    notify.error('Không thể xóa kênh mặc định “Trực tiếp”', opts);
    throw new Error('Không thể xóa kênh mặc định');
  }
  const used = useRevenueStore.getState().records.some((r) => r.platformId === id);
  if (used) {
    notify.error('Không thể xóa kênh còn gắn đơn hàng', opts);
    throw new Error('Không thể xóa kênh còn gắn đơn hàng');
  }
  const existing = (await cacheGet<OrderPlatform[]>(CACHE_KEY)) ?? [];
  const updated = existing.filter((p) => p.id !== id);
  await cacheSet(CACHE_KEY, updated);
  usePlatformStore.getState().setPlatforms(updated);
  notify.success('Đã xóa kênh', opts);
}
