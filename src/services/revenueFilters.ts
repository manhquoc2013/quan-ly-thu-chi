/**
 * Shared revenue/order filter + search (listQuery, RevenueScreen, revenueStore).
 */

import type { Customer, OrderStatus, PaymentStatus, Revenue } from '@/models';
import {
  isWalkInCustomerId,
  normalizeCustomerId,
  WALK_IN_CUSTOMER_ID,
  WALK_IN_LOCAL_ID,
} from '@/services/walkIn';

export const WALK_IN_LABEL = 'khách vãng lai';
export const WALK_IN_CUSTOMER_IDS = [WALK_IN_LOCAL_ID, WALK_IN_CUSTOMER_ID] as const;

/** Aliases that mean walk-in when query is a substring of these (min length 3). */
const WALK_IN_ALIASES = [
  'khách vãng lai',
  'khach vang lai',
  'vãng lai',
  'vang lai',
  'walk-in',
  'walk in',
] as const;

export interface RevenueFilterInput {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  customerId?: string;
  priorityOnly?: boolean;
}

export { isWalkInCustomerId, normalizeCustomerId };

export function matchesWalkInSearch(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return false;
  return WALK_IN_ALIASES.some((alias) => alias.includes(q) || q.includes(alias));
}

export function customerIdsMatchingSearch(
  query: string,
  customers: Array<Pick<Customer, 'id' | 'name'>>,
): Set<string> {
  const q = query.trim().toLowerCase();
  const ids = new Set(
    customers.filter((c) => c.name.toLowerCase().includes(q)).map((c) => c.id),
  );
  if (matchesWalkInSearch(q)) {
    for (const id of WALK_IN_CUSTOMER_IDS) ids.add(id);
  }
  return ids;
}

export function matchRevenueSearch(
  revenue: Revenue,
  query: string,
  customerIds: Set<string>,
  opts?: { includeItemNames?: boolean },
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (revenue.orderCode.toLowerCase().includes(q)) return true;
  if (revenue.notes?.toLowerCase().includes(q)) return true;
  if (customerIds.has(revenue.customerId)) return true;
  if (
    matchesWalkInSearch(q) &&
    isWalkInCustomerId(revenue.customerId)
  ) {
    return true;
  }
  if (opts?.includeItemNames && revenue.items.some((i) => i.name.toLowerCase().includes(q))) {
    return true;
  }
  return false;
}

export function filterRevenues(
  records: Revenue[],
  filters: RevenueFilterInput,
  customers: Array<Pick<Customer, 'id' | 'name'>> = [],
  opts?: { includeItemNames?: boolean },
): Revenue[] {
  let result = [...records];
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    const customerIds = customerIdsMatchingSearch(q, customers);
    result = result.filter((r) => matchRevenueSearch(r, q, customerIds, opts));
  }
  if (filters.dateFrom) result = result.filter((r) => r.date >= filters.dateFrom!);
  if (filters.dateTo) result = result.filter((r) => r.date <= filters.dateTo!);
  if (filters.orderStatus) result = result.filter((r) => r.orderStatus === filters.orderStatus);
  if (filters.paymentStatus) {
    result = result.filter((r) => r.paymentStatus === filters.paymentStatus);
  }
  if (filters.customerId) result = result.filter((r) => r.customerId === filters.customerId);
  if (filters.priorityOnly) result = result.filter((r) => r.priority === true);
  return result;
}

/** Default list sort: priority first, then date desc. */
export function sortRevenuesDefault(records: Revenue[]): Revenue[] {
  return [...records].sort((a, b) => {
    const pa = a.priority ? 1 : 0;
    const pb = b.priority ? 1 : 0;
    if (pa !== pb) return pb - pa;
    if (pa && pb) {
      const at = a.priorityAt ?? '';
      const bt = b.priorityAt ?? '';
      if (at !== bt) return bt.localeCompare(at);
    }
    return b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt);
  });
}
