/**
 * CustomerDialog — Add / edit customer form.
 */

import { useState, useCallback, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';
import type { Customer } from '@/models';
import { createCustomer, updateCustomer } from '@/services/customerService';
import { notify } from '@/utils/notify';
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

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
}

const EMPTY: FormState = { name: '', phone: '', email: '', address: '' };

export interface CustomerDialogProps {
  open: boolean;
  onClose: () => void;
  editCustomer?: Customer | null;
}

export function CustomerDialog({ open, onClose, editCustomer }: CustomerDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editCustomer) {
      setForm({
        name: editCustomer.name,
        phone: editCustomer.phone ?? '',
        email: editCustomer.email ?? '',
        address: editCustomer.address ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    setSaving(false);
  }, [open, editCustomer]);

  const setField = useCallback((field: keyof FormState, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = form.name.trim();
      if (name.length < 2) {
        notify.error('Họ tên phải từ 2 ký tự');
        return;
      }
      setSaving(true);
      try {
        const payload = {
          name,
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
        };
        if (editCustomer) {
          await updateCustomer(editCustomer.id, payload);
        } else {
          await createCustomer(payload);
        }
        onClose();
      } catch (err) {
        notify.error(err instanceof Error ? err.message : 'Không lưu được khách hàng');
      } finally {
        setSaving(false);
      }
    },
    [form, editCustomer, onClose],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editCustomer ? 'Sửa khách hàng' : 'Thêm khách hàng'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cust-name">Họ tên *</Label>
            <Input
              id="cust-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Nguyễn Văn A"
              autoFocus
              required
              minLength={2}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-phone">Số điện thoại</Label>
            <Input
              id="cust-phone"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="0901234567 (tuỳ chọn)"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-email">Email</Label>
            <Input
              id="cust-email"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-address">Địa chỉ</Label>
            <Textarea
              id="cust-address"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="Địa chỉ giao hàng"
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
