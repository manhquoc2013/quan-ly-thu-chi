/**
 * AuthScreen — Supabase email/password (online required for first login).
 */

import { useState, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === 'in' ? 'Đăng nhập sổ chung' : 'Đăng ký tài khoản'}</CardTitle>
          <CardDescription>
            Dùng Supabase Auth. Cần mạng cho lần đầu; sau đó có thể dùng offline và đồng bộ khi có mạng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Mật khẩu</Label>
              <div className="relative">
                <Input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : mode === 'in' ? 'Đăng nhập' : 'Đăng ký'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={loading}
              onClick={() => setMode((m) => (m === 'in' ? 'up' : 'in'))}
            >
              {mode === 'in' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
