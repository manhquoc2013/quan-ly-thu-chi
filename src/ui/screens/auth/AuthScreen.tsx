/**
 * AuthScreen — 5-state email-first authentication UI.
 *
 * States:
 * - email-input          Email entry + "Continue"
 * - password-login       Password + Login + Forgot Password + back
 * - otp-verify           6-digit OTP + resend countdown (login or registration)
 * - password-setup       Optional password set/skip after registration
 * - forgot-password      Preserved: email -> OTP -> new password
 */

import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  userExists,
  getUserByEmail,
  registerUser,
  resetPassword,
  verifyPassword,
  generateOTP,
  storeUserCredentials,
  hashPassword as hashPasswordFn,
  type StoredCredentials,
  type UserProfile,
} from '@/services/authService';
import { sendOTPEmail, type EmailJSConfig } from '@/services/emailService';
import { Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';

// -- Helpers --

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

function deriveUserName(email: string): string {
  return email.split('@')[0] ?? email;
}

// -- Sub-components --

interface OtpInputProps {
  digits: string[];
  onChange: (index: number, value: string) => void;
  disabled?: boolean;
}

function OtpInput({ digits, onChange, disabled }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    onChange(idx, val);
    if (val && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;
    e.preventDefault();
    for (let i = 0; i < 6; i++) {
      onChange(i, pasted[i] ?? '');
    }
    const nextIdx = Math.min(pasted.length, 5);
    refs.current[nextIdx]?.focus();
  };

  return (
    <div className="flex items-center justify-center gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={`otp-${i}`}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          disabled={disabled}
          className="w-11 h-12 text-center text-xl font-semibold rounded-md border border-input bg-background
                     focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring
                     disabled:opacity-50"
          aria-label={`Chữ số ${i + 1}`}
        />
      ))}
    </div>
  );
}

interface CountdownButtonProps {
  countdown: number;
  onClick: () => void;
  disabled: boolean;
  label: string;
  loading?: boolean;
}

function CountdownButton({ countdown, onClick, disabled, label, loading }: CountdownButtonProps) {
  if (countdown > 0) {
    return (
      <button
        type="button"
        disabled
        className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4 cursor-default"
      >
        Gửi lại mã ({countdown}s)
      </button>
    );
  }
  return (
    <button
      type="button"
      className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4"
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin inline" /> : null}
      {label}
    </button>
  );
}

// -- AuthState types --

type AuthState = 'email-input' | 'password-login' | 'otp-verify' | 'password-setup' | 'forgot-password';
type ForgotStep = 'email' | 'verify';
type OtpContext = 'login' | 'registration';

// -- Main Component --

