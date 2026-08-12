import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer, Expense, Revenue } from '@/models';

vi.mock('./cloudSync', () => ({
  getActiveHouseholdId: () => null,
  isCloudSyncActive: () => false,
}));

vi.mock('./supabaseClient', () => ({
  isSupabaseConfigured: () => false,
  getSupabase: () => {
    throw new Error('no supabase in test');
  },
}));

const expenses: Expense[] = Array.from({ length: 45 }, (_, i) => ({
  id: `e-${i}`,
  date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
  category: 'supplies',
  amount: 1000 * (i + 1),
  description: i === 3 ? 'Len Milk bò' : `Chi phí ${i}`,
  status: 'paid',
  paymentMethod: 'cash',
  tags: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}));

const customers: Customer[] = [
  {
    id: 'cust-hoa',
    name: 'Nguyễn Hoa',
    phone: '0901234567',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
];

const revenues: Revenue[] = [
  {
    id: 'rev-1',
    date: '2026-08-10',
    orderCode: 'DH-20260810-001',
    customerId: 'cust-hoa',
    items: [],
    totalAmount: 100_000,
    discount: 0,
    finalAmount: 100_000,
    orderStatus: 'new',
    deliveryStatus: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: 'cash',
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
  },
  {
    id: 'rev-2',
    date: '2026-08-11',
    orderCode: 'DH-20260811-002',
    customerId: 'walk-in',
    items: [],
    totalAmount: 50_000,
    discount: 0,
    finalAmount: 50_000,
    orderStatus: 'new',
    deliveryStatus: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: 'cash',
    notes: 'Ghi chú riêng',
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
  },
];

vi.mock('./cacheManager', () => ({
  cacheGet: vi.fn(async (key: string) => {
    if (key === 'expenses') return expenses;
    if (key === 'revenues') return revenues;
    return [];
  }),
}));

vi.mock('@/store', () => ({
  useExpenseStore: { getState: () => ({ records: expenses }) },
  useRevenueStore: { getState: () => ({ records: revenues }) },
  useProductStore: { getState: () => ({ products: [] }) },
  useCustomerStore: { getState: () => ({ customers }) },
  usePlatformStore: { getState: () => ({ platforms: [] }) },
}));

import { queryExpensesPage, queryRevenuesPage } from './listQuery';

describe('queryExpensesPage (local hybrid)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns page slice with exact total', async () => {
    const page1 = await queryExpensesPage({ page: 1, pageSize: 20 });
    expect(page1.source).toBe('local');
    expect(page1.total).toBe(45);
    expect(page1.items).toHaveLength(20);
    expect(page1.page).toBe(1);

    const page3 = await queryExpensesPage({ page: 3, pageSize: 20 });
    expect(page3.items).toHaveLength(5);
    expect(page3.page).toBe(3);
  });

  it('filters by search before paging', async () => {
    const result = await queryExpensesPage(
      { page: 1, pageSize: 20 },
      { search: 'Milk' },
    );
    expect(result.total).toBe(1);
    expect(result.items[0]?.description).toContain('Milk');
  });
});

describe('queryRevenuesPage search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds orders by buyer name', async () => {
    const result = await queryRevenuesPage({ page: 1, pageSize: 20 }, { search: 'Hoa' });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe('rev-1');
  });

  it('still finds by order code and notes', async () => {
    const byCode = await queryRevenuesPage(
      { page: 1, pageSize: 20 },
      { search: 'DH-20260811' },
    );
    expect(byCode.items[0]?.id).toBe('rev-2');

    const byNotes = await queryRevenuesPage(
      { page: 1, pageSize: 20 },
      { search: 'riêng' },
    );
    expect(byNotes.items[0]?.id).toBe('rev-2');
  });
});
