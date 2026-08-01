/**
 * ExpenseGrid — Scrollable table for expense records.
 *
 * Columns: date, category badge, description, amount, actions.
 * Clicking a row opens the ExpenseDetailDialog with full expense details.
 * Row action buttons (Sửa / Xóa) are clickable without triggering the row click.
 */

import { useCallback, useState } from 'react';
import type { Expense } from '@/models';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';

/* ─── Props ─── */

export interface ExpenseGridProps {
  expenses: Expense[];
  onRowClick?: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
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

interface ExpenseDetailDialogProps {
  expense: Expense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (expense: Expense) => void;
}

function ExpenseDetailDialog({ expense, open, onOpenChange, onEdit }: ExpenseDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg !flex !flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle>{expense.description}</DialogTitle>
          <DialogDescription>{formatDate(expense.date)}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-4 py-4">
            <div><Label>Danh mục</Label><Badge variant="outline">{EXPENSE_CATEGORY_LABELS[expense.category]}</Badge></div>
            <div><Label>Số tiền</Label><p className="font-mono font-bold">{formatCurrency(expense.amount)}</p></div>
            <div><Label>Phương thức</Label><p>{paymentMethodLabel(expense.paymentMethod)}</p></div>
            {expense.supplier && <div><Label>Nhà cung cấp</Label><p>{expense.supplier}</p></div>}
            {expense.notes && <div className="col-span-2"><Label>Ghi chú</Label><p className="text-muted-foreground">{expense.notes}</p></div>}
            {expense.tags.length > 0 && <div className="col-span-2"><Label>Tags</Label><div className="flex gap-1 flex-wrap">{expense.tags.map(t => <Badge key={t} variant="secondary">#{t}</Badge>)}</div></div>}
          </div>
        </div>
        <DialogFooter className="flex items-center gap-2 px-6 py-3 border-t border-border shrink-0 bg-muted/30">
          <Button variant="default" onClick={() => { onOpenChange(false); onEdit(expense); }}><Pencil size={14}/> Chỉnh sửa</Button>
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
    <div className="flex flex-col h-full min-h-0 overflow-auto" role="grid" aria-label="Expense list">
      <div className="inline-block min-w-full pb-[var(--dimens-fabClearance)]">
      <div
        className="flex items-center h-10 px-3 gap-3 bg-grid-header-bg text-grid-header-fg text-xs font-semibold border-b border-border sticky top-0 z-10 min-w-[760px]"
        role="row"
      >
        <div className="w-[110px] shrink-0" role="columnheader">Ngày</div>
        <div className="w-[140px] shrink-0" role="columnheader">Danh mục</div>
        <div className="flex-1 min-w-[120px]" role="columnheader">Mô tả</div>
        <div className="w-[120px] shrink-0 text-right" role="columnheader">Số tiền</div>
        <div className="w-[168px] shrink-0 text-center" role="columnheader">Hành động</div>
      </div>

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
              'flex items-center h-11 px-3 gap-3 cursor-pointer border-b border-border transition-colors duration-[var(--d-fast)] min-w-[760px]',
              index % 2 === 0 ? 'bg-grid-row-even' : 'bg-grid-row-odd',
              'hover:bg-grid-row-hover',
            )}
            data-expense-id={expense.id}
          >
            <div className="w-[110px] shrink-0 text-xs text-text-primary">
              {formatDate(expense.date)}
            </div>

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

            <div
              className="flex-1 min-w-[120px] text-xs text-text-primary"
              title={expense.description}
            >
              <span className="block text-ellipsis overflow-hidden whitespace-nowrap">
                {expense.description}
              </span>
            </div>

            <div className="w-[120px] shrink-0 text-xs text-text-primary text-right font-mono">
              {formatCurrency(expense.amount)}
            </div>

            <div
              className="w-[168px] shrink-0 flex items-center justify-end gap-1.5"
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

      {detailExpense && (
        <ExpenseDetailDialog
          expense={detailExpense}
          open={detailExpense !== null}
          onOpenChange={(open) => !open && setDetailExpense(null)}
          onEdit={handleDetailEdit}
        />
      )}

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
