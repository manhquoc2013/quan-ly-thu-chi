/**
 * RevenueGrid — Orders list (pure display).
 * Desktop: wide table. Mobile: stacked cards.
 */

import { useState, useCallback, useEffect, type MouseEvent } from 'react';
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
import { Pencil, Trash2, Square, CheckSquare, CheckCircle2, Package, Star } from 'lucide-react';
import { SELECTION_BAR_HEIGHT, StickyBulkBar } from '@/ui/components/StickyBulkBar';
import { LIST_ROW_ANIM, listRowStyle } from '@/ui/components/listRowAnim';
import { updateRevenue } from '@/services/revenueService';
import { useMascotStore } from '@/store/mascotStore';
import { cn } from '@/utils/cn';
import { TableHScroll } from '@/ui/components/TableHScroll';

/* Desktop row: fixed tracks so content can exceed narrow viewports → TableHScroll. */
const REVENUE_MIN_WIDTH = 1270;
const REVENUE_GRID_COLS =
  '32px 28px minmax(140px,1.2fr) 88px minmax(120px,1fr) minmax(0,2fr) 40px 100px 110px 120px 148px';

/* ─── Props ─── */

export interface RevenueGridProps {
  records: Revenue[];
  onRowClick?: (row: Revenue) => void;
  onEdit?: (row: Revenue) => void;
  onDelete?: (row: Revenue) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkStatusChange?: (ids: string[], status: OrderStatus) => void;
  onPriorityChange?: (row: Revenue, priority: boolean) => void;
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

export function RevenueGrid({
  records,
  onRowClick,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkStatusChange,
  onPriorityChange,
}: RevenueGridProps) {
  const customers = useCustomerStore((s) => s.customers);
  const platforms = usePlatformStore((s) => s.platforms);
  const [confirmDelete, setConfirmDelete] = useState<Revenue | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const pageIdsKey = records.map((r) => r.id).join(',');
  useEffect(() => {
    setSelectedIds(new Set());
  }, [pageIdsKey]);

  const togglePriority = useCallback(
    async (row: Revenue, e: MouseEvent) => {
      e.stopPropagation();
      const next = !row.priority;
      await updateRevenue(row.id, {
        priority: next,
        priorityAt: next ? new Date().toISOString() : undefined,
      });
      useMascotStore
        .getState()
        .speak(
          next ? `Ưu tiên ${row.orderCode}! ⭐` : `Bỏ ưu tiên ${row.orderCode}`,
          next ? 'celebrate' : 'idle',
        );
      onPriorityChange?.(row, next);
    },
    [onPriorityChange],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!confirmDelete) return;
    onDelete?.(confirmDelete);
    setConfirmDelete(null);
  }, [confirmDelete, onDelete]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === records.length) return new Set();
      return new Set(records.map((r) => r.id));
    });
  }, [records]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    onBulkDelete?.(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  }, [selectedIds, onBulkDelete]);

  const handleBulkStatus = useCallback((status: OrderStatus) => {
    if (selectedIds.size === 0) return;
    onBulkStatusChange?.(Array.from(selectedIds), status);
    setSelectedIds(new Set());
  }, [selectedIds, onBulkStatusChange]);

  const allSelected = records.length > 0 && selectedIds.size === records.length;

  const platformOf = (row: Revenue) =>
    row.platformId ? platforms.find((p) => p.id === row.platformId)?.name : undefined;

  const rowGridStyle = {
    display: 'grid',
    gridTemplateColumns: REVENUE_GRID_COLS,
    width: '100%',
    alignItems: 'center',
    columnGap: '0.5rem',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    boxSizing: 'border-box',
  } as const;

  return (
    <div className="flex flex-col w-full min-w-0 max-w-full" aria-label="Danh sách đơn hàng">
      {/* ── Mobile cards ───────────────────────────────────────────── */}
      <ul className="md:hidden flex flex-col gap-2 p-2 list-none m-0">
        {records.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-text-muted">Chưa có đơn hàng</li>
        )}
        {records.map((row, index) => {
          const itemQty = row.items.reduce((s, i) => s + i.quantity, 0);
          const platformName = platformOf(row);
          const isSelected = selectedIds.has(row.id);
          return (
            <li key={row.id} className={LIST_ROW_ANIM} style={listRowStyle(index)}>
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
                  'rounded-lg border ' +
                  (isSelected
                    ? 'border-accent-fg bg-accent-bg'
                    : row.priority
                      ? 'border-warning-fg/40 bg-warning-bg'
                      : 'border-border bg-surface') +
                  ' px-3 py-3 ' +
                  'active:bg-surface-hover transition-colors duration-[var(--d-fast)]'
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(row.id); }}
                    className="p-1 -ml-1 text-text-muted hover:text-accent-fg transition-colors shrink-0"
                    aria-label={isSelected ? `Bỏ chọn ${row.orderCode}` : `Chọn ${row.orderCode}`}
                  >
                    {isSelected ? <CheckSquare size={16} className="text-accent-fg" /> : <Square size={16} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono font-semibold text-text-primary truncate flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => void togglePriority(row, e)}
                        className={
                          row.priority
                            ? 'text-warning-fg shrink-0'
                            : 'text-text-muted hover:text-warning-fg shrink-0'
                        }
                        aria-label={row.priority ? 'Bỏ ưu tiên' : 'Đánh dấu ưu tiên'}
                        title={row.priority ? 'Bỏ ưu tiên' : 'Ưu tiên'}
                      >
                        <Star size={14} fill={row.priority ? 'currentColor' : 'none'} />
                      </button>
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

                {row.items.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {row.items.map((item) => (
                      <Badge key={item.id} variant="secondary" className="text-[10px] max-w-[120px] truncate">
                        {item.name} x{item.quantity}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {row.priority ? (
                    <Badge variant="outline" className="text-[10px] bg-warning-bg text-warning-fg border-transparent">
                      Ưu tiên
                    </Badge>
                  ) : null}
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

      {/* Desktop — scroll X only inside TableHScroll; page shell never scrolls X. */}
      <div className="hidden md:block w-full min-w-0 max-w-full">
        <TableHScroll minWidth={REVENUE_MIN_WIDTH}>
          <div
            role="row"
            className="h-8 text-xs font-semibold bg-grid-header-bg text-grid-header-fg border-b border-border"
            style={rowGridStyle}
          >
            <div className="flex justify-center" role="columnheader">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-grid-header-fg hover:text-accent-fg transition-colors"
                aria-label={allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              >
                {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
              </button>
            </div>
            <div role="columnheader" aria-label="Ưu tiên" />
            <div className="min-w-0 truncate" role="columnheader">Mã đơn</div>
            <div className="min-w-0 truncate" role="columnheader">Ngày</div>
            <div className="min-w-0 truncate" role="columnheader">Khách</div>
            <div className="min-w-0 truncate" role="columnheader">Sản phẩm</div>
            <div className="text-right" role="columnheader">SL</div>
            <div className="text-right truncate" role="columnheader">Tổng tiền</div>
            <div className="text-center truncate" role="columnheader">Trạng thái</div>
            <div className="text-center truncate" role="columnheader">Thanh toán</div>
            <div className="text-center truncate" role="columnheader">Thao tác</div>
          </div>

          {records.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-text-muted">Chưa có đơn hàng</div>
          )}

          {records.map((row, index) => {
            const itemQty = row.items.reduce((s, i) => s + i.quantity, 0);
            const platformName = platformOf(row);
            const isSelected = selectedIds.has(row.id);
            return (
              <div
                key={row.id}
                role="row"
                onClick={() => onRowClick?.(row)}
                className={cn(
                  LIST_ROW_ANIM,
                  'min-h-[3rem] py-1 text-xs cursor-pointer border-b border-border-subtle',
                  'transition-colors duration-[var(--d-fast)] hover:bg-surface-hover',
                  isSelected && 'bg-grid-row-selected',
                  row.priority &&
                    !isSelected &&
                    'bg-warning-bg/70 shadow-[inset_3px_0_0_0_var(--color-warning-fg)]',
                )}
                style={{ ...rowGridStyle, ...listRowStyle(index) }}
              >
                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => toggleSelect(row.id)}
                    className="text-text-muted hover:text-accent-fg transition-colors"
                    aria-label={isSelected ? `Bỏ chọn ${row.orderCode}` : `Chọn ${row.orderCode}`}
                  >
                    {isSelected ? <CheckSquare size={15} className="text-accent-fg" /> : <Square size={15} />}
                  </button>
                </div>
                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => void togglePriority(row, e)}
                    className={
                      row.priority
                        ? 'text-warning-fg'
                        : 'text-text-muted hover:text-warning-fg'
                    }
                    aria-label={row.priority ? 'Bỏ ưu tiên' : 'Đánh dấu ưu tiên'}
                    title={row.priority ? 'Bỏ ưu tiên' : 'Ưu tiên'}
                  >
                    <Star size={14} fill={row.priority ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <div className="min-w-0 font-mono text-text-primary overflow-hidden">
                  <div className="truncate">{row.orderCode}</div>
                  {platformName ? (
                    <div className="text-[10px] text-text-muted font-sans truncate">{platformName}</div>
                  ) : null}
                </div>
                <div className="min-w-0 text-text-secondary truncate">{row.date}</div>
                <div className="min-w-0 text-text-primary truncate">{customerLabel(row, customers)}</div>
                <div className="min-w-0 overflow-hidden">
                  <div className="flex flex-wrap items-start gap-0.5">
                    {row.items.map((item) => (
                      <Badge key={item.id} variant="secondary" className="text-[10px] max-w-[120px] truncate">
                        {item.name} x{item.quantity}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right text-text-secondary font-medium tabular-nums">{itemQty}</div>
                <div className="text-right font-semibold text-text-primary tabular-nums truncate">
                  {formatCurrency(row.finalAmount)}
                </div>
                <div className="flex justify-center min-w-0 overflow-hidden">
                  <Badge
                    variant={statusVariant(row.orderStatus)}
                    className={cn('max-w-full truncate', statusBadgeClass(row.orderStatus))}
                  >
                    {ORDER_STATUS_LABELS[row.orderStatus]}
                  </Badge>
                </div>
                <div className="flex flex-col items-center justify-center min-w-0 gap-0.5 overflow-hidden">
                  <Badge
                    variant="outline"
                    className={cn('max-w-full truncate', paymentBadgeClass(row.paymentStatus === 'paid'))}
                  >
                    {PAYMENT_STATUS_LABELS[row.paymentStatus ?? 'unpaid']}
                  </Badge>
                  {(hasDeposit(row) || row.paymentStatus === 'paid') && (
                    <p className="text-[10px] text-text-muted leading-tight truncate max-w-full">
                      {paymentSummaryLabel(row)}
                    </p>
                  )}
                </div>
                <div
                  className="flex items-center justify-center gap-1.5 min-w-0"
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
        </TableHScroll>
      </div>

      {selectedIds.size > 0 && (
        <div className="shrink-0" style={{ height: SELECTION_BAR_HEIGHT }} aria-hidden />
      )}

      <StickyBulkBar
        open={selectedIds.size > 0}
        ariaLabel={`Đã chọn ${selectedIds.size} đơn hàng`}
        className="flex-wrap"
      >
        <span className="text-xs font-semibold text-accent-fg">
          Đã chọn <span className="text-sm">{selectedIds.size}</span> đơn hàng
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs"
          >
            Bỏ chọn
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkStatus('confirmed')}
            className="text-xs gap-1"
          >
            <CheckCircle2 size={13} />
            Xác nhận
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkStatus('completed')}
            className="text-xs gap-1"
          >
            <Package size={13} />
            Hoàn thành
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
            className="text-xs gap-1"
          >
            <Trash2 size={13} />
            Xóa {selectedIds.size} đơn
          </Button>
        </div>
      </StickyBulkBar>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa đơn "{confirmDelete?.orderCode}" không? Thao tác không hoàn tác được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => !open && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa nhiều</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa {selectedIds.size} đơn hàng đã chọn? Thao tác không hoàn tác được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Xóa {selectedIds.size} đơn</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
