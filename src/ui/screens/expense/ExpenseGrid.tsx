/**
 * ExpenseGrid — Scrollable table for expense records.
 *
 * Columns: date, category badge, description, amount, actions.
 * Clicking a row opens the ExpenseDetailDialog with full expense details.
 * Row action buttons (Sửa / Xóa) are clickable without triggering the row click.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Expense } from '@/models';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/models';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Square, CheckSquare } from 'lucide-react';
import { cn } from '@/utils/cn';
import { DetailField, EntityDetailDialog } from '@/ui/components/EntityDetailDialog';
import { SELECTION_BAR_HEIGHT, StickyBulkBar } from '@/ui/components/StickyBulkBar';
import { LIST_ROW_ANIM, listRowStyle } from '@/ui/components/listRowAnim';
import { useProductStore } from '@/store/productStore';
import { TableHScroll } from '@/ui/components/TableHScroll';

const EXPENSE_MIN_WIDTH = 800;
const EXPENSE_GRID_COLS = '32px 100px 120px minmax(140px,1fr) 100px 148px';

/* ─── Props ─── */

export interface ExpenseGridProps {
  expenses: Expense[];
  onRowClick?: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onBulkDelete?: (ids: string[]) => void;
  /** Open detail for this id (e.g. AI deep-link) */
  peekExpenseId?: string | null;
  onPeekConsumed?: () => void;
}

/* ─── Category badge colours ─── */

const CATEGORY_STYLES: Record<string, { bg: string; fg: string }> = {
  office: { bg: 'bg-badge-offline-bg', fg: 'text-badge-offline-fg' },
  rent: { bg: 'bg-badge-warning-bg', fg: 'text-badge-warning-fg' },
  utilities: { bg: 'bg-badge-error-bg', fg: 'text-badge-error-fg' },
  salary: { bg: 'bg-badge-online-bg', fg: 'text-badge-online-fg' },
  marketing: { bg: 'bg-badge-warning-bg', fg: 'text-badge-warning-fg' },
  supplies: { bg: 'bg-badge-offline-bg', fg: 'text-badge-offline-fg' },
  transportation: { bg: 'bg-badge-online-bg', fg: 'text-badge-online-fg' },
  maintenance: { bg: 'bg-badge-error-bg', fg: 'text-badge-error-fg' },
  tax: { bg: 'bg-badge-warning-bg', fg: 'text-badge-warning-fg' },
  other: { bg: 'bg-badge-offline-bg', fg: 'text-badge-offline-fg' },
};

function paymentMethodLabel(method: Expense['paymentMethod']): string {
  return PAYMENT_METHOD_LABELS[method];
}

/* ─── Detail dialog ─── */

function ExpenseDetailBody({ expense }: { expense: Expense }) {
  const products = useProductStore((s) => s.products);
  const stockProduct = expense.stockProductId
    ? products.find((p) => p.id === expense.stockProductId)
    : undefined;

  return (
    <div className="grid grid-cols-2 gap-4">
      <DetailField label="Danh mục">
        <Badge variant="outline">{EXPENSE_CATEGORY_LABELS[expense.category]}</Badge>
      </DetailField>
      <DetailField label="Số tiền">
        <p className="font-mono font-bold">{formatCurrency(expense.amount)}</p>
      </DetailField>
      <DetailField label="Trạng thái">
        {EXPENSE_STATUS_LABELS[expense.status]}
      </DetailField>
      <DetailField label="Phương thức">{paymentMethodLabel(expense.paymentMethod)}</DetailField>
      {expense.supplier ? (
        <DetailField label="Nhà cung cấp">{expense.supplier}</DetailField>
      ) : null}
      {expense.stockQtyIn ? (
        <DetailField label="Nhập kho" className="col-span-2">
          +{expense.stockQtyIn}
          {stockProduct ? ` × ${stockProduct.name}` : ''}
          {expense.stockApplied ? ' · đã cộng tồn' : ''}
        </DetailField>
      ) : null}
      {expense.notes ? (
        <DetailField label="Ghi chú" className="col-span-2">
          <p className="text-text-muted">{expense.notes}</p>
        </DetailField>
      ) : null}
      {expense.tags.length > 0 ? (
        <DetailField label="Tags" className="col-span-2">
          <div className="flex gap-1 flex-wrap">
            {expense.tags.map((t) => (
              <Badge key={t} variant="secondary">
                #{t}
              </Badge>
            ))}
          </div>
        </DetailField>
      ) : null}
    </div>
  );
}

/* ─── Component ─── */

