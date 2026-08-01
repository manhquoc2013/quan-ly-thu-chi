/**
 * RevenueGrid — Orders list (pure display).
 * Desktop: wide table. Mobile: stacked cards.
 */

import { useState, useCallback } from 'react';
import type { Revenue, OrderStatus } from '@/models';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { hasDeposit, paymentSummaryLabel } from '@/utils/revenueMetrics';
import { shippingLabel } from '@/utils/orderTotals';
import { useCustomerStore } from '@/store/customerStore';
import { usePlatformStore } from '@/store/platformStore';
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
  onRowClick?: (row: Revenue) => void;
  onEdit?: (row: Revenue) => void;
  onDelete?: (row: Revenue) => void;
}

/* ─── Badge helpers ─── */

function statusVariant(status: OrderStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'new':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    default:
      return 'default';
  }
}

function statusBadgeClass(status: OrderStatus): string {
  return status === 'completed' ? 'bg-success-bg text-success-fg border-success-bg-badge' : '';
}

function paymentBadgeClass(paid: boolean): string {
  return paid
    ? 'bg-success-bg text-success-fg border-transparent text-[10px]'
    : 'bg-warning-bg text-warning-fg border-transparent text-[10px]';
}

function customerLabel(row: Revenue, customers: Array<{ id: string; name: string }>): string {
  if (row.customerId === 'walk-in') return 'Khách vãng lai';
  return (
    customers.find((c) => c.id === row.customerId)?.name ||
    row.notes?.replace(/^Khách:\s*/i, '') ||
    '—'
  );
}

/* ─── Component ─── */

