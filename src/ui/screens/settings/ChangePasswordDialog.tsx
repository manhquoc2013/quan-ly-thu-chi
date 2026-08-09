/**
 * ChangePasswordDialog — Supabase Auth updateUser (online only).
 */

import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabase, isSupabaseConfigured } from '@/services/supabaseClient';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { FieldErrorTip, useFieldErrorTips } from '@/ui/components/FieldErrorTip';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirm?: string }>({});
  const { tipKeys, bumpTips, resetTips } = useFieldErrorTips<'newPassword' | 'confirm'>();

  function resetForm() {
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNew(false);
    setErrors({});
    resetTips();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      toast.error('Chưa cấu hình Supabase.');
      return;
    }
    if (!navigator.onLine) {
      toast.error('Cần mạng để đổi mật khẩu.');
      return;
    }
    const nextErr: { newPassword?: string; confirm?: string } = {};
    if (!newPassword || newPassword.length < 6) {
      nextErr.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
    }
    if (newPassword !== confirmNewPassword) {
      nextErr.confirm = 'Mật khẩu xác nhận không khớp.';
    }
    if (Object.keys(nextErr).length) {
      setErrors(nextErr);
      bumpTips(Object.keys(nextErr) as Array<'newPassword' | 'confirm'>);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      toast.success('Đổi mật khẩu thành công!');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đổi mật khẩu</DialogTitle>
          <DialogDescription>Cập nhật mật khẩu tài khoản Supabase (cần mạng).</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="new-password">Mật khẩu mới</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.newPassword) setErrors((p) => ({ ...p, newPassword: undefined }));
                }}
                disabled={loading}
                aria-invalid={!!errors.newPassword}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <FieldErrorTip message={errors.newPassword} showKey={tipKeys.newPassword ?? 0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => {
                setConfirmNewPassword(e.target.value);
                if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
              }}
              disabled={loading}
              aria-invalid={!!errors.confirm}
            />
            <FieldErrorTip message={errors.confirm} showKey={tipKeys.confirm ?? 0} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
