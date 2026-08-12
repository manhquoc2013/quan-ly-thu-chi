/**
 * AuthScreen — Supabase email/password with ink navy + soft sand brand surface.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, LogIn, UserPlus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { signInSupabase, signUpSupabase } from '@/services/householdService';
import { bootstrapSessionAfterAuth } from '@/services/sessionBootstrap';
import { isSupabaseConfigured } from '@/services/supabaseClient';
import { upsertProfile } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';
import { MascotOverlay } from '@/ui/components/MascotOverlay';
import { useMascotStore } from '@/store/mascotStore';
import { FieldErrorTip, useFieldErrorTips } from '@/ui/components/FieldErrorTip';
import { APP_VERSION_LABEL } from '@/appVersion';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRODUCT_NAME = 'Quản Lý Tài Chính';

type FieldName = 'email' | 'password' | 'confirmPassword' | 'storeName';

function mapAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid_credentials')) {
    return 'Sai email/mật khẩu hoặc chưa đăng ký.';
  }
  if (lower.includes('email not confirmed') || lower.includes('confirm')) {
    return 'Email chưa xác minh — kiểm tra hộp thư hoặc tắt Confirm email trong Supabase (dev).';
  }
  if (lower.includes('already registered') || lower.includes('user already')) {
    return 'Email đã được đăng ký — hãy đăng nhập.';
  }
  return msg || 'Đăng nhập thất bại.';
}

export function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const { tipKeys, bumpTips, resetTips } = useFieldErrorTips<FieldName>();
  const bgUrl = `${import.meta.env.BASE_URL}auth-bg.jpg`;

  useEffect(() => {
    const t = window.setTimeout(() => {
      useMascotStore.getState().speak(
        mode === 'in' ? 'Chào bạn! Đăng nhập nào~' : 'Tạo tài khoản mới đi!',
        'happy',
      );
    }, 600);
    return () => clearTimeout(t);
    // Only greet once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function bumpTip(name: FieldName) {
    bumpTips([name]);
  }

  function clearFieldError(name: FieldName) {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function setFieldError(name: FieldName, err: string, showTip: boolean) {
    setErrors((prev) => {
      if (!err) {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return { ...prev, [name]: err };
    });
    if (err && showTip) bumpTip(name);
  }

  function validateField(name: FieldName, value: string): string {
    switch (name) {
      case 'email': {
        if (!value.trim()) return 'Vui lòng nhập email.';
        if (!EMAIL_RE.test(value.trim())) return 'Email không hợp lệ.';
        return '';
      }
      case 'password': {
        if (!value) return 'Vui lòng nhập mật khẩu.';
        if (value.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
        return '';
      }
      case 'confirmPassword': {
        if (!value) return 'Vui lòng xác nhận mật khẩu.';
        if (value !== password) return 'Mật khẩu xác nhận không khớp.';
        return '';
      }
      case 'storeName': {
        if (!value.trim()) return 'Vui lòng nhập tên cửa hàng.';
        if (value.trim().length < 2) return 'Tên cửa hàng phải có ít nhất 2 ký tự.';
        return '';
      }
    }
  }

  function handleBlur(name: FieldName) {
    return () => {
      let value: string;
      switch (name) {
        case 'email': value = email; break;
        case 'password': value = password; break;
        case 'confirmPassword': value = confirmPassword; break;
        case 'storeName': value = storeName; break;
      }
      const err = validateField(name, value);
      setFieldError(name, err, !!err);
    };
  }

  function validateAll(): boolean {
    const newErrors: Partial<Record<FieldName, string>> = {};
    const emailErr = validateField('email', email);
    const passwordErr = validateField('password', password);
    if (emailErr) newErrors.email = emailErr;
    if (passwordErr) newErrors.password = passwordErr;
    if (mode === 'up') {
      const storeNameErr = validateField('storeName', storeName);
      const confirmErr = validateField('confirmPassword', confirmPassword);
      if (storeNameErr) newErrors.storeName = storeNameErr;
      if (confirmErr) newErrors.confirmPassword = confirmErr;
    }
    setErrors(newErrors);
    bumpTips(Object.keys(newErrors) as FieldName[]);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;
    if (!isSupabaseConfigured()) {
      toast.error('Chưa cấu hình cloud', {
        description: 'Thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào .env rồi restart.',
      });
      return;
    }
    if (!navigator.onLine) {
      toast.error('Cần mạng để đăng nhập lần đầu.');
      return;
    }

    const trimmed = email.trim();

    setLoading(true);
    try {
      if (mode === 'up') {
        await signUpSupabase(trimmed, password);
        await bootstrapSessionAfterAuth();
        const userId = useAuthStore.getState().userId;
        if (userId) {
          await upsertProfile({ user_id: userId, store_name: storeName.trim() });
        }
      } else {
        await signInSupabase(trimmed, password);
        await bootstrapSessionAfterAuth();
      }
      toast.success(mode === 'up' ? 'Đăng ký thành công' : 'Đăng nhập thành công');
    } catch (err) {
      toast.error(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  const headline = mode === 'in' ? 'Đăng nhập để tiếp tục' : 'Tạo tài khoản cửa hàng';
  const support =
    mode === 'in'
      ? 'Theo dõi thu chi, đơn hàng và tồn kho trên một nơi yên tĩnh.'
      : 'Vài bước ngắn để bắt đầu quản lý tài chính cửa hàng của bạn.';

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
          <h1 className="auth-headline mt-3 text-lg sm:text-xl">{headline}</h1>
          <p className="auth-support mx-auto mt-2 max-w-sm text-sm leading-relaxed">{support}</p>
        </header>

        <TooltipProvider>
          <div className="auth-panel auth-rise-delay rounded-2xl px-5 py-6 sm:px-6">
            <div className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-[var(--auth-text)]">
              {mode === 'in' ? 'Đăng nhập' : 'Đăng ký'}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-sea)]"
                  >
                    <Info size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Cần kết nối mạng cho lần đăng nhập đầu tiên. Sau đó có thể dùng offline.
                </TooltipContent>
              </Tooltip>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              {mode === 'up' && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-store-name" className="text-xs">
                    Tên cửa hàng <span className="text-danger-fg">*</span>
                  </Label>
                  <Input
                    id="auth-store-name"
                    data-mascot-platform
                    type="text"
                    value={storeName}
                    onChange={(e) => {
                      setStoreName(e.target.value);
                      if (errors.storeName && !validateField('storeName', e.target.value)) {
                        clearFieldError('storeName');
                      }
                    }}
                    onBlur={handleBlur('storeName')}
                    placeholder="Tên cửa hàng"
                    disabled={loading}
                    className="h-11"
                    aria-invalid={!!errors.storeName}
                    aria-describedby={errors.storeName ? 'auth-store-name-err' : undefined}
                  />
                  <div id="auth-store-name-err">
                    <FieldErrorTip message={errors.storeName} showKey={tipKeys.storeName ?? 0} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-xs">
                  Email <span className="text-danger-fg">*</span>
                </Label>
                <Input
                  id="auth-email"
                  data-mascot-platform
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email && !validateField('email', e.target.value)) {
                      clearFieldError('email');
                    }
                  }}
                  onBlur={handleBlur('email')}
                  placeholder="email@example.com"
                  disabled={loading}
                  className="h-11"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'auth-email-err' : undefined}
                />
                <div id="auth-email-err">
                  <FieldErrorTip message={errors.email} showKey={tipKeys.email ?? 0} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auth-password" className="text-xs">
                  Mật khẩu <span className="text-danger-fg">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="auth-password"
                    data-mascot-platform
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password && !validateField('password', e.target.value)) {
                        clearFieldError('password');
                      }
                      if (confirmPassword && errors.confirmPassword && e.target.value === confirmPassword) {
                        clearFieldError('confirmPassword');
                      }
                    }}
                    onBlur={handleBlur('password')}
                    placeholder="Mật khẩu"
                    disabled={loading}
                    className="h-11 pr-10"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'auth-password-err' : undefined}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)]"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div id="auth-password-err">
                  <FieldErrorTip message={errors.password} showKey={tipKeys.password ?? 0} />
                </div>
              </div>

              {mode === 'up' && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-confirm-password" className="text-xs">
                    Xác nhận mật khẩu <span className="text-danger-fg">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="auth-confirm-password"
                      data-mascot-platform
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword && !validateField('confirmPassword', e.target.value)) {
                          clearFieldError('confirmPassword');
                        }
                      }}
                      onBlur={handleBlur('confirmPassword')}
                      placeholder="Xác nhận mật khẩu"
                      disabled={loading}
                      className="h-11 pr-10"
                      aria-invalid={!!errors.confirmPassword}
                      aria-describedby={errors.confirmPassword ? 'auth-confirm-password-err' : undefined}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)]"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div id="auth-confirm-password-err">
                    <FieldErrorTip message={errors.confirmPassword} showKey={tipKeys.confirmPassword ?? 0} />
                  </div>
                </div>
              )}

              <Button type="submit" data-mascot-platform className="auth-cta h-11 w-full gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : mode === 'in' ? (
                  <LogIn size={16} />
                ) : (
                  <UserPlus size={16} />
                )}
                {mode === 'in' ? 'Đăng nhập' : 'Đăng ký'}
              </Button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  className="text-xs text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-sea)]"
                  disabled={loading}
                  onClick={() => {
                    setMode((m) => (m === 'in' ? 'up' : 'in'));
                    setErrors({});
                    resetTips();
                  }}
                >
                  {mode === 'in' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
                </button>
              </div>
            </form>
          </div>
        </TooltipProvider>

        <p className="auth-support mt-7 text-center text-[10px]">
          © 2026 {PRODUCT_NAME} · {APP_VERSION_LABEL}
        </p>
      </div>

      <MascotOverlay />
    </div>
  );
}
