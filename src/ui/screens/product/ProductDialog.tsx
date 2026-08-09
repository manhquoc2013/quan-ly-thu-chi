/**
 * ProductDialog — Add / edit product form.
 */

import { useState, useCallback, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';
import type { Product } from '@/models';
import { createProduct, updateProduct } from '@/services/productService';
import { notify } from '@/utils/notify';
import { formatCurrencyInput, parseCurrency } from '@/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FieldErrorTip, useFieldErrorTips } from '@/ui/components/FieldErrorTip';

interface FormState {
  name: string;
  defaultUnitPrice: string;
  unit: string;
  stockQty: string;
  sku: string;
  notes: string;
}

const EMPTY: FormState = {
  name: '',
  defaultUnitPrice: '',
  unit: 'cái',
  stockQty: '0',
  sku: '',
  notes: '',
};

export interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  editProduct?: Product | null;
}

export function ProductDialog({ open, onClose, editProduct }: ProductDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const { tipKeys, bumpTips, resetTips } = useFieldErrorTips<'name'>();

  useEffect(() => {
    if (!open) return;
    if (editProduct) {
      setForm({
        name: editProduct.name,
        defaultUnitPrice: editProduct.defaultUnitPrice
          ? formatCurrencyInput(String(editProduct.defaultUnitPrice))
          : '',
        unit: editProduct.unit || 'cái',
        stockQty: String(editProduct.stockQty ?? 0),
        sku: editProduct.sku ?? '',
        notes: editProduct.notes ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    setNameError('');
    resetTips();
    setSaving(false);
  }, [open, editProduct, resetTips]);

  const setField = useCallback((field: keyof FormState, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (field === 'name') setNameError('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = form.name.trim();
      if (name.length < 2) {
        setNameError('Tên sản phẩm phải từ 2 ký tự');
        bumpTips(['name']);
        return;
      }
      setNameError('');
      setSaving(true);
      try {
        const stockParsed = Number.parseInt(form.stockQty.trim(), 10);
        const payload = {
          name,
          defaultUnitPrice: parseCurrency(form.defaultUnitPrice) || 0,
          unit: form.unit.trim() || 'cái',
          stockQty: Number.isFinite(stockParsed) ? stockParsed : 0,
          sku: form.sku.trim() || undefined,
          notes: form.notes.trim() || undefined,
        };
        if (editProduct) {
          await updateProduct(editProduct.id, payload);
        } else {
          await createProduct(payload);
        }
        onClose();
      } catch (err) {
        notify.error(err instanceof Error ? err.message : 'Không lưu được sản phẩm');
      } finally {
        setSaving(false);
      }
    },
    [form, editProduct, onClose, bumpTips],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="prod-name">Tên *</Label>
            <Input
              id="prod-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Áo thun"
              autoFocus
              required
              minLength={2}
              aria-invalid={!!nameError}
            />
            <FieldErrorTip message={nameError} showKey={tipKeys.name ?? 0} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-price">Đơn giá mặc định</Label>
              <Input
                id="prod-price"
                value={form.defaultUnitPrice}
                onChange={(e) => setField('defaultUnitPrice', formatCurrencyInput(e.target.value))}
                placeholder="0"
                inputMode="numeric"
              />
              <p className="text-[10px] text-text-muted">Chỉ gợi ý — giá trên đơn vẫn sửa được</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-unit">Đơn vị *</Label>
              <Input
                id="prod-unit"
                value={form.unit}
                onChange={(e) => setField('unit', e.target.value)}
                placeholder="cái"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prod-stock">Tồn kho</Label>
            <Input
              id="prod-stock"
              value={form.stockQty}
              onChange={(e) => setField('stockQty', e.target.value.replace(/[^\d-]/g, ''))}
              placeholder="0"
              inputMode="numeric"
            />
            <p className="text-[10px] text-text-muted">
              Tự + khi nhập hàng, − khi đơn đã thanh toán
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prod-sku">Mã SKU</Label>
            <Input
              id="prod-sku"
              value={form.sku}
              onChange={(e) => setField('sku', e.target.value)}
              placeholder="SP-001"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prod-notes">Ghi chú</Label>
            <Textarea
              id="prod-notes"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
