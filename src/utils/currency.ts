/**
 * Format number to VND currency string with thousand separators.
 * 250000 → "250.000 ₫"
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

/**
 * Parse a VND string back to number.
 * "250.000 ₫" → 250000
 * "250000" → 250000
 */
export function parseCurrency(input: string): number {
  const cleaned = input.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Format currency input as user types.
 * "250000" → "250.000"
 */
export function formatCurrencyInput(value: string): string {
  const num = parseCurrency(value);
  if (num === 0) return '';
  return num.toLocaleString('vi-VN');
}
