/**
 * Order goods / shipping / finalAmount helpers.
 */

import type { OrderItem, ShippingPayer } from '@/models';

export function normalizeShippingFee(fee: number | undefined): number {
  return typeof fee === 'number' && fee > 0 ? Math.round(fee) : 0;
}

export function normalizeShippingPayer(
  fee: number,
  payer: ShippingPayer | undefined,
): ShippingPayer | undefined {
  if (fee <= 0) return undefined;
  return payer === 'shop' ? 'shop' : 'customer';
}

export function computeOrderTotals(
  items: Pick<OrderItem, 'total'>[],
  discount: number,
  shippingFee?: number,
  shippingPayer?: ShippingPayer,
): {
  totalAmount: number;
  goodsAmount: number;
  shippingFee: number;
  shippingPayer?: ShippingPayer;
  finalAmount: number;
} {
  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const safeDiscount = Math.max(0, Math.min(discount, totalAmount));
  const goodsAmount = Math.max(0, totalAmount - safeDiscount);
  const fee = normalizeShippingFee(shippingFee);
  const payer = normalizeShippingPayer(fee, shippingPayer);
  const finalAmount =
    fee > 0 && payer === 'customer' ? goodsAmount + fee : goodsAmount;
  return {
    totalAmount,
    goodsAmount,
    shippingFee: fee,
    shippingPayer: payer,
    finalAmount,
  };
}

export function shippingLabel(
  fee: number,
  payer: ShippingPayer | undefined,
): string | undefined {
  if (fee <= 0) return undefined;
  return payer === 'shop' ? `Ship ${fee.toLocaleString('vi-VN')}₫ (shop → chi)` : `Ship ${fee.toLocaleString('vi-VN')}₫ (khách)`;
}
