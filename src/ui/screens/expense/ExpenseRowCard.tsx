/**
 * ExpenseRowCard — Expandable row card for a single expense.
 *
 * Shows a compact summary line; clicking expands to reveal full detail
 * (supplier, payment method, notes, tags, invoice preview).
 *
 * Action buttons: edit, delete.
 */

import { useState, useCallback } from 'react';
import type { Expense } from '@/models';
import { EXPENSE_CATEGORY_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/utils/cn';

/* ─── Props ─── */

export interface ExpenseRowCardProps {
  expense: Expense;
  onSelect: (id: string) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  isSelected?: boolean;
}

function paymentMethodLabel(method: string): string {
  if (method === 'bank_transfer') return 'Chuyển khoản';
  if (method === 'cash') return 'Tiền mặt';
  if (method === 'credit_card') return 'Thẻ tín dụng';
  return 'Ví điện tử';
}

/* ─── Component ─── */

export function ExpenseRowCard({
  expense,
  onSelect,
  onEdit,
  onDelete,
  isSelected = false,
}: ExpenseRowCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
    onSelect(expense.id);
  }, [expense.id, onSelect]);

  return (
    <div
      className={cn(
        'border border-border rounded-panel overflow-hidden transition-colors duration-[var(--d-fast)]',
        isSelected ? 'ring-2 ring-input-focus-ring' : '',
      )}
      role="row"
      aria-expanded={expanded}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Expense: ${expense.description}`}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        className="flex items-center h-[52px] px-4 cursor-pointer bg-surface hover:bg-surface-hover transition-colors duration-[var(--d-fast)]"
      >
        <div className="w-6 shrink-0 flex items-center justify-center mr-2">
          <svg
            className={cn(
              'w-4 h-4 text-text-muted transition-transform duration-[var(--d-fast)]',
              expanded ? 'rotate-90' : '',
            )}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="w-8 shrink-0 flex items-center justify-center mr-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(expense.id);
            }}
            aria-label={`Select ${expense.description}`}
            className="size-4 rounded border-input-border text-accent-fg focus:ring-accent-fg"
          />
        </div>

        <div className="w-[120px] shrink-0 text-xs text-text-primary">
          {formatDate(expense.date)}
        </div>

        <div className="w-[150px] shrink-0">
          <Badge variant="outline">{EXPENSE_CATEGORY_LABELS[expense.category]}</Badge>
        </div>

        <div className="flex-1 min-w-0 text-xs text-text-primary">
          <span className="block text-ellipsis overflow-hidden whitespace-nowrap">
            {expense.description}
          </span>
        </div>

        <div className="w-[130px] shrink-0 text-xs text-text-primary text-right font-mono">
          {formatCurrency(expense.amount)}
        </div>

        <div className="w-[160px] shrink-0 flex items-center gap-1 ml-3">
          <Button
            variant="outline"
            onClick={() => {
              onEdit(expense);
            }}
            className="px-2 py-0.5 text-xs"
          >
            <Pencil size={14} /> Sửa
          </Button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete(expense);
                  setConfirmDelete(false);
                }}
                className="px-2 py-0.5 text-xs"
              >
                <Trash2 size={14} /> Xóa
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDelete(false);
                }}
                className="px-2 py-0.5 text-xs"
              >
                <X size={14} /> Hủy
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDelete(true);
              }}
              className="px-2 py-0.5 text-xs"
            >
              <Trash2 size={14} /> Xóa
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          role="region"
          aria-label={`Details for ${expense.description}`}
          className="bg-surface border-t border-border px-4 py-4"
        >
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs">
            <div>
              <span className="text-text-muted">Ngày:{' '}</span>
              <span className="text-text-primary">{formatDate(expense.date)}</span>
            </div>
            <div>
              <span className="text-text-muted">Danh mục:{' '}</span>
              <Badge variant="outline">{EXPENSE_CATEGORY_LABELS[expense.category]}</Badge>
            </div>
            <div>
              <span className="text-text-muted">Số tiền:{' '}</span>
              <span className="font-mono text-text-primary">
                {formatCurrency(expense.amount)}
              </span>
            </div>
            {expense.supplier && (
              <div>
                <span className="text-text-muted">Nhà cung cấp:{' '}</span>
                <span className="text-text-primary">{expense.supplier}</span>
              </div>
            )}
            <div>
              <span className="text-text-muted">Phương thức:{' '}</span>
              <span className="text-text-primary">
                {paymentMethodLabel(expense.paymentMethod)}
              </span>
            </div>
            {expense.notes && (
              <div className="w-full">
                <span className="text-text-muted">Ghi chú:{' '}</span>
                <span className="text-text-primary">{expense.notes}</span>
              </div>
            )}
            {expense.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {expense.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-neutral-bg text-neutral-fg rounded-badge text-xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="w-full pt-2 border-t border-border-subtle text-text-muted">
              <span>Được tạo: {formatDate(expense.createdAt)}</span>
              <span className="ml-4">Cập nhật: {formatDate(expense.updatedAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="default"
              onClick={() => {
                onEdit(expense);
              }}
              className="px-3 py-1 text-xs"
            >
              <Pencil size={14} /> Chỉnh sửa
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(expense);
              }}
              className="px-3 py-1 text-xs"
            >
              <Trash2 size={14} /> Xóa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
