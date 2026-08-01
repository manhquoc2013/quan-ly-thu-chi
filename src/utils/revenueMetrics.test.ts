import { describe, expect, it } from 'vitest';
import {
  cashEventsForOrder,
  getPaidAmount,
  getRemainingBalance,
  isPaidRevenue,
  isUnpaidReceivable,
  normalizePaymentFields,
  sumCashEventsInRange,
  sumPaidRevenue,
  sumUnpaidReceivable,
} from '@/utils/revenueMetrics';
import type { Revenue } from '@/models';

function stub(partial: Partial<Revenue>): Revenue {
  return {
    id: '1',
    date: '2026-08-01',
    orderCode: 'DH-20260801-001',
    customerId: 'c1',
    items: [{ id: 'i1', name: 'SP', quantity: 1, unitPrice: 10000, total: 10000 }],
    totalAmount: 10000,
    discount: 0,
    finalAmount: 10000,
    orderStatus: 'new',
    deliveryStatus: 'pending',
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

describe('revenueMetrics', () => {
  it('treats legacy records as paid with paidAt = date and paidAmount = final', () => {
    const legacy = stub({ paymentStatus: undefined as unknown as 'unpaid', paidAt: undefined });
    delete (legacy as { paymentStatus?: string }).paymentStatus;
    const { records, changed } = normalizePaymentFields([legacy]);
    expect(changed).toBe(true);
    expect(records[0]!.paymentStatus).toBe('paid');
    expect(records[0]!.paidAt).toBe('2026-08-01');
    expect(records[0]!.paidAmount).toBe(10000);
  });

  it('sums cash events: full pay without deposit', () => {
    const list = [
      stub({ id: 'a', paymentStatus: 'paid', paidAt: '2026-08-02', paidAmount: 100, finalAmount: 100 }),
      stub({ id: 'b', paymentStatus: 'unpaid', finalAmount: 200 }),
      stub({
        id: 'c',
        paymentStatus: 'paid',
        paidAt: '2026-08-03',
        paidAmount: 300,
        orderStatus: 'cancelled',
        finalAmount: 300,
      }),
    ];
    expect(sumPaidRevenue(list)).toBe(100);
    expect(isPaidRevenue(list[0]!)).toBe(true);
    expect(isUnpaidReceivable(list[1]!)).toBe(true);
    expect(isUnpaidReceivable(list[2]!)).toBe(false);
  });

  it('deposit-only counts deposit as revenue and reduces receivable', () => {
    const r = stub({
      finalAmount: 120_000,
      depositAmount: 50_000,
      depositedAt: '2026-08-05',
      paymentStatus: 'unpaid',
    });
    expect(cashEventsForOrder(r)).toEqual([
      { orderId: '1', date: '2026-08-05', amount: 50_000, kind: 'deposit' },
    ]);
    expect(getRemainingBalance(r)).toBe(70_000);
    expect(sumPaidRevenue([r])).toBe(50_000);
    expect(sumUnpaidReceivable([r])).toBe(70_000);
  });

  it('deposit + payment splits revenue across dates', () => {
    const r = stub({
      id: 'ord',
      finalAmount: 120_000,
      depositAmount: 50_000,
      depositedAt: '2026-08-05',
      paymentStatus: 'paid',
      paidAt: '2026-08-10',
      paidAmount: 70_000,
    });
    expect(sumPaidRevenue([r])).toBe(120_000);
    expect(sumCashEventsInRange([r], '2026-08-05', '2026-08-05')).toBe(50_000);
    expect(sumCashEventsInRange([r], '2026-08-10', '2026-08-10')).toBe(70_000);
    expect(getRemainingBalance(r)).toBe(0);
  });

  it('allows paidAmount override different from remaining', () => {
    const r = stub({
      finalAmount: 100_000,
      depositAmount: 40_000,
      depositedAt: '2026-08-01',
      paymentStatus: 'paid',
      paidAt: '2026-08-02',
      paidAmount: 55_000,
    });
    expect(getPaidAmount(r)).toBe(55_000);
    expect(sumPaidRevenue([r])).toBe(95_000);
  });

  it('legacy paid without paidAmount uses finalAmount', () => {
    const r = stub({
      paymentStatus: 'paid',
      paidAt: '2026-08-01',
      finalAmount: 80_000,
    });
    expect(getPaidAmount(r)).toBe(80_000);
    expect(sumPaidRevenue([r])).toBe(80_000);
  });
});
