/**
 * OnboardingScreen — collect store info after first registration.
 * Modern glass-morphism design matching AuthScreen.
 */

import { useState, type FormEvent } from 'react';
import { useAuthStore } from '@/store/authStore';
import { queueProfileSync } from '@/services/userSettingsService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Store, Loader2, ArrowRight } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { FieldErrorTip, useFieldErrorTips } from '@/ui/components/FieldErrorTip';

export function OnboardingScreen() {
  const { isDark } = useTheme();
  const { userProfile, updateUserProfile } = useAuthStore();
  const [storeName, setStoreName] = useState(userProfile?.storeName || '');
  const [address, setAddress] = useState(userProfile?.address || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const { tipKeys, bumpTips } = useFieldErrorTips<'storeName'>();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = storeName.trim();
    if (!trimmedName) {
      setNameError('Vui lòng nhập tên cửa hàng.');
      bumpTips(['storeName']);
      return;
    }
    setNameError('');
    setLoading(true);
    try {
      updateUserProfile({
        storeName: trimmedName,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      queueProfileSync({
        store_name: trimmedName,
        phone: phone.trim() || null,
        address: address.trim() || null,
        email: userProfile?.email ?? null,
      });
      toast.success('Thiết lập cửa hàng thành công!');
      // AuthGuard watches storeName and will leave this screen
    } catch {
      toast.error('Không thể lưu thông tin. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0F172A 0%, #134E4A 40%, #0F172A 100%)'
            : 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 30%, #E0F2FE 70%, #F8FAFC 100%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md px-4 animate-[dialog-in_0.5s_ease_forwards]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-[#0D9488] to-[#14B8A6] shadow-lg shadow-[#0D9488]/25 mb-4">
            <Store size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Chào mừng!</h1>
          <p className="text-sm text-text-muted mt-1.5">
            Thiết lập thông tin cửa hàng của bạn để bắt đầu
          </p>
        </div>

        <Card className="backdrop-blur-xl bg-surface/70 border-border/50 shadow-xl shadow-black/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Thông tin cửa hàng</CardTitle>
            <CardDescription className="text-xs">Có thể thay đổi sau trong Cài đặt</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="store-name" className="text-xs">Tên cửa hàng *</Label>
                <Input id="store-name" placeholder="VD: Tiệm tạp hóa Nhà Bo" value={storeName}
                  onChange={(e) => {
                    setStoreName(e.target.value);
                    if (nameError) setNameError('');
                  }} disabled={loading} autoFocus className="h-10"
                  aria-invalid={!!nameError} />
                <FieldErrorTip message={nameError} showKey={tipKeys.storeName ?? 0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-address" className="text-xs">Địa chỉ</Label>
                <Input id="store-address" placeholder="Số nhà, đường, phường..." value={address}
                  onChange={(e) => setAddress(e.target.value)} disabled={loading} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-phone" className="text-xs">Số điện thoại</Label>
                <Input id="store-phone" type="tel" placeholder="0912345678" value={phone}
                  onChange={(e) => setPhone(e.target.value)} disabled={loading} className="h-10" />
              </div>
              <Button type="submit" className="w-full h-10 gap-2" disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                Bắt đầu sử dụng
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-[10px] text-text-muted mt-6">
          © 2026 Quản Lý Tài Chính · v2.0
        </p>
      </div>
    </div>
  );
}
