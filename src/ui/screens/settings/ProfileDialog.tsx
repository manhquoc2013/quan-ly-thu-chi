/**
 * ProfileDialog — edit store profile (name, phone, address).
 *
 * Uses authStore.updateUserProfile() and authService.updateProfile().
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
import { useAuthStore } from '@/store/authStore';
import { queueProfileSync } from '@/services/userSettingsService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);

  const [storeName, setStoreName] = useState(userProfile?.storeName ?? '');
  const [phone, setPhone] = useState(userProfile?.phone ?? '');
  const [address, setAddress] = useState(userProfile?.address ?? '');
  const [loading, setLoading] = useState(false);

  // Sync from store when opening
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && userProfile) {
      setStoreName(userProfile.storeName);
      setPhone(userProfile.phone ?? '');
      setAddress(userProfile.address ?? '');
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = storeName.trim();
    if (!trimmedName) {
      toast.error('Vui lòng nhập tên cửa hàng.');
      return;
    }

    setLoading(true);
    try {
      const updates = {
        storeName: trimmedName,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      };
      updateUserProfile(updates);
      queueProfileSync({
        store_name: trimmedName,
        phone: phone.trim() || null,
        address: address.trim() || null,
        email: userProfile?.email ?? null,
      });
      toast.success('Đã cập nhật thông tin.');
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cập nhật thất bại.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Sửa thông tin</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin cửa hàng của bạn.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-storename">
              Tên cửa hàng <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile-storename"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Số điện thoại</Label>
            <Input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-address">Địa chỉ</Label>
            <Input
              id="profile-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={loading}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
