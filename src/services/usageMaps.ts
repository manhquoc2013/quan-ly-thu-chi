/**
 * Precompute order usage maps from revenues (catalog screens).
 */

import type { Revenue } from '@/models';
import { isWalkInCustomerId } from '@/services/walkIn';

export function buildProductLineCountById(revenues: Revenue[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of revenues) {
    if (order.orderStatus === 'cancelled') continue;
    for (const item of order.items) {
      if (!item.productId) continue;
      map.set(item.productId, (map.get(item.productId) ?? 0) + 1);
    }
  }
  return map;
}

export function buildProductUsageByName(revenues: Revenue[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of revenues) {
    if (order.orderStatus === 'cancelled') continue;
    for (const item of order.items) {
      const key = item.name.toLowerCase().trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + item.quantity);
    }
  }
  return map;
}

export function buildOrderCountByCustomer(revenues: Revenue[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of revenues) {
    if (order.orderStatus === 'cancelled') continue;
    if (!order.customerId || isWalkInCustomerId(order.customerId)) continue;
    map.set(order.customerId, (map.get(order.customerId) ?? 0) + 1);
  }
  return map;
}

export function buildOrderCountByPlatform(revenues: Revenue[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of revenues) {
    if (!order.platformId || order.orderStatus === 'cancelled') continue;
    map.set(order.platformId, (map.get(order.platformId) ?? 0) + 1);
  }
  return map;
}