export function AuthScreen() {
  const {
    login,
    emailjsServiceId,
    emailjsTemplateId,
    emailjsPublicKey,
  } = useAuthStore();

  // Navigation state
  const [authState, setAuthState] = useState<AuthState>('email-input');
  const [loading, setLoading] = useState(false);

  // Shared
  const [email, setEmail] = useState('');

  // password-login
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // otp-verify
  const [otp, setOtp] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpContext, setOtpContext] = useState<OtpContext | null>(null);

  // password-setup
  const [setupPassword, setSetupPassword] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [confirmSetupPassword, setConfirmSetupPassword] = useState('');

  // forgot-password
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotOtpDigits, setForgotOtpDigits] = useState(['', '', '', '', '', '']);
  const [forgotCountdown, setForgotCountdown] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // -- Countdown timers --
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const id = setInterval(() => setOtpCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [otpCountdown]);

  useEffect(() => {
    if (forgotCountdown <= 0) return;
    const id = setInterval(() => setForgotCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [forgotCountdown]);

  // Derived active EmailJS config from store values
  const activeConfig = (emailjsServiceId && emailjsTemplateId && emailjsPublicKey)
    ? { serviceId: emailjsServiceId, templateId: emailjsTemplateId, publicKey: emailjsPublicKey }
    : null;

  // -- OTP digit helpers (otp-verify) --
  const setOtpDigit = useCallback((idx: number, val: string) => {
    setOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }, []);

  // -- OTP digit helpers (forgot-password) --
  const setForgotOtpDigit = useCallback((idx: number, val: string) => {
    setForgotOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }, []);

  const getOtpString = (digits: string[]): string => digits.join('');

  // -- State: email-input --
  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      toast.error('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setLoading(true);
    try {
      const exists = userExists(trimmedEmail);
      if (exists) {
        // Existing user — check if hasPassword
        const creds = getUserByEmail(trimmedEmail);
        if (!creds) {
          toast.error('Không tìm thấy thông tin đăng ký.');
          return;
        }

        if (creds.hasPassword) {
          // Password login path — no EmailJS needed
          setAuthState('password-login');
          return;
        }
      }

      // Need OTP: registration or OTP-only login — require EmailJS
      if (!activeConfig) {
        toast.error('EmailJS chưa được cấu hình. Vui lòng liên hệ quản trị viên.');
        return;
      }

      if (!exists) {
        // Registration path — send OTP for new user
        const userOtp = generateOTP();
        setOtp(userOtp);
        setOtpDigits(['', '', '', '', '', '']);
        await sendOTPEmail(trimmedEmail, userOtp, deriveUserName(trimmedEmail), activeConfig as EmailJSConfig);
        setOtpContext('registration');
        setOtpCountdown(60);
        setAuthState('otp-verify');
      } else {
        // OTP-only login path — send OTP
        const userOtp = generateOTP();
        setOtp(userOtp);
        setOtpDigits(['', '', '', '', '', '']);
        await sendOTPEmail(trimmedEmail, userOtp, deriveUserName(trimmedEmail), activeConfig as EmailJSConfig);
        setOtpContext('login');
        setOtpCountdown(60);
        setAuthState('otp-verify');
        }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi mã xác thực.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // -- State: password-login --
  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedPassword = password;

    if (!trimmedPassword) {
      toast.error('Vui lòng nhập mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const creds = getUserByEmail(trimmedEmail);
      if (!creds) {
        toast.error('Không tìm thấy thông tin đăng nhập.');
        return;
      }

      const valid = await verifyPassword(trimmedPassword, creds.passwordHash);
      if (!valid) {
        toast.error('Mật khẩu không đúng.');
        return;
      }

      login(trimmedEmail, creds.profile);
      toast.success('Đăng nhập thành công!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // -- State: otp-verify --
  async function handleOtpVerify(e: FormEvent) {
    e.preventDefault();
    const code = getOtpString(otpDigits);

    if (code.length !== 6) {
      toast.error('Vui lòng nhập đủ 6 chữ số.');
      return;
    }
    if (code !== otp) {
      toast.error('Mã xác thực không đúng.');
      return;
    }

    setLoading(true);
    try {
      if (otpContext === 'registration') {
        // Registration flow — create user without password first, then go to password-setup
        const creds = await registerUser(email.trim(), undefined, { storeName: '', email: email.trim() });
        setAuthState('password-setup');
      } else {
        // OTP-only login flow
        const creds = getUserByEmail(email.trim());
        if (!creds) {
          toast.error('Không tìm thấy thông tin đăng nhập.');
          return;
        }

        login(email.trim(), creds.profile);
        toast.success('Đăng nhập thành công!');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Xác thực thất bại.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleOtpResend() {
    if (otpCountdown > 0) return;
    if (!activeConfig) {
      toast.error('EmailJS chưa được cấu hình.');
      return;
    }
    setLoading(true);
    const newOtp = generateOTP();
    setOtp(newOtp);
    setOtpDigits(['', '', '', '', '', '']);
    sendOTPEmail(email.trim(), newOtp, deriveUserName(email.trim()), activeConfig as EmailJSConfig)
      .then(() => {
        setOtpCountdown(60);
        toast.message('Đã gửi lại mã xác thực.');
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Không thể gửi lại mã.');
      })
      .finally(() => setLoading(false));
  }

  // -- State: password-setup --
  async function handlePasswordSetup(e: FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (setupPassword && setupPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (setupPassword && setupPassword !== confirmSetupPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      if (setupPassword) {
        // Set password — hash and store
        const passwordHash = await hashPasswordFn(setupPassword);
        const creds = getUserByEmail(trimmedEmail);
        if (creds) {
          const updatedCreds: StoredCredentials = {
            ...creds,
            passwordHash,
            hasPassword: true,
          };
          storeUserCredentials(updatedCreds);
        }
      }
      // TODO(AC-AUTH-14, wave-2): route to OnboardingScreen when implemented.
      // Currently routing to email-input so user can log in with email or OTP.
      setAuthState('email-input');
      const successMsg = setupPassword
        ? 'Đăng ký thành công!'
        : 'Đăng ký thành công! Bạn có thể đặt mật khẩu sau trong phần cài đặt.';
      toast.success(successMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lưu mật khẩu thất bại.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // -- State: forgot-password — email step --
  async function handleForgotSendOtp(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed || !isValidEmail(trimmed)) {
      toast.error('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    if (!userExists(trimmed)) {
      toast.error('Email này chưa được đăng ký.');
      return;
    }

    if (!activeConfig) {
      toast.error('EmailJS chưa được cấu hình. Vui lòng liên hệ quản trị viên.');
      return;
    }

    setLoading(true);
    try {
      const otpCode = generateOTP();
      setForgotOtp(otpCode);
      setForgotOtpDigits(['', '', '', '', '', '']);
      await sendOTPEmail(trimmed, otpCode, deriveUserName(trimmed), activeConfig as EmailJSConfig);
      setForgotStep('verify');
      setForgotCountdown(60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi mã xác thực.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // -- State: forgot-password — verify + reset --
  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    const code = getOtpString(forgotOtpDigits);

    if (code.length !== 6) {
      toast.error('Vui lòng nhập đủ 6 chữ số.');
      return;
    }
    if (code !== forgotOtp) {
      toast.error('Mã xác thực không đúng.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim(), newPassword);
      toast.success('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.');
      resetAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleForgotResendOtp() {
    if (forgotCountdown > 0) return;
    if (!activeConfig) {
      toast.error('EmailJS chưa được cấu hình.');
      return;
    }
    setLoading(true);
    const otpCode = generateOTP();
    setForgotOtp(otpCode);
    setForgotOtpDigits(['', '', '', '', '', '']);
    sendOTPEmail(email.trim(), otpCode, deriveUserName(email.trim()), activeConfig as EmailJSConfig)
      .then(() => {
        setForgotCountdown(60);
        toast.message('Đã gửi lại mã xác thực.');
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Không thể gửi lại mã.');
      })
      .finally(() => setLoading(false));
  }

  // -- Helpers --
  function resetAll() {
    setAuthState('email-input');
    setEmail('');
    setPassword('');
    setOtp('');
    setOtpDigits(['', '', '', '', '', '']);
    setOtpContext(null);
    setOtpCountdown(0);
    setSetupPassword('');
    setShowSetupPassword(false);
    setConfirmSetupPassword('');
    setForgotStep('email');
    setForgotOtp('');
    setForgotOtpDigits(['', '', '', '', '', '']);
    setForgotCountdown(0);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setLoading(false);
  }

  // -- Render --
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        {/* -- EMAIL-INPUT -- */}
        {authState === 'email-input' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex items-center justify-center">
                <img
                  src={`${import.meta.env.BASE_URL}logo.svg`}
                  alt="Logo"
                  width={48}
                  height={48}
                  className="size-12 rounded-lg object-cover"
                />
              </div>
              <CardTitle className="text-xl">Quản Lý Tài Chính</CardTitle>
              <CardDescription>Đăng nhập hoặc đăng ký để quản lý thu chi</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-input">Email</Label>
                  <Input
                    id="email-input"
                    type="email"
                    placeholder="nhap@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Tiếp tục
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4"
                  onClick={() => {
                    setAuthState('forgot-password');
                    setForgotStep('email');
                  }}
                >
                  Quên mật khẩu?
                </button>
              </div>
            </CardContent>
          </>
        )}

        {/* -- PASSWORD-LOGIN -- */}
        {authState === 'password-login' && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Đăng nhập</CardTitle>
              <CardDescription>Nhập mật khẩu cho {email}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handlePasswordLogin(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password-login">Mật khẩu</Label>
                  <div className="relative">
                    <Input
                      id="password-login"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Nhập mật khẩu"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((p) => !p)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Đăng nhập
                </Button>
              </form>
              <div className="mt-4 space-y-2">
                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4"
                    onClick={() => {
                      setAuthState('forgot-password');
                      setForgotStep('email');
                    }}
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="text-center">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1 mx-auto text-sm text-muted-foreground hover:text-primary"
                    onClick={() => {
                      setAuthState('email-input');
                      setPassword('');
                    }}
                  >
                    <ArrowLeft size={14} />
                    Quay lại
                  </button>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* -- OTP-VERIFY -- */}
        {authState === 'otp-verify' && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Xác thực email</CardTitle>
              <CardDescription>
                Nhập mã 6 chữ số đã gửi đến <span className="font-medium text-foreground">{email}</span>
                {otpContext === 'registration' ? ' để đăng ký' : ' để đăng nhập'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleOtpVerify(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Mã xác thực</Label>
                  <OtpInput digits={otpDigits} onChange={setOtpDigit} disabled={loading} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Xác nhận
                </Button>
              </form>
              <div className="mt-4 text-center space-y-2">
                <CountdownButton
                  countdown={otpCountdown}
                  onClick={handleOtpResend}
                  disabled={loading}
                  label="Gửi lại mã"
                  loading={loading}
                />
                <div>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1 mx-auto text-sm text-muted-foreground hover:text-primary"
                    onClick={() => {
                      setAuthState('email-input');
                      setOtp('');
                      setOtpDigits(['', '', '', '', '', '']);
                      setOtpContext(null);
                      setOtpCountdown(0);
                    }}
                  >
                    <ArrowLeft size={14} />
                    Quay lại
                  </button>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* -- PASSWORD-SETUP -- */}
        {authState === 'password-setup' && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Tạo mật khẩu</CardTitle>
              <CardDescription>
                {email} (tùy chọn — có thể bỏ qua và đăng nhập bằng mã OTP sau)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handlePasswordSetup(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="setup-password">Mật khẩu mới (tùy chọn)</Label>
                  <div className="relative">
                    <Input
                      id="setup-password"
                      type={showSetupPassword ? 'text' : 'password'}
                      placeholder="Ít nhất 6 ký tự"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSetupPassword((p) => !p)}
                      tabIndex={-1}
                      aria-label={showSetupPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showSetupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-confirm-password">Xác nhận mật khẩu</Label>
                  <Input
                    id="setup-confirm-password"
                    type="password"
                    placeholder="Nhập lại mật khẩu"
                    value={confirmSetupPassword}
                    onChange={(e) => setConfirmSetupPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {setupPassword ? 'Lưu mật khẩu' : 'Bỏ qua'}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {/* -- FORGOT-PASSWORD — email step -- */}
        {authState === 'forgot-password' && forgotStep === 'email' && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Quên mật khẩu</CardTitle>
              <CardDescription>Nhập email để nhận mã đặt lại mật khẩu</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleForgotSendOtp(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="nhap@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gửi mã
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="flex items-center justify-center gap-1 mx-auto text-sm text-muted-foreground hover:text-primary"
                  onClick={() => {
                    setAuthState('email-input');
                    setForgotStep('email');
                  }}
                >
                  <ArrowLeft size={14} />
                  Quay lại
                </button>
              </div>
            </CardContent>
          </>
        )}

        {/* -- FORGOT-PASSWORD — verify + reset -- */}
        {authState === 'forgot-password' && forgotStep === 'verify' && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Đặt lại mật khẩu</CardTitle>
              <CardDescription>
                Nhập mã xác thực và mật khẩu mới cho <span className="font-medium text-foreground">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleResetPassword(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Mã xác thực</Label>
                  <OtpInput digits={forgotOtpDigits} onChange={setForgotOtpDigit} disabled={loading} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forgot-new-password">Mật khẩu mới</Label>
                  <div className="relative">
                    <Input
                      id="forgot-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Ít nhất 6 ký tự"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowNewPassword((p) => !p)}
                      tabIndex={-1}
                      aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forgot-confirm-password">Xác nhận mật khẩu mới</Label>
                  <Input
                    id="forgot-confirm-password"
                    type="password"
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Đặt lại mật khẩu
                </Button>
              </form>
              <div className="mt-4 text-center">
                <CountdownButton
                  countdown={forgotCountdown}
                  onClick={handleForgotResendOtp}
                  disabled={loading}
                  label="Gửi lại mã"
                  loading={loading}
                />
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
