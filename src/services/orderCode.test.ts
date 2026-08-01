import { describe, expect, it } from 'vitest';
import { normalizeOrderCodes } from './revenueService';
import type { Revenue } from '@/models';

function stub(partial: Partial<Revenue> & Pick<Revenue, 'id' | 'orderCode' | 'date'>): Revenue {
  return {
    customerId: 'c1',
    items: [{ id: 'i1', name: 'SP', quantity: 1, unitPrice: 1000, total: 1000 }],
    totalAmount: 1000,
    discount: 0,
    finalAmount: 1000,
    orderStatus: 'new',
    deliveryStatus: 'pending',
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

describe('normalizeOrderCodes', () => {
  it('rewrites duplicate and legacy codes to unique DH-YYYYMMDD-NNN', () => {
    const input = [
      stub({ id: '1', date: '2026-08-01', orderCode: 'DH-20260801-001' }),
      stub({ id: '2', date: '2026-08-01', orderCode: 'DH-20260801-260802' }),
      stub({ id: '3', date: '2026-08-01', orderCode: 'DH-20260801-260802' }),
      stub({ id: '4', date: '2026-08-01', orderCode: 'DH-20260801-260802' }),
    ];
    const { records, changed } = normalizeOrderCodes(input);
    expect(changed).toBe(true);
    const codes = records.map((r) => r.orderCode);
    expect(codes).toEqual(['DH-20260801-001', 'DH-20260801-002', 'DH-20260801-003', 'DH-20260801-004']);
    expect(new Set(codes).size).toBe(4);
  });
});
