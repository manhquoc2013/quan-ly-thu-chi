import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cacheManager', () => ({
  cacheGet: vi.fn(async () => []),
  cacheSet: vi.fn(async () => undefined),
}));

vi.mock('@/utils/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

import { cacheGet } from './cacheManager';
import { resolveCustomerForOrder, resolveProductForOrder } from './entityResolve';
import { useCustomerStore } from '@/store/customerStore';
import { useProductStore } from '@/store/productStore';

describe('entityResolve', () => {
  beforeEach(() => {
    useCustomerStore.getState().setCustomers([]);
    useProductStore.getState().setProducts([]);
    vi.mocked(cacheGet).mockResolvedValue([]);
  });

  it('auto-creates customer when no match', async () => {
    const r = await resolveCustomerForOrder('Khách Mới XYZ', { silent: true });
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') expect(r.created).toBe(true);
  });

  it('asks when multiple partial customer matches', async () => {
    useCustomerStore.getState().setCustomers([
      {
        id: '1',
        name: 'Nguyễn Thị Lan',
        phone: '0901111111',
        createdAt: '',
      },
      {
        id: '2',
        name: 'Trần Lan',
        phone: '',
        createdAt: '',
      },
    ]);
    const r = await resolveCustomerForOrder('Lan', { silent: true });
    expect(r.status).toBe('ambiguous');
    if (r.status === 'ambiguous') expect(r.options.length).toBe(2);
  });

  it('uses unique exact product without asking', async () => {
    useProductStore.getState().setProducts([
      {
        id: 'p1',
        name: 'Áo thun',
        defaultUnitPrice: 100000,
        unit: 'cái',
        createdAt: '',
      },
    ]);
    const r = await resolveProductForOrder('áo thun', { silent: true });
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') {
      expect(r.id).toBe('p1');
      expect(r.created).toBe(false);
    }
  });

  it('auto-uses unique partial product match', async () => {
    useProductStore.getState().setProducts([
      {
        id: 'p1',
        name: 'Kẹp tóc giá 90k sau đó lại uống nước',
        defaultUnitPrice: 16667,
        unit: 'cái',
        createdAt: '',
      },
    ]);
    const r = await resolveProductForOrder('3 × kẹp tóc giá 90k', { silent: true });
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') expect(r.id).toBe('p1');
  });

  it('asks when multiple partial product matches', async () => {
    useProductStore.getState().setProducts([
      {
        id: 'p1',
        name: 'Áo thun nam',
        defaultUnitPrice: 100000,
        unit: 'cái',
        createdAt: '',
      },
      {
        id: 'p2',
        name: 'Áo thun nữ',
        defaultUnitPrice: 90000,
        unit: 'cái',
        createdAt: '',
      },
    ]);
    const r = await resolveProductForOrder('áo thun', { silent: true });
    expect(r.status).toBe('ambiguous');
  });

  it('productQuery keeps kẹp (does not strip k as nghìn)', async () => {
    const { productQueryFromDescription } = await import('./entityResolve');
    expect(productQueryFromDescription('6 kẹp tóc')).toMatch(/kẹp tóc/i);
    expect(productQueryFromDescription('Hoa đã trả 300k cho 6 kẹp tóc')).toMatch(/^kẹp tóc$/i);
    expect(productQueryFromDescription('tôi đi uống nước hết 30k')).toMatch(/uống nước/i);
  });
});
