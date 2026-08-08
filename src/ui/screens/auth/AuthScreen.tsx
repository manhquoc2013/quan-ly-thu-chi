/**
 * AuthScreen — Supabase email/password with modern glass-morphism design.
 */

import { useState, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Wallet, ArrowRight } from 'lucide-react';
import { signInSupabase, signUpSupabase } from '@/services/householdService';
import { bootstrapSessionAfterAuth } from '@/services/sessionBootstrap';
import { isSupabaseConfigured } from '@/services/supabaseClient';
import { useTheme } from '@/hooks/useTheme';

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
  const { isDark } = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
      {/* ── Background gradient ── */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0F172A 0%, #134E4A 40%, #0F172A 100%)'
            : 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 30%, #E0F2FE 70%, #F8FAFC 100%)',
        }}
      />
      {/* ── Decorative circles ── */}
      <div
        className="absolute z-0 rounded-full opacity-20"
        style={{
          width: 400, height: 400,
          background: isDark ? '#14B8A6' : '#0D9488',
          top: -100, right: -100,
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute z-0 rounded-full opacity-15"
        style={{
          width: 300, height: 300,
          background: isDark ? '#3B82F6' : '#0EA5E9',
          bottom: -80, left: -80,
          filter: 'blur(50px)',
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 w-full max-w-md px-4 animate-[dialog-in_0.5s_ease_forwards]">
        {/* Logo + branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-[#0D9488] to-[#14B8A6] shadow-lg shadow-[#0D9488]/25 mb-4">
            <Wallet size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            {mode === 'in' ? 'Quản Lý Tài Chính' : 'Tạo tài khoản'}
          </h1>
          <p className="text-sm text-text-muted mt-1.5">
            {mode === 'in'
              ? 'Đăng nhập để quản lý thu chi của bạn'
              : 'Bắt đầu theo dõi tài chính ngay hôm nay'}
          </p>
        </div>

        {/* Card glass morphism */}
        <Card className="backdrop-blur-xl bg-surface/70 border-border/50 shadow-xl shadow-black/5">
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

        {/* Footer */}
        <p className="text-center text-[10px] text-text-muted mt-6">
          © 2026 Quản Lý Tài Chính · v2.0
        </p>
      </div>
    </div>
  );
}
