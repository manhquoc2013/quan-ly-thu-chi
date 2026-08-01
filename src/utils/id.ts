export function generateId(): string {
  return crypto.randomUUID();
}

export function generateOrderCode(date: string, index: number): string {
  const d = date.replace(/-/g, '');
  return `DH-${d}-${String(index).padStart(3, '0')}`;
}
