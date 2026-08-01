/**
 * Product CRUD + search helpers.
 */

import type { Product } from '@/models';
import { useProductStore } from '@/store/productStore';
import { useRevenueStore } from '@/store/revenueStore';
import { notify, type NotifyOpts } from '@/utils/notify';
import { cacheGet, cacheSet } from './cacheManager';

const CACHE_KEY = 'products';

function assertName(name: string): void {
  if (name.trim().length < 2 || name.trim().length > 100) {
    throw new Error('Tên sản phẩm phải từ 2–100 ký tự');
  }
}

function assertPrice(price: number): void {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    throw new Error('Đơn giá mặc định phải ≥ 0');
  }
}

function assertUnit(unit: string): void {
  if (!unit.trim() || unit.trim().length > 30) {
    throw new Error('Đơn vị bắt buộc (tối đa 30 ký tự)');
  }
}

export async function getAllProducts(): Promise<Product[]> {
  const records = await cacheGet<Product[]>(CACHE_KEY);
  useProductStore.getState().setProducts(records ?? []);
  return records ?? [];
}

export async function createProduct(
  data: Omit<Product, 'id' | 'createdAt'>,
  opts?: NotifyOpts,
): Promise<Product> {
  const name = data.name.trim();
  assertName(name);
  assertPrice(data.defaultUnitPrice);
  const unit = (data.unit || 'cái').trim();
  assertUnit(unit);
  const sku = data.sku?.trim() || undefined;
  const notes = data.notes?.trim() || undefined;

  const record: Product = {
    id: crypto.randomUUID(),
    name,
    defaultUnitPrice: Math.round(data.defaultUnitPrice),
    unit,
    sku,
    notes,
    createdAt: new Date().toISOString(),
  };

  const existing = (await cacheGet<Product[]>(CACHE_KEY)) ?? [];
  const updated = [...existing, record];
  await cacheSet(CACHE_KEY, updated);
  useProductStore.getState().setProducts(updated);
  notify.success(`Đã thêm SP: ${record.name}`, opts);
  return record;
}

export async function updateProduct(
  id: string,
  patch: Partial<Omit<Product, 'id' | 'createdAt'>>,
  opts?: NotifyOpts,
): Promise<Product | undefined> {
  const existing = (await cacheGet<Product[]>(CACHE_KEY)) ?? [];
  const idx = existing.findIndex((p) => p.id === id);
  if (idx === -1) {
    notify.error('Không tìm thấy sản phẩm', opts);
    return undefined;
  }
  if (patch.name !== undefined) assertName(patch.name);
  if (patch.defaultUnitPrice !== undefined) assertPrice(patch.defaultUnitPrice);
  if (patch.unit !== undefined) assertUnit(patch.unit);

  const current = existing[idx]!;
  const updated: Product = {
    ...current,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : current.name,
    unit: patch.unit !== undefined ? patch.unit.trim() : current.unit,
    sku: patch.sku !== undefined ? patch.sku.trim() || undefined : current.sku,
    notes: patch.notes !== undefined ? patch.notes.trim() || undefined : current.notes,
    defaultUnitPrice:
      patch.defaultUnitPrice !== undefined
        ? Math.round(patch.defaultUnitPrice)
        : current.defaultUnitPrice,
  };
  const updatedAll = [...existing];
  updatedAll[idx] = updated;
  await cacheSet(CACHE_KEY, updatedAll);
  useProductStore.getState().setProducts(updatedAll);
  notify.success(`Đã cập nhật SP: ${updated.name}`, opts);
  return updated;
}

export async function deleteProduct(id: string, opts?: NotifyOpts): Promise<void> {
  const revenues = useRevenueStore.getState().records;
  const used = revenues.some((r) => r.items.some((it) => it.productId === id));
  if (used) {
    notify.error('Không thể xóa sản phẩm còn gắn đơn hàng', opts);
    throw new Error('Không thể xóa sản phẩm còn gắn đơn hàng');
  }
  const existing = (await cacheGet<Product[]>(CACHE_KEY)) ?? [];
  const updated = existing.filter((p) => p.id !== id);
  await cacheSet(CACHE_KEY, updated);
  useProductStore.getState().setProducts(updated);
  notify.success('Đã xóa sản phẩm', opts);
}

export function searchProducts(query: string, limit = 20): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return useProductStore.getState().products.slice(0, limit);
  return useProductStore
    .getState()
    .products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, limit);
}
