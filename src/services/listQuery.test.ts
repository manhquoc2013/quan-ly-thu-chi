import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Expense } from '@/models';

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

vi.mock('./cacheManager', () => ({
  cacheGet: vi.fn(async (key: string) => {
    if (key === 'expenses') return expenses;
    return [];
  }),
}));

vi.mock('@/store', () => ({
  useExpenseStore: { getState: () => ({ records: expenses }) },
  useRevenueStore: { getState: () => ({ records: [] }) },
  useProductStore: { getState: () => ({ products: [] }) },
  useCustomerStore: { getState: () => ({ customers: [] }) },
  usePlatformStore: { getState: () => ({ platforms: [] }) },
}));

import { queryExpensesPage } from './listQuery';

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
