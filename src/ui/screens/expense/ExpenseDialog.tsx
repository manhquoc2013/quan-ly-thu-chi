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
import { Loader2, X, Check } from 'lucide-react';
import type { Expense, ExpenseCategory, PaymentMethod } from '@/models';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/models';
import { createExpense, updateExpense } from '@/services/expenseService';
import { formatCurrencyInput, parseCurrency } from '@/utils/currency';
import { todayISO } from '@/utils/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DatePicker } from '@/ui/components/DatePicker';
import { Dropdown, optionsFromLabels } from '@/ui/components/Dropdown';

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

const CATEGORY_OPTIONS = optionsFromLabels(EXPENSE_CATEGORY_LABELS);
const PAYMENT_OPTIONS = optionsFromLabels(PAYMENT_METHOD_LABELS);

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
          amount: formatCurrencyInput(String(editExpense.amount)),
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
    async (e?: React.FormEvent) => {
      e?.preventDefault();
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <DialogContent className="max-w-[640px] !flex !flex-col overflow-hidden p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle>{editExpense ? 'Chỉnh sửa chi phí' : 'Thêm chi phí mới'}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <form ref={formRef} onSubmit={(e) => { handleSubmit(e); }} noValidate>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {/* Date */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-text-muted">Ngày chi phí <span className="text-danger-fg">*</span></Label>
              <DatePicker
                value={form.date}
                onChange={handleChange('date')}
                aria-label="Ngày chi phí"
              />
              {errors.date && <p className="text-[10px] text-danger-fg">{errors.date}</p>}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-text-muted">Danh mục <span className="text-danger-fg">*</span></Label>
              <Dropdown
                options={CATEGORY_OPTIONS}
                value={form.category}
                onChange={handleChange('category')}
                placeholder="Chọn danh mục"
                aria-label="Danh mục"
              />
              {errors.category && <p className="text-[10px] text-danger-fg">{errors.category}</p>}
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-text-muted">Số tiền (VND) <span className="text-danger-fg">*</span></Label>
              <Input
                type="text"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) =>
                  handleChange('amount')(formatCurrencyInput(e.target.value))
                }
                onBlur={handleAmountBlur}
                placeholder="VD: 300.000"
                aria-label="Số tiền"
                aria-invalid={!!errors.amount}
                className={errors.amount ? 'border-danger-fg font-mono' : 'font-mono'}
              />
              {errors.amount && <p className="text-[10px] text-danger-fg">{errors.amount}</p>}
            </div>

            {/* Payment Method */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-text-muted">Phương thức thanh toán</Label>
              <Dropdown
                options={PAYMENT_OPTIONS}
                value={form.paymentMethod}
                onChange={handleChange('paymentMethod')}
                placeholder="Chọn phương thức"
                aria-label="Phương thức thanh toán"
              />
              {errors.paymentMethod && <p className="text-[10px] text-danger-fg">{errors.paymentMethod}</p>}
            </div>

            {/* Description (full width) */}
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs font-medium text-text-muted">Mô tả <span className="text-danger-fg">*</span></Label>
              <Textarea
                value={form.description}
                onChange={(e) => handleChange('description')(e.target.value)}
                placeholder="Mô tả chi phí..."
                aria-label="Mô tả chi phí"
                aria-invalid={!!errors.description}
                className={errors.description ? 'border-danger-fg' : ''}
              />
              {errors.description && <p className="text-[10px] text-danger-fg">{errors.description}</p>}
            </div>

            {/* Supplier */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-text-muted">Nhà cung cấp</Label>
              <Input
                type="text"
                value={form.supplier}
                onChange={(e) => handleChange('supplier')(e.target.value)}
                placeholder="Tên nhà cung cấp"
                aria-label="Nhà cung cấp"
              />
              {errors.supplier && <p className="text-[10px] text-danger-fg">{errors.supplier}</p>}
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-text-muted">Tags</Label>
              <Input
                type="text"
                value={form.tags}
                onChange={(e) => handleChange('tags')(e.target.value)}
                placeholder="tag1, tag2, tag3 (tối đa 10)"
                aria-label="Tags"
              />
              {errors.tags && <p className="text-[10px] text-danger-fg">{errors.tags}</p>}
            </div>

            {/* Notes (full width) */}
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs font-medium text-text-muted">Ghi chú</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => handleChange('notes')(e.target.value)}
                placeholder="Ghi chú thêm..."
                aria-label="Ghi chú"
              />
              {errors.notes && <p className="text-[10px] text-danger-fg">{errors.notes}</p>}
            </div>
          </div>
        </form>
        </div>
        <DialogFooter className="px-6 py-3 border-t border-border shrink-0 bg-muted/30">
          <Button variant="outline" onClick={handleCancel}>
            <X size={14} /> Hủy
          </Button>
          <Button variant="default" disabled={saving} onClick={() => { handleSubmit(); }}>
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
            {editExpense ? 'Cập nhật' : 'Thêm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
