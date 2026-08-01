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

import { useState, useCallback } from 'react';
import type { Revenue, OrderStatus } from '@/models';
import { ORDER_STATUS_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { useCustomerStore } from '@/store/customerStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

function customerLabel(row: Revenue, customers: Array<{ id: string; name: string }>): string {
  if (row.customerId === 'walk-in') return 'Khách vãng lai';
  return (
    customers.find((c) => c.id === row.customerId)?.name ||
    row.notes?.replace(/^Khách:\s*/i, '') ||
    '—'
  );
}

export function RevenueGrid({ records, onRowClick, onEdit, onDelete }: RevenueGridProps) {
  const customers = useCustomerStore((s) => s.customers);
  const [confirmDelete, setConfirmDelete] = useState<Revenue | null>(null);

  const handleConfirmDelete = useCallback(() => {
    if (!confirmDelete) return;
    onDelete?.(confirmDelete);
    setConfirmDelete(null);
  }, [confirmDelete, onDelete]);

  const rowClass = [
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
  ].join(' ');

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
        <div className="w-[100px] shrink-0 text-center" role="columnheader">Thao tác</div>
      </div>

      {/* Data rows */}
      {records.map((row) => {
        const itemCount = row.items.length;

        return (
          <div
            key={row.id}
            className={rowClass}
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
            <div className="w-[150px] shrink-0 text-xs font-mono text-text-primary" role="gridcell">
              {row.orderCode}
            </div>

            <div className="w-[110px] shrink-0 text-xs text-text-secondary" role="gridcell">
              {row.date}
            </div>

            <div className="flex-1 min-w-0 text-xs text-text-primary truncate" role="gridcell">
              {customerLabel(row, customers)}
            </div>

            <div className="w-[70px] shrink-0 text-xs text-right text-text-secondary font-medium" role="gridcell">
              {itemCount}
            </div>

            <div className="w-[140px] shrink-0 text-xs text-right font-semibold text-text-primary" role="gridcell">
              {formatCurrency(row.finalAmount)}
            </div>

            <div className="w-[110px] shrink-0 text-center" role="gridcell">
              <Badge variant={statusVariant(row.orderStatus)} className={statusBadgeClass(row.orderStatus)}>
                {ORDER_STATUS_LABELS[row.orderStatus]}
              </Badge>
            </div>

            {/* stopPropagation so Sửa/Xóa không kích hoạt mở chi tiết */}
            <div
              className="w-[100px] shrink-0 flex items-center justify-center gap-1"
              role="gridcell"
              onClick={(e) => e.stopPropagation()}
            >
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
                onClick={() => setConfirmDelete(row)}
              >
                <Trash2 size={12} /> Xóa
              </Button>
            </div>
          </div>
        );
      })}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa đơn “{confirmDelete?.orderCode}” không? Thao tác không hoàn tác được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
