/**
 * Entity resolve — customer / product matching for AI order create.
 *
 * Rules (spec C + exact shortcut):
 * - Unique exact name → auto-use
 * - 0 partial matches → auto-create
 * - Otherwise (≥1 partial, or duplicate exact) → ambiguous (user picks)
 */

import type { Customer, Product, OrderPlatform } from '@/models';
import { useCustomerStore } from '@/store/customerStore';
import { useProductStore } from '@/store/productStore';
import { usePlatformStore } from '@/store/platformStore';
import { createCustomer } from './customerService';
import { createProduct } from './productService';
import { createPlatform, getDefaultPlatformId } from './platformService';
import type { NotifyOpts } from '@/utils/notify';

export interface EntityOption {
  id: string;
  label: string;
}

export type ResolveOk = {
  status: 'resolved';
  id: string;
  name: string;
  created: boolean;
  defaultUnitPrice?: number;
};

export type ResolveAmbiguous = {
  status: 'ambiguous';
  kind: 'customer' | 'product' | 'platform';
  query: string;
  options: EntityOption[];
};

export type ResolveWalkIn = { status: 'walk-in'; id: 'walk-in'; name: string };

export type ResolveResult = ResolveOk | ResolveAmbiguous | ResolveWalkIn;

function norm(s: string): string {
  return s.trim().toLowerCase().normalize('NFC');
}

/** Strip leading "2 × " / qty from product description for matching */
export function productQueryFromDescription(description: string): string {
  return description
    .replace(/^\d+\s*[×x]\s*/i, '')
    .replace(/^SL\s*\d+\s*/i, '')
    .trim();
}

function partialMatches<T extends { name: string; code?: string }>(items: T[], query: string): T[] {
  const q = norm(query);
  if (!q) return [];
  return items.filter((item) => {
    const n = norm(item.name);
    const code = item.code ? norm(item.code) : '';
    return n.includes(q) || q.includes(n) || (code && (code === q || code.includes(q)));
  });
}

function formatCustomerLabel(c: Customer): string {
  const phone = c.phone ? ` — ${c.phone}` : '';
  return `${c.name}${phone}`;
}

function formatProductLabel(p: Product): string {
  const sku = p.sku ? ` [${p.sku}]` : '';
  const price = p.defaultUnitPrice
    ? ` — ${p.defaultUnitPrice.toLocaleString('vi-VN')}₫/${p.unit}`
    : ` — ${p.unit}`;
  return `${p.name}${sku}${price}`;
}

function formatPlatformLabel(p: OrderPlatform): string {
  return p.code ? `${p.name} (${p.code})` : p.name;
}

export function formatEntityPickMessage(
  kind: 'customer' | 'product' | 'platform',
  query: string,
  options: EntityOption[],
): string {
  const noun =
    kind === 'customer' ? 'khách hàng' : kind === 'product' ? 'sản phẩm' : 'kênh đặt hàng';
  const lines = options.map((o, i) => `${i + 1}. ${o.label}`);
  return [
    `Có ${options.length} ${noun} khớp “${query}”:`,
    ...lines,
    `0. Tạo ${noun} mới “${query}”`,
    'Trả lời **số** để chọn (hoặc `hủy`).',
  ].join('\n');
}

export async function resolveCustomerForOrder(
  query: string | undefined,
  opts?: {
    customerId?: string;
    forceCreate?: boolean;
    silent?: boolean;
  },
): Promise<ResolveResult> {
  if (opts?.customerId && opts.customerId !== 'walk-in') {
    const found = useCustomerStore.getState().customers.find((c) => c.id === opts.customerId);
    if (found) return { status: 'resolved', id: found.id, name: found.name, created: false };
  }

  const name = query?.trim();
  if (!name) return { status: 'walk-in', id: 'walk-in', name: 'Khách vãng lai' };

  if (opts?.forceCreate) {
    const created = await createCustomer(
      { name, phone: '' },
      { silent: opts.silent ?? true },
    );
    return { status: 'resolved', id: created.id, name: created.name, created: true };
  }

  const all = useCustomerStore.getState().customers;
  const matches = partialMatches(all, name);
  const exact = matches.filter((c) => norm(c.name) === norm(name));

  if (exact.length === 1) {
    const c = exact[0]!;
    return { status: 'resolved', id: c.id, name: c.name, created: false };
  }

  if (matches.length === 0) {
    const created = await createCustomer(
      { name, phone: '' },
      { silent: opts?.silent ?? true },
    );
    return { status: 'resolved', id: created.id, name: created.name, created: true };
  }

  const list = exact.length > 1 ? exact : matches;
  return {
    status: 'ambiguous',
    kind: 'customer',
    query: name,
    options: list.slice(0, 10).map((c) => ({ id: c.id, label: formatCustomerLabel(c) })),
  };
}