export function RevenueGrid({ records, onRowClick, onEdit, onDelete }: RevenueGridProps) {
  const customers = useCustomerStore((s) => s.customers);
  const platforms = usePlatformStore((s) => s.platforms);
  const [confirmDelete, setConfirmDelete] = useState<Revenue | null>(null);

  const handleConfirmDelete = useCallback(() => {
    if (!confirmDelete) return;
    onDelete?.(confirmDelete);
    setConfirmDelete(null);
  }, [confirmDelete, onDelete]);

  const platformOf = (row: Revenue) =>
    row.platformId ? platforms.find((p) => p.id === row.platformId)?.name : undefined;

  const rowClass = [
    'flex items-center gap-[var(--s-md)] px-[var(--s-md)] h-12',
    'border-b border-border-subtle cursor-pointer',
    'transition-colors duration-[var(--d-fast)] hover:bg-surface-hover',
  ].join(' ');

  return (
    <div className="flex flex-col h-full min-h-0 overflow-auto" aria-label="Danh sách đơn hàng">
      {/* ── Mobile cards ───────────────────────────────────────────── */}
      <ul className="md:hidden flex flex-col gap-2 p-2 pb-[var(--dimens-fabClearance)] list-none m-0">
        {records.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-text-muted">Chưa có đơn hàng</li>
        )}
        {records.map((row) => {
          const itemQty = row.items.reduce((s, i) => s + i.quantity, 0);
          const platformName = platformOf(row);
          return (
            <li key={row.id}>
              <article
                role="button"
                tabIndex={0}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick?.(row);
                  }
                }}
                className={
                  'rounded-lg border border-border bg-surface px-3 py-3 ' +
                  'active:bg-surface-hover transition-colors duration-[var(--d-fast)]'
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-semibold text-text-primary truncate">
                      {row.orderCode}
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {row.date}
                      {platformName ? ` · ${platformName}` : ''}
                      {` · SL ${itemQty}`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-text-primary tabular-nums shrink-0">
                    {formatCurrency(row.finalAmount)}
                  </p>
                </div>

                <p className="text-xs text-text-primary mt-2 truncate">
                  {customerLabel(row, customers)}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <Badge
                    variant={statusVariant(row.orderStatus)}
                    className={statusBadgeClass(row.orderStatus)}
                  >
                    {ORDER_STATUS_LABELS[row.orderStatus]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={paymentBadgeClass(row.paymentStatus === 'paid')}
                  >
                    {PAYMENT_STATUS_LABELS[row.paymentStatus ?? 'unpaid']}
                  </Badge>
                </div>
                {(row.shippingFee ?? 0) > 0 && (
                  <p className="text-[11px] text-text-muted mt-1 truncate">
                    {shippingLabel(row.shippingFee ?? 0, row.shippingPayer)}
                  </p>
                )}
                {(hasDeposit(row) || row.paymentStatus === 'paid') && (
                  <p className="text-[11px] text-text-muted mt-1 truncate">
                    {paymentSummaryLabel(row)}
                  </p>
                )}

                <div
                  className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-border-subtle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="outline" size="xs" onClick={() => onEdit?.(row)}>
                    <Pencil size={12} /> Sửa
                  </Button>
                  <Button variant="destructive" size="xs" onClick={() => setConfirmDelete(row)}>
                    <Trash2 size={12} /> Xóa
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {/* ── Desktop table ──────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto pb-[var(--dimens-fabClearance)]" role="grid">
        <div className="inline-block min-w-full">
          <div
            className={
              'flex items-center gap-[var(--s-md)] px-[var(--s-md)] ' +
              'h-8 text-xs font-semibold text-grid-header-fg ' +
              'bg-grid-header-bg border-b border-border sticky top-0 z-10 min-w-[980px]'
            }
            role="row"
          >
            <div className="w-[150px] shrink-0" role="columnheader">
              Mã đơn
            </div>
            <div className="w-[100px] shrink-0" role="columnheader">
              Ngày
            </div>
            <div className="flex-1 min-w-[100px]" role="columnheader">
              Khách hàng
            </div>
            <div className="w-[56px] shrink-0 text-right" role="columnheader">
              SL
            </div>
            <div className="w-[120px] shrink-0 text-right" role="columnheader">
              Tổng tiền
            </div>
            <div className="w-[110px] shrink-0 text-center" role="columnheader">
              Trạng thái
            </div>
            <div className="w-[120px] shrink-0 text-center" role="columnheader">
              Thanh toán
            </div>
            <div className="w-[168px] shrink-0 text-center" role="columnheader">
              Thao tác
            </div>
          </div>

          {records.map((row) => {
            const itemQty = row.items.reduce((s, i) => s + i.quantity, 0);
            const platformName = platformOf(row);
            return (
              <div
                key={row.id}
                className={`${rowClass} min-w-[980px]`}
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
                  <div>{row.orderCode}</div>
                  {platformName ? (
                    <div className="text-[10px] text-text-muted font-sans truncate">{platformName}</div>
                  ) : null}
                </div>
                <div className="w-[100px] shrink-0 text-xs text-text-secondary" role="gridcell">
                  {row.date}
                </div>
                <div className="flex-1 min-w-[100px] text-xs text-text-primary truncate" role="gridcell">
                  {customerLabel(row, customers)}
                </div>
                <div
                  className="w-[56px] shrink-0 text-xs text-right text-text-secondary font-medium"
                  role="gridcell"
                >
                  {itemQty}
                </div>
                <div
                  className="w-[120px] shrink-0 text-xs text-right font-semibold text-text-primary"
                  role="gridcell"
                >
                  {formatCurrency(row.finalAmount)}
                </div>
                <div className="w-[110px] shrink-0 text-center" role="gridcell">
                  <Badge
                    variant={statusVariant(row.orderStatus)}
                    className={statusBadgeClass(row.orderStatus)}
                  >
                    {ORDER_STATUS_LABELS[row.orderStatus]}
                  </Badge>
                </div>
                <div className="w-[120px] shrink-0 text-center" role="gridcell">
                  <Badge
                    variant="outline"
                    className={paymentBadgeClass(row.paymentStatus === 'paid')}
                  >
                    {PAYMENT_STATUS_LABELS[row.paymentStatus ?? 'unpaid']}
                  </Badge>
                  {(hasDeposit(row) || row.paymentStatus === 'paid') && (
                    <p className="text-[10px] text-text-muted mt-0.5 leading-tight">
                      {paymentSummaryLabel(row)}
                    </p>
                  )}
                </div>
                <div
                  className="w-[168px] shrink-0 flex items-center justify-end gap-1.5 pr-1"
                  role="gridcell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="outline" size="xs" onClick={() => onEdit?.(row)}>
                    <Pencil size={12} /> Sửa
                  </Button>
                  <Button variant="destructive" size="xs" onClick={() => setConfirmDelete(row)}>
                    <Trash2 size={12} /> Xóa
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
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
