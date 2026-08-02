/**
 * OnboardingScreen — collect store info after first registration.
 * Redirects to dashboard on completion.
 */

import { useState, type FormEvent } from 'react';
import { useAuthStore } from '@/store/authStore';
import { updateProfile } from '@/services/authService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Store, Loader2 } from 'lucide-react';

export function OnboardingScreen() {
  const { userProfile, updateUserProfile } = useAuthStore();
  const [storeName, setStoreName] = useState(userProfile?.storeName || '');
  const [address, setAddress] = useState(userProfile?.address || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = storeName.trim();

    if (!trimmedName) {
      toast.error('Vui lòng nhập tên cửa hàng.');
      return;
    }

    setLoading(true);
    try {
      updateProfile({
        storeName: trimmedName,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      updateUserProfile({
        storeName: trimmedName,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      toast.success('Thiết lập cửa hàng thành công!');
      setDone(true);
    } catch (err) {
      toast.error('Không thể lưu thông tin. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return null; // AuthGuard will re-render with updated profile → dashboard
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex items-center justify-center size-12 rounded-full bg-accent-fg/10">
            <Store className="size-6 text-accent-fg" />
          </div>
          <CardTitle className="text-xl">Chào mừng đến với Lucky!</CardTitle>
          <CardDescription>
            Thiết lập thông tin cửa hàng của bạn để bắt đầu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Tên cửa hàng *</Label>
              <Input
                id="store-name"
                placeholder="VD: Tiệm tạp hóa Nhà Bo"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-address">Địa chỉ</Label>
              <Input
                id="store-address"
                placeholder="Số nhà, đường, phường..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-phone">Số điện thoại</Label>
              <Input
                id="store-phone"
                type="tel"
                placeholder="0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Bắt đầu sử dụng
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
