/**
 * ExpenseDialog — Add / edit expense form in a modal dialog.
 *
 * Fields: date, category, amount (VND), description, payment method,
 * supplier, notes, tags.
 *
 * Validation: amount > 0, description non-empty.
 *
 * Named export: `ExpenseDialog`
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Expense, ExpenseCategory, PaymentMethod } from '@/models';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/models';
import { createExpense, updateExpense } from '@/services/expenseService';
import { useExpenseStore } from '@/store/expenseStore';
import { formatCurrencyInput, parseCurrency } from '@/utils/currency';
import { todayISO } from '@/utils/date';
import { cn } from '@/utils/cn';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { Dropdown, type DropdownOption } from '@/ui/components/Dropdown';
import { DatePicker } from '@/ui/components/DatePicker';

/* ─── Form state ─── */

interface FormState {
  date: string;
  category: ExpenseCategory;
  amount: string;
  description: string;
  paymentMethod: PaymentMethod;
  supplier: string;
  notes: string;
  tags: string;
}

const EMPTY_FORM: FormState = {
  date: todayISO(),
  category: 'office',
  amount: '',
  description: '',
  paymentMethod: 'bank_transfer',
  supplier: '',
  notes: '',
  tags: '',
};

/* ─── Dropdown options ─── */

const CATEGORY_OPTIONS: DropdownOption[] = Object.entries(EXPENSE_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const PAYMENT_OPTIONS: DropdownOption[] = Object.entries(PAYMENT_METHOD_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/* ─── Props ─── */

export interface ExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  editExpense?: Expense | null;
}

/* ─── Component ─── */

export function ExpenseDialog({ open, onClose, editExpense }: ExpenseDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form on open / edit change
  useEffect(() => {
    if (open) {
      if (editExpense) {
        setForm({
          date: editExpense.date,
          category: editExpense.category,
          amount: editExpense.amount.toString(),
          description: editExpense.description,
          paymentMethod: editExpense.paymentMethod,
          supplier: editExpense.supplier ?? '',
          notes: editExpense.notes ?? '',
          tags: editExpense.tags.join(', '),
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
      setSaving(false);
    }
  }, [open, editExpense]);

  const handleChange = useCallback(
    (field: keyof FormState) => (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const handleAmountFocus = useCallback(() => {
    setForm((prev) => ({ ...prev, amount: parseCurrency(prev.amount).toString() }));
  }, []);

  const handleAmountBlur = useCallback(() => {
    setForm((prev) => ({ ...prev, amount: formatCurrencyInput(prev.amount) }));
  }, []);

  const validate = useCallback((): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.description.trim()) {
      errs.description = 'Mô tả không được để trống';
    }
    const amountNum = parseCurrency(form.amount);
    if (amountNum <= 0) {
      errs.amount = 'Số tiền phải lớn hơn 0';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form.description, form.amount]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setSaving(true);

      const amountNum = parseCurrency(form.amount);
      const tagsArr = form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10);

      if (editExpense) {
        await updateExpense(editExpense.id, {
          date: form.date,
          category: form.category,
          amount: amountNum,
          description: form.description.trim(),
          paymentMethod: form.paymentMethod,
          supplier: form.supplier.trim() || undefined,
          notes: form.notes.trim() || undefined,
          tags: tagsArr,
        });
      } else {
        await createExpense({
          date: form.date,
          category: form.category,
          amount: amountNum,
          description: form.description.trim(),
          status: 'pending',
          paymentMethod: form.paymentMethod,
          supplier: form.supplier.trim() || undefined,
          notes: form.notes.trim() || undefined,
          tags: tagsArr,
        });
      }

      setSaving(false);
      onClose();
    },
    [form, editExpense, validate, onClose],
  );

  const handleCancel = useCallback(() => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSaving(false);
    onClose();
  }, [onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      title={editExpense ? 'Chỉnh sửa chi phí' : 'Thêm chi phí mới'}
      width={640}
      footer={
        <>
          <Button variant="neutral" onClick={() => { handleCancel(); }}>
            Hủy
          </Button>
          <Button variant="run" busy={saving} onClick={() => { handleSubmit({} as React.FormEvent); }}>
            {editExpense ? 'Cập nhật' : 'Thêm'}
          </Button>
        </>
      }
    >
      <form ref={formRef} onSubmit={(e) => { handleSubmit(e); }} noValidate>
        <div className="flex flex-col gap-5">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Ngày chi phí{' '}
              <span className="text-danger-fg">*</span>
            </label>
            <DatePicker
              value={form.date}
              onChange={handleChange('date')}
              aria-label="Ngày chi phí"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Danh mục{' '}
              <span className="text-danger-fg">*</span>
            </label>
            <Dropdown
              options={CATEGORY_OPTIONS}
              value={form.category}
              onChange={handleChange('category')}
              placeholder="Chọn danh mục"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Số tiền (VND){' '}
              <span className="text-danger-fg">*</span>
            </label>
            <input
              type="text"
              value={form.amount}
              onChange={(e) =>
                handleChange('amount')(formatCurrencyInput(e.target.value))
              }
              onFocus={handleAmountFocus}
              onBlur={handleAmountBlur}
              placeholder="Nhập số tiền"
              aria-label="Số tiền"
              className={cn(
                'w-full h-9 px-3 text-sm',
                'bg-input-bg',
                'rounded-field',
                'text-text-primary',
                'focus:outline-none focus:ring-2 focus:ring-input-focus-ring',
                'transition-colors duration-[var(--d-fast)]',
                'hover:border-input-focus-ring',
                errors.amount
                  ? 'border-danger-fg'
                  : 'border-input-border',
              )}
            />
            {errors.amount && (
              <p className="mt-1 text-xs text-danger-fg">{errors.amount}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Mô tả{' '}
              <span className="text-danger-fg">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description')(e.target.value)}
              rows={2}
              placeholder="Mô tả chi phí..."
              aria-label="Mô tả chi phí"
              className={cn(
                'w-full px-3 py-2 text-sm resize-none',
                'bg-input-bg',
                'rounded-field',
                'text-text-primary',
                'focus:outline-none focus:ring-2 focus:ring-input-focus-ring',
                'transition-colors duration-[var(--d-fast)]',
                errors.description
                  ? 'border-danger-fg'
                  : 'border-input-border',
              )}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-danger-fg">{errors.description}</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Phương thức thanh toán
            </label>
            <Dropdown
              options={PAYMENT_OPTIONS}
              value={form.paymentMethod}
              onChange={handleChange('paymentMethod')}
              placeholder="Chọn phương thức"
            />
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Nhà cung cấp
            </label>
            <input
              type="text"
              value={form.supplier}
              onChange={(e) => handleChange('supplier')(e.target.value)}
              placeholder="Tên nhà cung cấp"
              aria-label="Nhà cung cấp"
              className="w-full h-9 px-3 text-sm bg-input-bg border border-input-border rounded-field text-text-primary focus:outline-none focus:ring-2 focus:ring-input-focus-ring transition-colors duration-[var(--d-fast)] hover:border-input-focus-ring"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Ghi chú
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes')(e.target.value)}
              rows={2}
              placeholder="Ghi chú thêm..."
              aria-label="Ghi chú"
              className="w-full px-3 py-2 text-sm resize-none bg-input-bg border border-input-border rounded-field text-text-primary focus:outline-none focus:ring-2 focus:ring-input-focus-ring transition-colors duration-[var(--d-fast)]"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Tags
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => handleChange('tags')(e.target.value)}
              placeholder="tag1, tag2, tag3 (tối đa 10)"
              aria-label="Tags"
              className="w-full h-9 px-3 text-sm bg-input-bg border border-input-border rounded-field text-text-primary focus:outline-none focus:ring-2 focus:ring-input-focus-ring transition-colors duration-[var(--d-fast)] hover:border-input-focus-ring"
            />
          </div>
        </div>
      </form>
    </Dialog>
  );
}
