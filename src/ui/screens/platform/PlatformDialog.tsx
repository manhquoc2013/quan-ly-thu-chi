/**
 * PlatformDialog — add / edit order channel.
 */

import { useState, useCallback, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';
import type { OrderPlatform } from '@/models';
import { createPlatform, updatePlatform } from '@/services/platformService';
import { notify } from '@/utils/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  code: string;
  active: boolean;
}

const EMPTY: FormState = { name: '', code: '', active: true };

export function PlatformDialog({
  open,
  onClose,
  editPlatform,
}: {
  open: boolean;
  onClose: () => void;
  editPlatform?: OrderPlatform | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editPlatform) {
      setForm({
        name: editPlatform.name,
        code: editPlatform.code ?? '',
        active: editPlatform.active,
      });
    } else {
      setForm(EMPTY);
    }
    setSaving(false);
  }, [open, editPlatform]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (form.name.trim().length < 2) {
        notify.error('Tên kênh phải từ 2 ký tự');
        return;
      }
      setSaving(true);
      try {
        const payload = {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          active: form.active,
        };
        if (editPlatform) {
          await updatePlatform(editPlatform.id, payload);
        } else {
          await createPlatform(payload);
        }
        onClose();
      } catch (err) {
        notify.error(err instanceof Error ? err.message : 'Không lưu được kênh');
      } finally {
        setSaving(false);
      }
    },
    [form, editPlatform, onClose],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editPlatform ? 'Sửa kênh đặt hàng' : 'Thêm kênh đặt hàng'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="plat-name">Tên *</Label>
            <Input
              id="plat-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Shopee"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plat-code">Mã (tuỳ chọn)</Label>
            <Input
              id="plat-code"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="shopee"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
              className="rounded border-input-border"
            />
            Đang dùng (hiện trong form đơn)
          </label>
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
