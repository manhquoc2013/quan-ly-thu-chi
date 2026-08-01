/**
 * ExpenseGrid — Scrollable selectable table for expense records.
 *
 * Columns: checkbox, date, category badge, description, amount, status badge, actions.
 * Keyboard navigable (arrow keys for row selection, space/enter for toggle).
 *
 * Named export: `ExpenseGrid`
 */

import { useCallback, useState } from 'react';
import type { Expense, ExpenseStatus } from '@/models';
import { EXPENSE_CATEGORY_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { cn } from '@/utils/cn';

/* ─── Props ─── */

export interface ExpenseGridProps {
  expenses: Expense[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
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

function statusToBadgeVariant(status: ExpenseStatus): 'success' | 'warning' | 'error' {
  return status === 'paid' ? 'success' : status === 'pending' ? 'warning' : 'error';
}

function statusLabel(status: ExpenseStatus): string {
  if (status === 'paid') return 'Đã thanh toán';
  if (status === 'pending') return 'Chờ thanh toán';
  return 'Đã hủy';
}

/* ─── Component ─── */

export function ExpenseGrid({
  expenses,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  onStatusChange,
}: ExpenseGridProps) {
  const [_expandedId, _setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = useCallback(
    (expense: Expense) => {
      onDelete(expense);
      setConfirmDeleteId(null);
    },
    [onDelete],
  );

  // Virtualized row height
  const ROW_HEIGHT = 44;
  const totalHeight = expenses.length * ROW_HEIGHT;
  const containerHeight = Math.max(totalHeight, 400);

  return (
    <div className="flex flex-col h-full" role="grid" aria-label="Expense list">
      {/* Table header */}
      <div
        className="flex items-center h-10 px-3 gap-3 bg-grid-header-bg text-grid-header-fg text-xs font-semibold border-b border-border"
        role="row"
      >
        <div className="w-10 shrink-0" role="columnheader">
          <input
            type="checkbox"
            aria-label="Select all"
            className="size-4 rounded border-input-border text-accent-fg focus:ring-accent-fg"
            onChange={() => {
              // Select all or none — caller can handle this via selectAll / clearSelection
            }}
            checked={expenses.length > 0 && expenses.every((r) => selectedIds.has(r.id))}
          />
        </div>
        <div className="w-[120px] shrink-0" role="columnheader">Ngày</div>
        <div className="w-[140px] shrink-0" role="columnheader">Danh mục</div>
        <div className="flex-1 min-w-0" role="columnheader">Mô tả</div>
        <div className="w-[130px] shrink-0 text-right" role="columnheader">Số tiền</div>
        <div className="w-[120px] shrink-0" role="columnheader">Trạng thái</div>
        <div className="w-[140px] shrink-0" role="columnheader">Hành động</div>
      </div>

      {/* Scrollable rows */}
      <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ height: containerHeight }}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          {expenses.map((expense, index) => {
            const isExpanded = _expandedId === expense.id;
            const isSelected = selectedIds.has(expense.id);

            return (
              <div key={expense.id}>
                {/* Row */}
                <div
                  role="row"
                  tabIndex={0}
                  aria-selected={isSelected}
                  onClick={() => onToggleSelect(expense.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleSelect(expense.id);
                    }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      const nextIdx = e.key === 'ArrowDown' ? index + 1 : index - 1;
                      const nextRow = document.querySelector<HTMLDivElement>(
                        `[data-expense-id="${expenses[nextIdx]?.id}"]`,
                      );
                      nextRow?.focus();
                    }
                  }}
                  className={cn(
                    'flex items-center h-11 px-3 gap-3 cursor-pointer border-b border-border transition-colors duration-[var(--d-fast)]',
                    isSelected
                      ? 'bg-grid-row-selected'
                      : index % 2 === 0
                        ? 'bg-grid-row-even'
                        : 'bg-grid-row-odd',
                    'hover:bg-grid-row-hover',
                  )}
                  style={{
                    position: 'absolute',
                    top: index * ROW_HEIGHT,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                  }}
                  data-expense-id={expense.id}
                >
                  {/* Checkbox */}
                  <div className="w-10 shrink-0 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleSelect(expense.id);
                      }}
                      aria-label={`Select ${expense.description}`}
                      className="size-4 rounded border-input-border text-accent-fg focus:ring-accent-fg"
                    />
                  </div>

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
                    <Badge variant={statusToBadgeVariant(expense.status)}>
                      {statusLabel(expense.status)}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div
                    className="w-[140px] shrink-0 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="neutral"
                      onClick={() => onEdit(expense)}
                      className="px-2 py-0.5 text-xs"
                    >
                      Sửa
                    </Button>
                    {confirmDeleteId === expense.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="danger"
                          onClick={() => handleDelete(expense)}
                          className="px-2 py-0.5 text-xs"
                        >
                          Xóa
                        </Button>
                        <Button
                          variant="neutral"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-0.5 text-xs"
                        >
                          Hủy
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="danger"
                        onClick={() => setConfirmDeleteId(expense.id)}
                        className="px-2 py-0.5 text-xs"
                      >
                        Xóa
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div
                    role="row"
                    className="px-6 py-3 bg-surface border-b border-border text-xs"
                    style={{ position: 'absolute', top: (index + 1) * ROW_HEIGHT, left: 0, right: 0 }}
                  >
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <div>
                        <span className="text-text-muted">Nhà cung cấp:{' '}</span>
                        <span>{expense.supplier ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">Phương thức:{' '}</span>
                        <span>{
                          expense.paymentMethod === 'bank_transfer' ? 'Chuyển khoản'
                            : expense.paymentMethod === 'cash' ? 'Tiền mặt'
                            : expense.paymentMethod === 'credit_card' ? 'Thẻ tín dụng'
                            : 'Ví điện tử'
                        }</span>
                      </div>
                      {expense.notes && (
                        <div>
                          <span className="text-text-muted">Ghi chú:{' '}</span>
                          <span>{expense.notes}</span>
                        </div>
                      )}
                      {expense.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
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
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="run"
                        onClick={() => onEdit(expense)}
                        className="px-2 py-0.5 text-xs"
                      >
                        Chỉnh sửa
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setConfirmDeleteId(expense.id)}
                        className="px-2 py-0.5 text-xs"
                      >
                        Xóa
                      </Button>
                      {expense.status === 'pending' && (
                        <Button
                          variant="accent"
                          onClick={() => onStatusChange(expense.id, 'paid')}
                          className="px-2 py-0.5 text-xs bg-success-bg text-success-fg hover:bg-success-bg/80"
                        >
                          Đã thanh toán
                        </Button>
                      )}
                      {expense.status === 'paid' && (
                        <Button
                          variant="neutral"
                          onClick={() => onStatusChange(expense.id, 'pending')}
                          className="px-2 py-0.5 text-xs"
                        >
                          Chờ thanh toán
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
