/**
 * ExpenseGrid — Scrollable table for expense records.
 *
 * Columns: date, category badge, description, amount, status badge, actions.
 * Clicking a row opens the ExpenseDetailDialog with full expense details.
 * Row action buttons (Sửa / Xóa) are clickable without triggering the row click.
 *
 * Named export: `ExpenseGrid`, `ExpenseDetailDialog`
 */

import { useCallback, useState } from 'react';
import type { Expense, ExpenseStatus } from '@/models';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';

/* ─── Props ─── */

export interface ExpenseGridProps {
  expenses: Expense[];
  onRowClick?: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onStatusChange: (id: string, status: ExpenseStatus) => void;
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

/* ─── Helpers ─── */

function statusBadgeClass(status: ExpenseStatus): string {
  if (status === 'paid') return 'bg-success-bg text-success-fg border-success-fg/20';
  if (status === 'pending') return 'bg-warning-bg text-warning-fg border-warning-fg/20';
  return 'bg-danger-bg text-danger-fg border-danger-fg/20';
}

function statusLabel(status: ExpenseStatus): string {
  if (status === 'paid') return 'Đã thanh toán';
  if (status === 'pending') return 'Chờ thanh toán';
  return 'Đã hủy';
}

function paymentMethodLabel(method: Expense['paymentMethod']): string {
  return PAYMENT_METHOD_LABELS[method];
}

/* ─── Detail dialog ─── */

interface ExpenseDetailDialogProps {
  expense: Expense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onStatusChange: (id: string, status: ExpenseStatus) => void;
}

function ExpenseDetailDialog({ expense, open, onOpenChange, onEdit, onDelete, onStatusChange }: ExpenseDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense.description}</DialogTitle>
          <DialogDescription>{formatDate(expense.date)}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div><Label>Danh mục</Label><Badge variant="outline">{EXPENSE_CATEGORY_LABELS[expense.category]}</Badge></div>
          <div><Label>Số tiền</Label><p className="font-mono font-bold">{formatCurrency(expense.amount)}</p></div>
          <div><Label>Trạng thái</Label><Badge className={statusBadgeClass(expense.status)}>{statusLabel(expense.status)}</Badge></div>
          <div><Label>Phương thức</Label><p>{paymentMethodLabel(expense.paymentMethod)}</p></div>
          {expense.supplier && <div><Label>Nhà cung cấp</Label><p>{expense.supplier}</p></div>}
          {expense.notes && <div className="col-span-2"><Label>Ghi chú</Label><p className="text-muted-foreground">{expense.notes}</p></div>}
          {expense.tags.length > 0 && <div className="col-span-2"><Label>Tags</Label><div className="flex gap-1 flex-wrap">{expense.tags.map(t => <Badge key={t} variant="secondary">#{t}</Badge>)}</div></div>}
        </div>
        <DialogFooter className="flex items-center gap-2">
          <Button variant="default" onClick={() => { onOpenChange(false); onEdit(expense); }}><Pencil size={14}/> Chỉnh sửa</Button>
          {expense.status === 'pending' && <Button variant="secondary" onClick={() => onStatusChange(expense.id, 'paid')}><CheckCircle2 size={14}/> Đã thanh toán</Button>}
          {expense.status === 'paid' && <Button variant="outline" onClick={() => onStatusChange(expense.id, 'pending')}><Clock size={14}/> Chờ thanh toán</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Component ─── */

export function ExpenseGrid({
  expenses,
  onRowClick,
  onEdit,
  onDelete,
  onStatusChange,
}: ExpenseGridProps) {
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<Expense | null>(null);

  const handleDetailEdit = useCallback(
    (expense: Expense) => {
      setDetailExpense(null);
      onEdit(expense);
    },
    [onEdit],
  );

  const handleDetailDelete = useCallback(
    (expense: Expense) => {
      setDetailExpense(null);
      onDelete(expense);
    },
    [onDelete],
  );

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

  return (
    <div className="flex flex-col h-full" role="grid" aria-label="Expense list">
      {/* Table header */}
      <div
        className="flex items-center h-10 px-3 gap-3 bg-grid-header-bg text-grid-header-fg text-xs font-semibold border-b border-border"
        role="row"
      >
        <div className="w-[120px] shrink-0" role="columnheader">Ngày</div>
        <div className="w-[140px] shrink-0" role="columnheader">Danh mục</div>
        <div className="flex-1 min-w-0" role="columnheader">Mô tả</div>
        <div className="w-[130px] shrink-0 text-right" role="columnheader">Số tiền</div>
        <div className="w-[120px] shrink-0" role="columnheader">Trạng thái</div>
        <div className="w-[140px] shrink-0" role="columnheader">Hành động</div>
      </div>

      {/* Scrollable rows — normal document flow */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {expenses.map((expense, index) => (
          <div
            key={expense.id}
            role="row"
            tabIndex={0}
            onClick={() => handleRowClick(expense)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRowClick(expense);
              }
            }}
            className={cn(
              'flex items-center h-11 px-3 gap-3 cursor-pointer border-b border-border transition-colors duration-[var(--d-fast)]',
              index % 2 === 0 ? 'bg-grid-row-even' : 'bg-grid-row-odd',
              'hover:bg-grid-row-hover',
            )}
            data-expense-id={expense.id}
          >
            {/* Date */}
            <div className="w-[120px] shrink-0 text-xs text-text-primary">
              {formatDate(expense.date)}
            </div>

            {/* Category badge */}
            <div className="w-[140px] shrink-0">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-badge',
                  CATEGORY_STYLES[expense.category]?.bg ?? CATEGORY_STYLES['other']?.bg ?? 'bg-badge-offline-bg',
                  CATEGORY_STYLES[expense.category]?.fg ?? CATEGORY_STYLES['other']?.fg ?? 'text-badge-offline-fg',
                )}
              >
                {EXPENSE_CATEGORY_LABELS[expense.category]}
              </span>
            </div>

            {/* Description */}
            <div
              className="flex-1 min-w-0 text-xs text-text-primary"
              title={expense.description}
            >
              <span className="block text-ellipsis overflow-hidden whitespace-nowrap">
                {expense.description}
              </span>
            </div>

            {/* Amount */}
            <div className="w-[130px] shrink-0 text-xs text-text-primary text-right font-mono">
              {formatCurrency(expense.amount)}
            </div>

            {/* Status badge */}
            <div className="w-[120px] shrink-0">
              <Badge className={statusBadgeClass(expense.status)}>
                {statusLabel(expense.status)}
              </Badge>
            </div>

            {/* Actions */}
            <div
              className="w-[140px] shrink-0 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
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
      </div>

      {/* Detail dialog */}
      {detailExpense && (
        <ExpenseDetailDialog
          expense={detailExpense}
          open={detailExpense !== null}
          onOpenChange={(open) => !open && setDetailExpense(null)}
          onEdit={handleDetailEdit}
          onDelete={handleDetailDelete}
          onStatusChange={onStatusChange}
        />
      )}

      {/* Delete confirmation dialog */}
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
    </div>
  );
}
