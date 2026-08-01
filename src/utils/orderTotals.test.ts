import { describe, expect, it } from 'vitest';
import { computeOrderTotals } from './orderTotals';

describe('computeOrderTotals', () => {
  const items = [{ total: 100_000 }];

  it('defaults fee 0 and final = goods', () => {
    const t = computeOrderTotals(items, 0);
    expect(t.shippingFee).toBe(0);
    expect(t.finalAmount).toBe(100_000);
  });

  it('customer ship adds to finalAmount', () => {
    const t = computeOrderTotals(items, 0, 15_000, 'customer');
    expect(t.finalAmount).toBe(115_000);
    expect(t.goodsAmount).toBe(100_000);
  });

  it('shop ship does not add to finalAmount', () => {
    const t = computeOrderTotals(items, 0, 15_000, 'shop');
    expect(t.finalAmount).toBe(100_000);
    expect(t.shippingPayer).toBe('shop');
  });

  it('defaults payer to customer when fee > 0', () => {
    const t = computeOrderTotals(items, 0, 10_000);
    expect(t.shippingPayer).toBe('customer');
    expect(t.finalAmount).toBe(110_000);
  });
});
