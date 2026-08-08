import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Expense, OrderItem, Product, Revenue } from '@/models';
import { useProductStore } from '@/store/productStore';

const productCache = new Map<string, unknown>();

vi.mock('./cacheManager', () => ({
  cacheGet: vi.fn(async (key: string) => productCache.get(key) ?? null),
  cacheSet: vi.fn(async (key: string, value: unknown) => {
    productCache.set(key, value);
  }),
}));

vi.mock('./cloudSync', () => ({
  cloudUpsertProduct: vi.fn().mockResolvedValue(undefined),
}));

import {
  adjustProductStocks,
  expenseHasStockIn,
  orderHoldsStock,
  parseStockQtyFromDescription,
  productStockQty,
  syncOrderStock,
} from './stockService';

function product(partial: Partial<Product> & Pick<Product, 'id' | 'name'>): Product {
  return {
    defaultUnitPrice: 10000,
    unit: 'con',
    stockQty: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

function order(
  partial: Partial<Revenue> & { items: OrderItem[]; paymentStatus: Revenue['paymentStatus'] },
): Revenue {
  return {
    id: 'r1',
    date: '2026-08-09',
    orderCode: 'DH-20260809-001',
    customerId: 'c1',
    totalAmount: 100000,
    discount: 0,
    finalAmount: 100000,
    orderStatus: 'new',
    deliveryStatus: 'pending',
    paymentMethod: 'cash',
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    ...partial,
  };
}

describe('stockService', () => {
  beforeEach(() => {
    productCache.clear();
    useProductStore.getState().setProducts([]);
  });

  it('parseStockQtyFromDescription extracts qty + name', () => {
    expect(parseStockQtyFromDescription('nhập 10 con mèo')).toEqual({
      quantity: 10,
      productName: 'mèo',
    });
    expect(parseStockQtyFromDescription('3 × kẹp tóc')).toEqual({
      quantity: 3,
      productName: 'kẹp tóc',
    });
  });

  it('orderHoldsStock only when paid and not cancelled', () => {
    expect(orderHoldsStock({ paymentStatus: 'paid', orderStatus: 'new' })).toBe(true);
    expect(orderHoldsStock({ paymentStatus: 'unpaid', orderStatus: 'new' })).toBe(false);
    expect(orderHoldsStock({ paymentStatus: 'paid', orderStatus: 'cancelled' })).toBe(false);
  });

  it('adjustProductStocks increases and allows negative', async () => {
    const p = product({ id: 'p1', name: 'Mèo', stockQty: 2 });
    productCache.set('products', [p]);
    useProductStore.getState().setProducts([p]);

    await adjustProductStocks(new Map([['p1', 5]]), { silent: true, warnNegative: false });
    expect(productStockQty(useProductStore.getState().products[0]!)).toBe(7);

    const { negatives } = await adjustProductStocks(new Map([['p1', -10]]), {
      silent: true,
      warnNegative: true,
    });
    expect(productStockQty(useProductStore.getState().products[0]!)).toBe(-3);
    expect(negatives).toHaveLength(1);
  });

  it('syncOrderStock deducts on paid and restores on unpaid', async () => {
    const p = product({ id: 'p1', name: 'Mèo', stockQty: 10 });
    productCache.set('products', [p]);
    useProductStore.getState().setProducts([p]);

    const items: OrderItem[] = [
      { id: 'i1', productId: 'p1', name: 'Mèo', quantity: 3, unitPrice: 50000, total: 150000 },
    ];
    const unpaid = order({ items, paymentStatus: 'unpaid', stockApplied: false });
    const paid = order({ items, paymentStatus: 'paid', stockApplied: false });

    const applied = await syncOrderStock(unpaid, paid, { silent: true });
    expect(applied).toBe(true);
    expect(productStockQty(useProductStore.getState().products[0]!)).toBe(7);

    const restored = await syncOrderStock(
      { ...paid, stockApplied: true },
      unpaid,
      { silent: true },
    );
    expect(restored).toBe(false);
    expect(productStockQty(useProductStore.getState().products[0]!)).toBe(10);
  });

  it('expenseHasStockIn requires product + qty', () => {
    const e = {
      stockProductId: 'p1',
      stockQtyIn: 2,
    } as Pick<Expense, 'stockProductId' | 'stockQtyIn'>;
    expect(expenseHasStockIn(e)).toBe(true);
    expect(expenseHasStockIn({ stockProductId: 'p1', stockQtyIn: 0 })).toBe(false);
  });
});
