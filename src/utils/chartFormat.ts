/**
 * Chart helpers — axis ticks & tooltips in readable VND.
 */

import { formatCurrency } from '@/utils/currency';

/** Compact Y-axis label: 25000 → "25k", 1500000 → "1,5tr" */
export function formatAxisVnd(value: number): string {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tỷ`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}k`;
  return v.toLocaleString('vi-VN');
}

export function chartTooltipFormatter(value: number | string, name?: string): [string, string] {
  const n = typeof value === 'number' ? value : Number(value) || 0;
  const label =
    name === 'thu' || name === 'Thu'
      ? 'Thu'
      : name === 'chi' || name === 'Chi'
        ? 'Chi'
        : name === 'loi' || name === 'Lợi nhuận'
          ? 'Lợi nhuận'
          : name === 'total'
            ? 'Tổng'
            : (name ?? '');
  return [formatCurrency(n), label];
}
