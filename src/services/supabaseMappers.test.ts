import { describe, expect, it } from 'vitest';
import {
  expenseToRow,
  mapExpense,
  mapProduct,
  mapRevenue,
  productToRow,
  revenueToUpsertPayload,
  type ExpenseRow,
  type ProductRow,
  type RevenueItemRow,
  type RevenueRow,
} from './supabaseMappers';
import type { Expense, Product, Revenue } from '@/models';

describe('supabaseMappers', () => {
  it('maps expense round-trip', () => {
    const expense: Expense = {
      id: '11111111-1111-4111-8111-111111111111',
      date: '2026-08-01',
      category: 'office',
      amount: 10000,
      description: 'Giấy A4',
      status: 'paid',
      paymentMethod: 'cash',
      tags: ['vp'],
      createdAt: '2026-08-01T01:00:00.000Z',
      updatedAt: '2026-08-01T02:00:00.000Z',
    };
    const row = expenseToRow('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', expense);
    expect(row.payment_method).toBe('cash');
    expect(row.household_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const back = mapExpense(row as ExpenseRow);
    expect(back).toEqual(expense);
  });

  it('maps product with imagePath', () => {
    const row: ProductRow = {
      id: '22222222-2222-4222-8222-222222222222',
      household_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Áo',
      default_unit_price: 150000,
      unit: 'cái',
      sku: 'AO-1',
      notes: null,
      image_path: 'hid/pid/a.jpg',
      created_at: '2026-08-01T01:00:00.000Z',
    };
    const product = mapProduct(row);
    expect(product.imagePath).toBe('hid/pid/a.jpg');
    expect(productToRow(row.household_id, product as Product).image_path).toBe('hid/pid/a.jpg');
  });

  it('maps revenue with sorted items', () => {
    const header: RevenueRow = {
      id: '33333333-3333-4333-8333-333333333333',
      household_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      date: '2026-08-02',
      order_code: 'DH-20260802-001',
      customer_id: '44444444-4444-4444-8444-444444444444',
      total_amount: 200000,
      discount: 0,
      final_amount: 200000,
      order_status: 'new',
      delivery_status: 'pending',
      payment_method: 'bank_transfer',
      payment_status: 'unpaid',
      deposit_amount: null,
      deposited_at: null,
      paid_amount: null,
      paid_at: null,
      shipping_fee: null,
      shipping_payer: null,
      shipping_expense_id: null,
      platform_id: null,
      notes: null,
      created_at: '2026-08-02T01:00:00.000Z',
      updated_at: '2026-08-02T01:00:00.000Z',
    };
    const items: RevenueItemRow[] = [
      {
        id: 'i2',
        household_id: header.household_id,
        revenue_id: header.id,
        product_id: null,
        name: 'B',
        quantity: 1,
        unit_price: 100000,
        total: 100000,
        sort_index: 1,
      },
      {
        id: 'i1',
        household_id: header.household_id,
        revenue_id: header.id,
        product_id: null,
        name: 'A',
        quantity: 1,
        unit_price: 100000,
        total: 100000,
        sort_index: 0,
      },
    ];
    const revenue = mapRevenue(header, items);
    expect(revenue.items.map((i) => i.name)).toEqual(['A', 'B']);
    const payload = revenueToUpsertPayload(header.household_id, revenue as Revenue);
    expect(payload.revenue.order_code).toBe('DH-20260802-001');
    expect(payload.items).toHaveLength(2);
  });
});