export async function resolveProductForOrder(
  description: string,
  opts?: {
    productId?: string;
    forceCreate?: boolean;
    suggestedPrice?: number;
    silent?: boolean;
  },
): Promise<ResolveResult> {
  if (opts?.productId) {
    const found = useProductStore.getState().products.find((p) => p.id === opts.productId);
    if (found) {
      return {
        status: 'resolved',
        id: found.id,
        name: found.name,
        created: false,
        defaultUnitPrice: found.defaultUnitPrice,
      };
    }
  }

  const query = productQueryFromDescription(description);
  if (query.length < 2) {
    throw new Error('Tên sản phẩm quá ngắn');
  }

  const notifyOpts: NotifyOpts = { silent: opts?.silent ?? true };
  const price = Math.max(0, Math.round(opts?.suggestedPrice ?? 0));

  if (opts?.forceCreate) {
    const created = await createProduct(
      { name: query, defaultUnitPrice: price, unit: 'cái' },
      notifyOpts,
    );
    return {
      status: 'resolved',
      id: created.id,
      name: created.name,
      created: true,
      defaultUnitPrice: created.defaultUnitPrice,
    };
  }

  const all = useProductStore.getState().products;
  const matches = partialMatches(all, query);
  const exact = matches.filter((p) => norm(p.name) === norm(query));

  if (exact.length === 1) {
    const p = exact[0]!;
    return {
      status: 'resolved',
      id: p.id,
      name: p.name,
      created: false,
      defaultUnitPrice: p.defaultUnitPrice,
    };
  }

  if (matches.length === 0) {
    const created = await createProduct(
      { name: query, defaultUnitPrice: price, unit: 'cái' },
      notifyOpts,
    );
    return {
      status: 'resolved',
      id: created.id,
      name: created.name,
      created: true,
      defaultUnitPrice: created.defaultUnitPrice,
    };
  }

  const list = exact.length > 1 ? exact : matches;
  return {
    status: 'ambiguous',
    kind: 'product',
    query,
    options: list.slice(0, 10).map((p) => ({ id: p.id, label: formatProductLabel(p) })),
  };
}

export async function resolvePlatformForOrder(
  query: string | undefined,
  opts?: {
    platformId?: string;
    forceCreate?: boolean;
    silent?: boolean;
  },
): Promise<ResolveResult> {
  if (opts?.platformId) {
    const found = usePlatformStore.getState().platforms.find((p) => p.id === opts.platformId);
    if (found) {
      return { status: 'resolved', id: found.id, name: found.name, created: false };
    }
  }

  const name = query?.trim();
  if (!name) {
    const id = getDefaultPlatformId();
    const p = usePlatformStore.getState().platforms.find((x) => x.id === id);
    return {
      status: 'resolved',
      id,
      name: p?.name ?? 'Trực tiếp',
      created: false,
    };
  }

  const notifyOpts: NotifyOpts = { silent: opts?.silent ?? true };

  if (opts?.forceCreate) {
    const created = await createPlatform(
      { name, active: true },
      notifyOpts,
    );
    return { status: 'resolved', id: created.id, name: created.name, created: true };
  }

  const all = usePlatformStore.getState().platforms.filter((p) => p.active);
  const matches = partialMatches(all, name);
  const exact = matches.filter(
    (p) => norm(p.name) === norm(name) || (p.code && norm(p.code) === norm(name)),
  );

  if (exact.length === 1) {
    const p = exact[0]!;
    return { status: 'resolved', id: p.id, name: p.name, created: false };
  }

  if (matches.length === 0) {
    const created = await createPlatform({ name, active: true }, notifyOpts);
    return { status: 'resolved', id: created.id, name: created.name, created: true };
  }

  const list = exact.length > 1 ? exact : matches;
  return {
    status: 'ambiguous',
    kind: 'platform',
    query: name,
    options: list.slice(0, 10).map((p) => ({ id: p.id, label: formatPlatformLabel(p) })),
  };
}