export function ExpenseGrid({
  expenses,
  onRowClick,
  onEdit,
  onDelete,
  onBulkDelete,
  peekExpenseId,
  onPeekConsumed,
}: ExpenseGridProps) {
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<Expense | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    if (!peekExpenseId) return;
    const row = expenses.find((e) => e.id === peekExpenseId);
    if (row) setDetailExpense(row);
    onPeekConsumed?.();
  }, [peekExpenseId, expenses, onPeekConsumed]);

  const pageIdsKey = expenses.map((e) => e.id).join(',');
  useEffect(() => {
    setSelectedIds(new Set());
  }, [pageIdsKey]);

  const handleRowClick = useCallback(
    (expense: Expense) => {
      setDetailExpense(expense);
      onRowClick?.(expense);
    },
    [onRowClick],
  );

  const handleDelete = useCallback(
    () => {
      if (confirmDeleteId) {
        onDelete(confirmDeleteId);
        setConfirmDeleteId(null);
      }
    },
    [onDelete, confirmDeleteId],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === expenses.length) return new Set();
      return new Set(expenses.map((e) => e.id));
    });
  }, [expenses]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    onBulkDelete?.(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  }, [selectedIds, onBulkDelete]);

  const allSelected = expenses.length > 0 && selectedIds.size === expenses.length;

  const rowGridStyle = {
    display: 'grid',
    gridTemplateColumns: EXPENSE_GRID_COLS,
    width: '100%',
    alignItems: 'center',
    columnGap: '0.5rem',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    boxSizing: 'border-box',
  } as const;

  return (
    <div className="flex flex-col w-full min-w-0 max-w-full" aria-label="Expense list">
      <TableHScroll minWidth={EXPENSE_MIN_WIDTH}>
        <div
          role="row"
          className="h-10 text-xs font-semibold bg-grid-header-bg text-grid-header-fg border-b border-border"
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
          <div role="columnheader">Ngày</div>
          <div role="columnheader">Danh mục</div>
          <div className="min-w-0" role="columnheader">Mô tả</div>
          <div className="text-right" role="columnheader">Số tiền</div>
          <div className="text-center" role="columnheader">Hành động</div>
        </div>

        {expenses.map((expense, index) => (
          <div
            key={expense.id}
            role="row"
            onClick={() => handleRowClick(expense)}
            className={cn(
              LIST_ROW_ANIM,
              'h-11 text-xs cursor-pointer border-b border-border transition-colors duration-[var(--d-fast)]',
              index % 2 === 0 ? 'bg-grid-row-even' : 'bg-grid-row-odd',
              'hover:bg-grid-row-hover',
              selectedIds.has(expense.id) ? 'bg-grid-row-selected' : '',
            )}
            style={{ ...rowGridStyle, ...listRowStyle(index) }}
            data-expense-id={expense.id}
          >
            <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => toggleSelect(expense.id)}
                className="text-text-muted hover:text-accent-fg transition-colors"
                aria-label={selectedIds.has(expense.id) ? `Bỏ chọn ${expense.description}` : `Chọn ${expense.description}`}
              >
                {selectedIds.has(expense.id) ? <CheckSquare size={15} className="text-accent-fg" /> : <Square size={15} />}
              </button>
            </div>
            <div className="text-text-primary truncate">{formatDate(expense.date)}</div>
            <div className="min-w-0 overflow-hidden">
              <span
                className={cn(
                  'inline-flex max-w-full truncate items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-badge',
                  CATEGORY_STYLES[expense.category]?.bg ?? CATEGORY_STYLES['other']?.bg ?? 'bg-badge-offline-bg',
                  CATEGORY_STYLES[expense.category]?.fg ?? CATEGORY_STYLES['other']?.fg ?? 'text-badge-offline-fg',
                )}
              >
                {EXPENSE_CATEGORY_LABELS[expense.category]}
              </span>
            </div>
            <div className="min-w-0 text-text-primary truncate" title={expense.description}>
              {expense.description}
            </div>
            <div className="text-right font-mono text-text-primary tabular-nums truncate">
              {formatCurrency(expense.amount)}
            </div>
            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="xs"
                onClick={() => onEdit(expense)}
                className="px-2 py-0.5 text-xs"
              >
                <Pencil size={12} /> Sửa
              </Button>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => setConfirmDeleteId(expense)}
                className="px-2 py-0.5 text-xs"
              >
                <Trash2 size={12} /> Xóa
              </Button>
            </div>
          </div>
        ))}
      </TableHScroll>

      {selectedIds.size > 0 && (
        <div className="shrink-0" style={{ height: SELECTION_BAR_HEIGHT }} aria-hidden />
      )}

      <StickyBulkBar
        open={selectedIds.size > 0}
        ariaLabel={`Đã chọn ${selectedIds.size} chi phí`}
      >
        <span className="text-xs font-semibold text-accent-fg">
          Đã chọn <span className="text-sm">{selectedIds.size}</span> chi phí
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs"
          >
            Bỏ chọn
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
            className="text-xs gap-1"
          >
            <Trash2 size={13} />
            Xóa {selectedIds.size} mục
          </Button>
        </div>
      </StickyBulkBar>

      <EntityDetailDialog
        open={detailExpense !== null}
        onOpenChange={(open) => !open && setDetailExpense(null)}
        title={detailExpense?.description ?? 'Chi phí'}
        description={detailExpense ? formatDate(detailExpense.date) : undefined}
      >
        {detailExpense ? <ExpenseDetailBody expense={detailExpense} /> : null}
      </EntityDetailDialog>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>Bạn có chắc muốn xóa "{confirmDeleteId?.description}" không?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => !open && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa nhiều</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa {selectedIds.size} chi phí đã chọn? Thao tác không hoàn tác được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Xóa {selectedIds.size} mục</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
