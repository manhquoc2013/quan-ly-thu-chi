/**
 * AuthScreen — Supabase email/password with modern glass-morphism design.
 */

import { useState, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { signInSupabase, signUpSupabase } from '@/services/householdService';
import { bootstrapSessionAfterAuth } from '@/services/sessionBootstrap';
import { isSupabaseConfigured } from '@/services/supabaseClient';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [loading, setLoading] = useState(false);
  const bgUrl = `${import.meta.env.BASE_URL}auth-bg.jpg`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      toast.error('Chưa cấu hình cloud', {
        description: 'Thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào .env rồi restart.',
      });
      return;
    }
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      toast.error('Email không hợp lệ.');
      return;
    }
    if (password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (!navigator.onLine) {
      toast.error('Cần mạng để đăng nhập lần đầu.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'up') await signUpSupabase(trimmed, password);
      else await signInSupabase(trimmed, password);
      await bootstrapSessionAfterAuth();
      toast.success(mode === 'up' ? 'Đăng ký thành công' : 'Đăng nhập thành công');
    } catch (err) {
      toast.error(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div
        className="absolute inset-[-4%] z-0 bg-cover bg-center animate-[auth-bg-drift_18s_ease-in-out_infinite_alternate]"
        style={{ backgroundImage: `url(${bgUrl})` }}
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
            width={64}
            height={64}
            className="mx-auto size-16 rounded-full mb-4"
          />
          <h1 className="text-2xl font-bold text-white drop-shadow-md">
            {mode === 'in' ? 'Quản Lý Tài Chính' : 'Tạo tài khoản'}
          </h1>
          <p className="text-sm text-slate-200/85 mt-1.5 drop-shadow">
            {mode === 'in'
              ? 'Đăng nhập để quản lý thu chi của bạn'
              : 'Bắt đầu theo dõi tài chính ngay hôm nay'}
          </p>
        </div>

        <Card className="backdrop-blur-xl bg-white/85 dark:bg-slate-900/80 border-white/30 shadow-2xl shadow-black/25">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {mode === 'in' ? 'Đăng nhập' : 'Đăng ký'}
            </CardTitle>
            <CardDescription className="text-xs">
              Dùng Supabase Auth. Cần mạng cho lần đầu; sau đó có thể dùng offline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="auth-email" className="text-xs">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  disabled={loading}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password" className="text-xs">Mật khẩu</Label>
                <div className="relative">
                  <Input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-10 gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                {mode === 'in' ? 'Đăng nhập' : 'Đăng ký'}
              </Button>
              <div className="text-center pt-2">
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-accent-fg transition-colors"
                  disabled={loading}
                  onClick={() => setMode((m) => (m === 'in' ? 'up' : 'in'))}
                >
                  {mode === 'in'
                    ? 'Chưa có tài khoản? Đăng ký'
                    : 'Đã có tài khoản? Đăng nhập'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-slate-300/80 mt-6 drop-shadow">
          © 2026 Quản Lý Tài Chính · v2.0
        </p>
      </div>

      <style>{`
        @keyframes auth-bg-drift {
          0% { transform: scale(1.02) translate(0, 0); }
          100% { transform: scale(1.08) translate(-1.2%, 0.8%); }
        }
      `}</style>
    </div>
  );
}
