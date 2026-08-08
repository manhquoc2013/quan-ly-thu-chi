/**
 * Product CRUD + search helpers.
 */

import type { Product } from '@/models';
import { useProductStore } from '@/store/productStore';
import { useRevenueStore } from '@/store/revenueStore';
import { notify, type NotifyOpts } from '@/utils/notify';
import { cacheGet, cacheSet } from './cacheManager';

const CACHE_KEY = 'products';

/** Names that are counted as animals / plush → unit "con". */
const ANIMAL_PRODUCT_RE =
  /thú|vịt|chó|mèo|gấu|thỏ|cáo|chim|trâu|cánh\s*cụt|penguin|hello\s*kitty|luffy|nhồi\s*bông/i;

export function isAnimalProductName(name: string): boolean {
  return ANIMAL_PRODUCT_RE.test(name.trim());
}

/** Default unit from product name (thú/vịt/… → con; else cái). */
export function guessProductUnit(name: string): string {
  if (isAnimalProductName(name)) return 'con';
  return 'cái';
}

/** Strip chat noise so "đơn vị các sản phẩm thú" → "thú". */
export function cleanProductSearchHint(raw: string): string {
  return raw
    .trim()
    .replace(
      /(?:sửa|đổi|đặt|chỉnh)\s*(?:lại\s*)?(?:đơn\s*)?vị(?:\s+(?:của|cho|thành|là))?\s*/gi,
      ' ',
    )
    .replace(/\b(?:các|những|của|cho|thành|là|=)\b/gi, ' ')
    .replace(/\b(?:sản\s*phẩm|sp|đơn\s*vị|unit)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Local parse: "sửa đơn vị các sản phẩm thú là con" / "đổi đơn vị Hello Kitty thành cái"
 */
export function parseProductUnitUpdateMessage(message: string): {
  targetHint: string;
  unit: string;
  categoryBulk: boolean;
} | null {
  const t = message.trim();
  const m =
    /(?:sửa|đổi|đặt|chỉnh|để)\s*(?:lại\s*)?(?:đơn\s*)?vị(?:\s+(?:của|cho))?\s+(.+?)\s+(?:thành|là|=)\s*([a-zA-Zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)\s*$/i.exec(
      t,
    );
  if (!m) return null;
  const rawTarget = m[1]!.trim();
  const unit = m[2]!.trim().toLowerCase();
  if (unit.length < 1 || unit.length > 30) return null;
  const targetHint = cleanProductSearchHint(rawTarget) || cleanProductSearchHint(t);
  if (!targetHint) return null;
  const categoryBulk =
    /(?:các|những)\s+(?:sản\s*phẩm|sp)/i.test(rawTarget) ||
    /^(?:thú|vịt|chó|mèo|gấu|thỏ)$/i.test(targetHint);
  return { targetHint, unit, categoryBulk };
}

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

const SKU_PAD = 4;

/** Pure numeric SKU → number; else null. */
export function parseNumericSku(sku: string): number | null {
  const t = sku.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** Next sequential SKU: 0001, 0002, … (padded to ≥4 digits). */
export function nextSeqSku(usedLower: Set<string>): string {
  let max = 0;
  for (const s of usedLower) {
    const n = parseNumericSku(s);
    if (n !== null && n > max) max = n;
  }
  let next = max + 1;
  let candidate = String(next).padStart(SKU_PAD, '0');
  while (usedLower.has(candidate.toLowerCase())) {
    next += 1;
    candidate = String(next).padStart(SKU_PAD, '0');
  }
  return candidate;
}

export function buildSkuForProduct(_name: string | undefined, usedLower: Set<string>): string {
  return nextSeqSku(usedLower);
}

/**
 * Assign SKUs to products (sequential numeric).
 * @param onlyMissing — default true: skip products that already have sku
 */
export async function generateSkusForProducts(
  opts?: { onlyMissing?: boolean } & NotifyOpts,
): Promise<{ updated: Product[]; skipped: number }> {
  const onlyMissing = opts?.onlyMissing !== false;
  const existing = (await cacheGet<Product[]>(CACHE_KEY)) ?? [];
  const used = new Set<string>();
  if (onlyMissing) {
    for (const p of existing) {
      const s = p.sku?.trim();
      if (s) used.add(s.toLowerCase());
    }
  }

  const updated: Product[] = [];
  let skipped = 0;
  const nextAll = existing.map((p) => {
    if (onlyMissing && p.sku?.trim()) {
      skipped += 1;
      return p;
    }
    const sku = nextSeqSku(used);
    used.add(sku.toLowerCase());
    const row: Product = { ...p, sku };
    updated.push(row);
    return row;
  });

  if (updated.length === 0) {
    notify.success('Tất cả sản phẩm đã có mã SKU', opts);
    return { updated, skipped };
  }

  await cacheSet(CACHE_KEY, nextAll);
  useProductStore.getState().setProducts(nextAll);
  for (const p of updated) {
    void import('./cloudSync')
      .then((m) => m.cloudUpsertProduct(p))
      .catch((err) => console.error('[cloud] product sku', err));
  }
  notify.success(`Đã gán SKU cho ${updated.length} sản phẩm`, opts);
  return { updated, skipped };
}

/** True when message asks to auto-generate product SKUs. */
export function looksLikeGenerateSkuMessage(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (!/(?:mã\s*)?sku|mã\s*sp|mã\s*hàng/.test(t)) return false;
  return /(?:tạo|sinh|gán|cấp|generate|auto)/i.test(t);
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
  const unit = (data.unit || guessProductUnit(name)).trim();
  assertUnit(unit);
  const existing = (await cacheGet<Product[]>(CACHE_KEY)) ?? [];
  const used = new Set(
    existing
      .map((p) => p.sku?.trim().toLowerCase())
      .filter((s): s is string => Boolean(s)),
  );
  const sku = data.sku?.trim() || buildSkuForProduct(name, used);
  const notes = data.notes?.trim() || undefined;

  const record: Product = {
    id: crypto.randomUUID(),
    name,
    defaultUnitPrice: Math.round(data.defaultUnitPrice),
    unit,
    sku,
    notes,
    imagePath: data.imagePath,
    createdAt: new Date().toISOString(),
  };

  const updated = [...existing, record];
  await cacheSet(CACHE_KEY, updated);
  useProductStore.getState().setProducts(updated);
  void import('./cloudSync')
    .then((m) => m.cloudUpsertProduct(record))
    .catch((err) => console.error('[cloud] product create', err));
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
  void import('./cloudSync')
    .then((m) => m.cloudUpsertProduct(updated))
    .catch((err) => console.error('[cloud] product update', err));
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
  void import('./cloudSync')
    .then((m) => m.cloudDeleteProduct(id))
    .catch((err) => console.error('[cloud] product delete', err));
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
