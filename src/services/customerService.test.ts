import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer, Revenue } from '@/models';

vi.mock('./cacheManager', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
}));

vi.mock('@/utils/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

import { cacheGet, cacheSet } from './cacheManager';
import {
  createCustomer,
  findOrCreateCustomerByName,
  deleteCustomer,
} from './customerService';
import { useCustomerStore } from '@/store/customerStore';
import { useRevenueStore } from '@/store/revenueStore';

describe('customerService', () => {
  beforeEach(() => {
    useCustomerStore.getState().setCustomers([]);
    useRevenueStore.getState().setRecords([]);
    vi.mocked(cacheGet).mockReset();
    vi.mocked(cacheSet).mockReset();
    vi.mocked(cacheGet).mockResolvedValue([]);
    vi.mocked(cacheSet).mockResolvedValue(undefined);
  });

  it('allows create without phone', async () => {
    const c = await createCustomer({ name: 'An Nguyen', phone: '' }, { silent: true });
    expect(c.phone).toBe('');
    expect(c.name).toBe('An Nguyen');
  });

  it('rejects invalid phone when provided', async () => {
    await expect(
      createCustomer({ name: 'An Nguyen', phone: '123' }, { silent: true }),
    ).rejects.toThrow(/SĐT/);
  });

  it('findOrCreate reuses existing by name', async () => {
    const first = await createCustomer({ name: 'Lan', phone: '0901234567' }, { silent: true });
    vi.mocked(cacheGet).mockResolvedValue([first]);
    const second = await findOrCreateCustomerByName('lan', { silent: true });
    expect(second.id).toBe(first.id);
  });

  it('blocks delete when orders exist', async () => {
    const cust: Customer = {
      id: 'c1',
      name: 'Lan',
      phone: '',
      createdAt: new Date().toISOString(),
    };
    useCustomerStore.getState().setCustomers([cust]);
    vi.mocked(cacheGet).mockResolvedValue([cust]);
    useRevenueStore.getState().setRecords([
      {
        id: 'r1',
        customerId: 'c1',
        date: '2026-08-01',
        orderCode: 'DH-20260801-001',
        items: [],
        totalAmount: 0,
        discount: 0,
        finalAmount: 0,
        orderStatus: 'new',
        deliveryStatus: 'pending',
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
        createdAt: '',
        updatedAt: '',
      } as Revenue,
    ]);
    await expect(deleteCustomer('c1', { silent: true })).rejects.toThrow(/Không thể xóa/);
  });
});
