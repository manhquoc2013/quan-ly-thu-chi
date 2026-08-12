/** Shared walk-in customer sentinel (local) + cloud UUID FK. */

export const WALK_IN_CUSTOMER_ID = '00000000-0000-4000-8000-000000000001';
export const WALK_IN_LOCAL_ID = 'walk-in';

export function isWalkInCustomerId(id: string | undefined | null): boolean {
  if (!id) return false;
  return id === WALK_IN_LOCAL_ID || id === WALK_IN_CUSTOMER_ID;
}

export function normalizeCustomerId(id: string): string {
  return id === WALK_IN_CUSTOMER_ID ? WALK_IN_LOCAL_ID : id;
}
