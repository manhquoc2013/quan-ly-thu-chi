/**
 * AuthScreen — Supabase email/password with modern glass-morphism design.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ background: '#0a1628' }}
    >
      <div
        className="absolute inset-[-4%] z-0 bg-cover bg-center animate-[auth-bg-drift_18s_ease-in-out_infinite_alternate]"
        style={{ backgroundImage: `url(${bgUrl})`, imageRendering: 'auto' }}
        aria-hidden
      />
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 42%, rgba(8,20,40,0.28) 0%, rgba(8,20,40,0.68) 72%, rgba(6,14,28,0.86) 100%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md px-4 animate-[dialog-in_0.5s_ease_forwards]">
        <div className="text-center mb-7">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            width={80}
            height={80}
            className="mx-auto size-20 rounded-2xl shadow-lg mb-4"
          />
          <h1 data-mascot-platform className="text-2xl font-bold text-white drop-shadow-md">
            {mode === 'in' ? 'Quản Lý Tài Chính' : 'Tạo tài khoản mới'}
          </h1>
          <p className="text-sm text-slate-200/85 mt-1.5 drop-shadow">
            {mode === 'in'
              ? 'Đăng nhập để quản lý thu chi của bạn'
              : 'Bắt đầu theo dõi tài chính ngay hôm nay'}
          </p>
        </div>

        <TooltipProvider>
        <Card className="backdrop-blur-xl bg-white/90 border-white/30 rounded-2xl shadow-2xl shadow-black/25">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-1">
              {mode === 'in' ? 'Đăng nhập' : 'Đăng ký'}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-text-muted hover:text-text-primary transition-colors">
                    <Info size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Cần kết nối mạng cho lần đăng nhập đầu tiên. Sau đó có thể dùng offline.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
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

              <Button type="submit" data-mascot-platform className="w-full h-11 gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  mode === 'in' ? <LogIn size={16} /> : <UserPlus size={16} />
                )}
                {mode === 'in' ? 'Đăng nhập' : 'Đăng ký'}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-accent-fg transition-colors"
                  disabled={loading}
                  onClick={() => {
                    setMode((m) => (m === 'in' ? 'up' : 'in'));
                    setErrors({});
                    resetTips();
                  }}
                >
                  {mode === 'in'
                    ? 'Chưa có tài khoản? Đăng ký'
                    : 'Đã có tài khoản? Đăng nhập'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
        </TooltipProvider>

        <p className="text-center text-[10px] text-slate-300/80 mt-6 drop-shadow">
          © 2026 Quản Lý Tài Chính · {APP_VERSION_LABEL}
        </p>
      </div>

      <style>{`
        @keyframes auth-bg-drift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-1.5%, 1%); }
        }
      `}</style>

      <MascotOverlay />
    </div>
  );
}
