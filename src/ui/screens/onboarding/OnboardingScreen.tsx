/**
 * OnboardingScreen — collect store info after first registration.
 * Visual language synced with AuthScreen (ink navy + soft sand).
 */

import { useState, type FormEvent } from 'react';
import { useAuthStore } from '@/store/authStore';
import { queueProfileSync } from '@/services/userSettingsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';
import { FieldErrorTip, useFieldErrorTips } from '@/ui/components/FieldErrorTip';
import { APP_VERSION_LABEL } from '@/appVersion';

const PRODUCT_NAME = 'Quản Lý Tài Chính';

export function OnboardingScreen() {
  const { userProfile, updateUserProfile } = useAuthStore();
  const [storeName, setStoreName] = useState(userProfile?.storeName || '');
  const [address, setAddress] = useState(userProfile?.address || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const { tipKeys, bumpTips } = useFieldErrorTips<'storeName'>();
  const bgUrl = `${import.meta.env.BASE_URL}auth-bg.jpg`;

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
    <div className="auth-surface relative flex min-h-full items-center justify-center overflow-y-auto overflow-x-hidden py-10">
      <div
        className="auth-bg absolute inset-[-6%] z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgUrl})` }}
        aria-hidden
      />
      <div
        className="auth-veil absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 60% at 50% 38%, rgba(10,26,46,0.35) 0%, rgba(10,26,46,0.72) 58%, rgba(6,16,28,0.92) 100%), linear-gradient(165deg, rgba(47,122,109,0.18) 0%, transparent 42%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md px-5">
        <header className="auth-rise mb-8 text-center">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            width={72}
            height={72}
            className="mx-auto mb-5 size-[4.5rem] rounded-2xl shadow-[0_12px_32px_rgba(6,16,28,0.45)]"
          />
          <p className="auth-brand text-[2rem] sm:text-[2.35rem]">{PRODUCT_NAME}</p>
          <h1 className="auth-headline mt-3 text-lg sm:text-xl">Thiết lập cửa hàng</h1>
          <p className="auth-support mx-auto mt-2 max-w-sm text-sm leading-relaxed">
            Cho chúng tôi biết tên cửa hàng để bắt đầu theo dõi thu chi của bạn.
          </p>
        </header>

        <div className="auth-panel auth-rise-delay rounded-2xl px-5 py-6 sm:px-6">
          <p className="mb-1 text-sm font-semibold text-[var(--auth-text)]">Thông tin cửa hàng</p>
          <p className="mb-4 text-xs text-[var(--auth-text-muted)]">Có thể thay đổi sau trong Cài đặt</p>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="store-name" className="text-xs">
                Tên cửa hàng <span className="text-danger-fg">*</span>
              </Label>
              <Input
                id="store-name"
                placeholder="VD: Tiệm tạp hóa Nhà Bo"
                value={storeName}
                onChange={(e) => {
                  setStoreName(e.target.value);
                  if (nameError) setNameError('');
                }}
                disabled={loading}
                autoFocus
                className="h-11"
                aria-invalid={!!nameError}
              />
              <FieldErrorTip message={nameError} showKey={tipKeys.storeName ?? 0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-address" className="text-xs">
                Địa chỉ
              </Label>
              <Input
                id="store-address"
                placeholder="Số nhà, đường, phường..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-phone" className="text-xs">
                Số điện thoại
              </Label>
              <Input
                id="store-phone"
                type="tel"
                placeholder="0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                className="h-11"
              />
            </div>
            <Button type="submit" className="auth-cta h-11 w-full gap-2" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Bắt đầu sử dụng
            </Button>
          </form>
        </div>

        <p className="auth-support mt-7 text-center text-[10px]">
          © 2026 {PRODUCT_NAME} · {APP_VERSION_LABEL}
        </p>
      </div>
    </div>
  );
}
