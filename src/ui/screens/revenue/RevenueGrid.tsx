/**
 * RevenueGrid — Orders table with selection, status badges, expandable rows.
 *
 * Columns: checkbox, order code (DH-YYYYMMDD-NNN), date, customer, items count,
 * total (formatted VND), status badge, actions.
 *
 * Uses @models (ORDER_STATUS_LABELS), @store (useRevenueStore),
 * @utils (formatCurrency), @ui/components.
 */

import { useState, useMemo } from 'react';
import type { Revenue, OrderStatus } from '@/models';
import { ORDER_STATUS_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { Badge } from '@ui/components/Badge';
import { Button } from '@ui/components/Button';
import { useRevenueStore } from '@/store/revenueStore';

/* ─── Props ─── */

export interface RevenueGridProps {
  /** Row-click callback — receives the revenue row for expansion */
  onRowClick?: (row: Revenue) => void;
  /** On-edit callback */
  onEdit?: (row: Revenue) => void;
  /** On-delete callback */
  onDelete?: (row: Revenue) => void;
}

/* ─── Badge variant mapping ─── */

function statusVariant(status: OrderStatus): 'success' | 'warning' | 'error' | 'neutral' | 'accent' {
  switch (status) {
    case 'new': return 'neutral';
    case 'confirmed': return 'accent';
    case 'processing': return 'accent';
    case 'completed': return 'success';
    case 'cancelled': return 'error';
  }
}

/* ─── Component ─── */

export function RevenueGrid({ onRowClick, onEdit, onDelete }: RevenueGridProps) {
  const records = useRevenueStore((s) => s.records);
  const filters = useRevenueStore((s) => s.filters);
  const sort = useRevenueStore((s) => s.sort);
  const toggleSelect = useRevenueStore((s) => s.toggleSelect);
  const selectedIds = useRevenueStore((s) => s.selectedIds);

  const filteredRecords = useMemo(() => {
    let result = [...records];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(r => r.orderCode.toLowerCase().includes(q) || (r.notes?.toLowerCase().includes(q) ?? false));
    }
    if (filters.dateFrom) result = result.filter(r => r.date >= filters.dateFrom);
    if (filters.dateTo) result = result.filter(r => r.date <= filters.dateTo);
    if (filters.orderStatus) result = result.filter(r => r.orderStatus === filters.orderStatus);
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [records, filters, sort]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* Row class helper */
  const rowClass = (id: string) => [
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
    selectedIds.has(id) ? 'bg-accent-bg' : '',
    expandedId === id ? 'bg-accent-bg/50' : '',
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
        <div className="w-8 shrink-0" role="columnheader" aria-label="Select all" />
        <div className="w-[150px] shrink-0" role="columnheader">Mã đơn</div>
        <div className="w-[110px] shrink-0" role="columnheader">Ngày</div>
        <div className="flex-1 min-w-0" role="columnheader">Khách hàng</div>
        <div className="w-[70px] shrink-0 text-right" role="columnheader">SL SP</div>
        <div className="w-[140px] shrink-0 text-right" role="columnheader">Tổng tiền</div>
        <div className="w-[110px] shrink-0 text-center" role="columnheader">Trạng thái</div>
        <div className="w-[90px] shrink-0 text-center" role="columnheader">Thao tác</div>
      </div>

      {/* Data rows */}
      {filteredRecords.map((row) => {
        const itemCount = row.items.length;
        const isSelected = selectedIds.has(row.id);
        const isExpanded = expandedId === row.id;

        return (
          <div key={row.id}>
            {/* Data row */}
            <div
              className={rowClass(row.id)}
              role="row"
              onClick={() => {
                onRowClick?.(row);
                setExpandedId(isExpanded ? null : row.id);
              }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick?.(row);
                  setExpandedId(isExpanded ? null : row.id);
                }
              }}
              aria-expanded={isExpanded}
              aria-selected={isSelected}
            >
              {/* Checkbox column */}
              <div
                className="w-8 shrink-0"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  toggleSelect(row.id);
                }}
                role="gridcell"
                aria-label={`Select ${row.orderCode}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  className="size-4 rounded border-input-border text-run-bg focus:ring-run-bg"
                  aria-label={`Checkbox for ${row.orderCode}`}
                />
              </div>

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
                <Badge variant={statusVariant(row.orderStatus)} size="sm">
                  {ORDER_STATUS_LABELS[row.orderStatus]}
                </Badge>
              </div>

              {/* Actions */}
              <div className="w-[90px] shrink-0 text-center" role="gridcell">
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="neutral"
                    onClick={() => onEdit?.(row)}
                    className="!px-1.5 !py-0.5"
                  >
                    Sửa
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => onDelete?.(row)}
                    className="!px-1.5 !py-0.5"
                  >
                    Xóa
                  </Button>
                </div>
              </div>
            </div>

            {/* Expanded detail placeholder — filled by OrderRowCard in parent */}
            {isExpanded && (
              <div className="px-[var(--s-md)] pb-[var(--s-md)]">
                <div
                  className="ml-[var(--s-xl)] p-[var(--s-md)] rounded-panel border border-border-subtle bg-surface"
                  role="row"
                >
                  <p className="text-xs text-text-muted italic">
                    Chi tiết đơn hàng — {row.orderCode}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
