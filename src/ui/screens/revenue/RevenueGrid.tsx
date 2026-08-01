/**
 * RevenueGrid — Orders table (pure display).
 *
 * Columns: order code (DH-YYYYMMDD-NNN), date, customer, items count,
 * total (formatted VND), status badge, actions.
 *
 * Pure display grid: accepts `records` as a prop, no selection box, no
 * expandable rows. Clicking a row calls `onRowClick`.
 *
 * Uses @models (ORDER_STATUS_LABELS), @utils (formatCurrency), @ui/components.
 */

import type { Revenue, OrderStatus } from '@/models';
import { ORDER_STATUS_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

/* ─── Props ─── */

export interface RevenueGridProps {
  records: Revenue[];
  /** Row-click callback — receives the revenue row for detail display */
  onRowClick?: (row: Revenue) => void;
  /** On-edit callback */
  onEdit?: (row: Revenue) => void;
  /** On-delete callback */
  onDelete?: (row: Revenue) => void;
}

/* ─── Badge variant mapping ─── */

function statusVariant(status: OrderStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'new': return 'outline';
    case 'confirmed': return 'default';
    case 'processing': return 'default';
    case 'completed': return 'default';
    case 'cancelled': return 'destructive';
  }
}

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'completed': return 'bg-success-bg text-success-fg border-success-bg-badge';
    default: return '';
  }
}

/* ─── Component ─── */

export function RevenueGrid({ records, onRowClick, onEdit, onDelete }: RevenueGridProps) {
  /* Row class helper */
  const rowClass = () => [
    'flex',
    'items-center',
    'gap-[var(--s-md)]',
    'px-[var(--s-md)]',
    'h-12',
    'border-b',
    'border-border-subtle',
    'cursor-pointer',
    'transition-colors',
    'duration-[var(--d-fast)]',
    'hover:bg-surface-hover',
  ].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col overflow-auto" role="grid" aria-label="Orders grid">
      {/* Header row */}
      <div
        className={
          'flex items-center gap-[var(--s-md)] px-[var(--s-md)] ' +
          'h-8 text-xs font-semibold text-grid-header-fg ' +
          'bg-grid-header-bg border-b border-border'
        }
        role="row"
      >
        <div className="w-[150px] shrink-0" role="columnheader">Mã đơn</div>
        <div className="w-[110px] shrink-0" role="columnheader">Ngày</div>
        <div className="flex-1 min-w-0" role="columnheader">Khách hàng</div>
        <div className="w-[70px] shrink-0 text-right" role="columnheader">SL SP</div>
        <div className="w-[140px] shrink-0 text-right" role="columnheader">Tổng tiền</div>
        <div className="w-[110px] shrink-0 text-center" role="columnheader">Trạng thái</div>
        <div className="w-[90px] shrink-0 text-center" role="columnheader">Thao tác</div>
      </div>

      {/* Data rows */}
      {records.map((row) => {
        const itemCount = row.items.length;

        return (
          <div
            key={row.id}
            className={rowClass()}
            role="row"
            onClick={() => onRowClick?.(row)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRowClick?.(row);
              }
            }}
          >
            {/* Order code */}
            <div className="w-[150px] shrink-0 text-xs font-mono text-text-primary" role="gridcell">
              {row.orderCode}
            </div>

            {/* Date */}
            <div className="w-[110px] shrink-0 text-xs text-text-secondary" role="gridcell">
              {row.date}
            </div>

            {/* Customer */}
            <div className="flex-1 min-w-0 text-xs text-text-primary truncate" role="gridcell">
              {row.customerId}
            </div>

            {/* Items count */}
            <div className="w-[70px] shrink-0 text-xs text-right text-text-secondary font-medium" role="gridcell">
              {itemCount}
            </div>

            {/* Total */}
            <div className="w-[140px] shrink-0 text-xs text-right font-semibold text-text-primary" role="gridcell">
              {formatCurrency(row.finalAmount)}
            </div>

            {/* Status badge */}
            <div className="w-[110px] shrink-0 text-center" role="gridcell">
              <Badge variant={statusVariant(row.orderStatus)} className={statusBadgeClass(row.orderStatus)}>
                {ORDER_STATUS_LABELS[row.orderStatus]}
              </Badge>
            </div>

            {/* Actions */}
            <div className="w-[90px] shrink-0 text-center" role="gridcell">
              <div className="flex items-center justify-center gap-1">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onEdit?.(row)}
                >
                  <Pencil size={12} /> Sửa
                </Button>
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={() => onDelete?.(row)}
                >
                  <Trash2 size={12} /> Xóa
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
