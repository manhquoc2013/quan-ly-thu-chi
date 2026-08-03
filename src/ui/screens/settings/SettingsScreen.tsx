/**
 * SettingsScreen — Application settings page.
 *
 * - Tài khoản (profile, change password, logout)
 * - Google Drive (real GIS OAuth + app-data.json sync)
 * - Gemini API (API key + connectivity test)
 * - About
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { geminiService } from '@/services/geminiService';
import { kiloService } from '@/services/kiloService';
import { clearToken } from '@/services/tokenService';
import {
  connectGoogleDrive,
  disconnectDrive,
  syncAppData,
  restoreFromDrive,
  isGoogleDriveConfigured,
  getDriveUser,
} from '@/services/googleDrive';
import { reloadAppData } from '@/services/bootstrap';
import { ProfileDialog } from '@/ui/screens/settings/ProfileDialog';
import { ChangePasswordDialog } from '@/ui/screens/settings/ChangePasswordDialog';
import { toast } from 'sonner';
import {
  Key,
  Info,
  Cloud,
  User,
  Mail,
  Settings as SettingsIcon,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Download,
  Pencil,
  Lock,
  LogOut,
  Bot,
} from 'lucide-react';

export function SettingsScreen() {
  const {
    isGoogleConnected,
    googleUser,
    geminiApiKey,
    geminiConfigured,
    userProfile,
    setGoogleConnected,
    setGoogleUser,
    setGeminiApiKey,
    disconnectGoogle,
    logout,
    emailjsServiceId,
    emailjsTemplateId,
    emailjsPublicKey,
    emailjsConfigured,
    setEmailJSConfig,
    clearEmailJSConfig,
    isAdmin,
    enableWebLLM,
    setEnableWebLLM,
    enableKiloFree,
    setEnableKiloFree,
  } = useAuthStore();

  const [apiKey, setApiKey] = useState(geminiApiKey ?? '');
  const [testing, setTesting] = useState(false);
  const [testingKilo, setTestingKilo] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const driveConfigured = isGoogleDriveConfigured();

  // EmailJS state
  const [ejServiceId, setEjServiceId] = useState(emailjsServiceId ?? '');
  const [ejTemplateId, setEjTemplateId] = useState(emailjsTemplateId ?? '');
  const [ejPublicKey, setEjPublicKey] = useState(emailjsPublicKey ?? '');
  const [ejTesting, setEjTesting] = useState(false);

  useEffect(() => {
    setApiKey(geminiApiKey ?? '');
  }, [geminiApiKey]);

  useEffect(() => {
    setEjServiceId(emailjsServiceId ?? '');
    setEjTemplateId(emailjsTemplateId ?? '');
    setEjPublicKey(emailjsPublicKey ?? '');
  }, [emailjsServiceId, emailjsTemplateId, emailjsPublicKey]);

  // ── EmailJS handlers ──
  function handleSaveEmailJS(): void {
    const sid = ejServiceId.trim();
    const tid = ejTemplateId.trim();
    const pk = ejPublicKey.trim();
    if (!sid) { toast.error('Vui lòng nhập Service ID.'); return; }
    if (!tid) { toast.error('Vui lòng nhập Template ID.'); return; }
    if (!pk) { toast.error('Vui lòng nhập Public Key.'); return; }
    setEmailJSConfig({ serviceId: sid, templateId: tid, publicKey: pk });
    toast.success('Đã lưu cấu hình EmailJS.');
  }

  async function handleTestEmailJS(): Promise<void> {
    const sid = ejServiceId.trim();
    const tid = ejTemplateId.trim();
    const pk = ejPublicKey.trim();
    if (!sid || !tid || !pk) {
      toast.error('Vui lòng nhập đầy đủ Service ID, Template ID và Public Key.');
      return;
    }
    setEjTesting(true);
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: sid,
          template_id: tid,
          user_id: pk,
          template_params: { to_email: 'test@example.com', user_name: 'Test', otp_code: '000000' },
        }),
      });
      if (res.ok) {
        setEmailJSConfig({ serviceId: sid, templateId: tid, publicKey: pk });
        toast.success('Kết nối EmailJS thành công.');
      } else {
        const text = await res.text().catch(() => '');
        toast.error(`Lỗi kết nối (HTTP ${res.status}): ${text || 'kiểm tra lại thông tin.'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể kết nối EmailJS.');
    } finally {
      setEjTesting(false);
    }
  }

  function handleClearEmailJS(): void {
    clearEmailJSConfig();
    setEjServiceId('');
    setEjTemplateId('');
    setEjPublicKey('');
    toast.message('Đã xóa cấu hình EmailJS.');
  }

  async function handleConnectDrive(): Promise<void> {
    if (!driveConfigured) {
      toast.error('Chưa cấu hình Google Client ID', {
        description: 'Thêm VITE_GOOGLE_CLIENT_ID vào .env.local hoặc GitHub Actions secrets.',
      });
      return;
    }
    setDriveBusy(true);
    try {
      await connectGoogleDrive();
      const user = getDriveUser();
      setGoogleConnected(true);
      setGoogleUser(
        user
          ? { id: user.email, name: user.name, email: user.email, picture: user.picture }
          : null,
      );
      const result = await syncAppData();
      if (result.direction === 'pulled') {
        await reloadAppData();
        toast.success('Đã kết nối — đã tải dữ liệu từ Google Drive');
      } else {
        toast.success(
          user?.email
            ? `Đã kết nối ${user.email} — đã sao lưu lên Drive`
            : 'Đã kết nối Google Drive — đã sao lưu',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kết nối thất bại';
      toast.error(msg);
    } finally {
      setDriveBusy(false);
    }
  }

  async function handleDisconnectDrive(): Promise<void> {
    setDriveBusy(true);
    try {
      await disconnectDrive();
      disconnectGoogle();
      toast.message('Đã ngắt kết nối Google Drive');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ngắt kết nối thất bại';
      toast.error(msg);
    } finally {
      setDriveBusy(false);
    }
  }

  async function handleSyncNow(): Promise<void> {
    setDriveBusy(true);
    try {
      const result = await syncAppData();
      if (result.direction === 'pulled') {
        await reloadAppData();
        toast.success('Đã đồng bộ — lấy bản mới hơn từ Drive');
      } else if (result.direction === 'pushed') {
        toast.success('Đã đẩy dữ liệu lên Google Drive');
      } else {
        toast.message('Dữ liệu đã đồng bộ');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đồng bộ thất bại';
      toast.error(msg);
    } finally {
      setDriveBusy(false);
    }
  }

  async function handleRestoreFromDrive(): Promise<void> {
    setDriveBusy(true);
    try {
      await restoreFromDrive();
      await reloadAppData();
      toast.success('Đã khôi phục dữ liệu từ Google Drive');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Khôi phục thất bại';
      toast.error(msg);
    } finally {
      setDriveBusy(false);
    }
  }

  function handleSaveGeminiKey(): void {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập API key');
      return;
    }
    setGeminiApiKey(trimmed);
    geminiService.configure(trimmed);
    toast.success('Đã lưu Gemini API key (giữ sau khi tải lại trang)');
  }

  async function handleTestGemini(): Promise<void> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập API key trước khi kiểm tra');
      return;
    }
    setTesting(true);
    try {
      geminiService.configure(trimmed);
      const result = await geminiService.testConnection(trimmed);
      if (result.ok) {
        setGeminiApiKey(trimmed);
        if (result.quota) {
          toast.message('Key hợp lệ — tạm hết hạn mức free-tier', {
            description: 'Đợi ~30s rồi thử lại, hoặc dùng WebLLM/Tesseract. Key đã được lưu.',
          });
        } else {
          toast.success(`Gemini hoạt động tốt — ${result.detail}`);
        }
      } else {
        toast.error(`Kiểm tra thất bại: ${result.detail}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không kết nối được Gemini';
      toast.error(`Kiểm tra thất bại: ${msg}`);
    } finally {
      setTesting(false);
    }
  }

  function handleClearGeminiKey(): void {
    setGeminiApiKey(null);
    geminiService.disconnect();
    setApiKey('');
    toast.message('Đã xóa Gemini API key');
  }

  async function handleTestKilo(): Promise<void> {
    setTestingKilo(true);
    try {
      kiloService.setEnabled(true);
      const result = await kiloService.testConnection();
      if (result.ok) toast.success(`Kilo Free OK — ${result.detail}`);
      else toast.error(`Kilo Free: ${result.detail}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không kết nối được Kilo');
    } finally {
      setTestingKilo(false);
    }
  }

  function handleLogout(): void {
    logout();
    clearToken();
    toast.message('Đã đăng xuất.');
  }

  return (
    <div className="p-[var(--s-md)] space-y-[var(--s-lg)]">
      {/* ── Tài khoản ─────────────────────────────────────────────── */}
      <section aria-label="Account settings">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-accent-fg" />
              <CardTitle>Tài khoản</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-[var(--s-sm)]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Cửa hàng</span>
                <span className="text-xs font-medium text-text-primary">
                  {userProfile?.storeName ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Email</span>
                <span className="text-xs font-medium text-text-primary">
                  {userProfile?.email ?? '—'}
                </span>
              </div>
              {userProfile?.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Số điện thoại</span>
                  <span className="text-xs text-text-primary">{userProfile.phone}</span>
                </div>
              )}
              {userProfile?.address && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Địa chỉ</span>
                  <span className="text-xs text-text-primary truncate max-w-[60%]">
                    {userProfile.address}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-[var(--s-xs)] pt-2">
                <Button variant="secondary" size="sm" onClick={() => setProfileOpen(true)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Sửa thông tin
                </Button>
                <Button variant="outline" size="sm" onClick={() => setChangePasswordOpen(true)}>
                  <Lock className="mr-1.5 h-3.5 w-3.5" />
                  Đổi mật khẩu
                </Button>
                <Button variant="destructive" size="sm" onClick={handleLogout}>
                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                  Đăng xuất
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Google Drive settings">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-accent-fg" />
                <CardTitle>Google Drive</CardTitle>
              </div>
              {isGoogleConnected ? (
                <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge gap-1">
                  <CheckCircle size={12} className="inline" aria-hidden="true" />
                  Đã kết nối
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <XCircle size={12} className="inline" aria-hidden="true" />
                  Chưa kết nối
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-[var(--s-md)]">
              <p className="text-xs text-text-muted">
                Kết nối Google Drive để sao lưu / khôi phục dữ liệu (folder{' '}
                <code className="text-[11px]">QuanLyThuChi</code> trên Drive của bạn).
              </p>

              {!driveConfigured && (
                <p className="text-xs text-warning-fg bg-warning-bg rounded-field px-2 py-1.5">
                  Chưa có <code>VITE_GOOGLE_CLIENT_ID</code> — OAuth sẽ không chạy được trên bản build này.
                </p>
              )}

              {isGoogleConnected ? (
                <div className="space-y-[var(--s-xs)]">
                  {googleUser?.email && (
                    <div className="flex items-center justify-between py-[var(--s-xs)]">
                      <span className="text-xs text-text-muted">Tài khoản</span>
                      <span className="text-xs text-text-primary truncate max-w-[60%]">
                        {googleUser.email}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-[var(--s-xs)]">
                    <span className="text-xs text-text-muted">Trạng thái</span>
                    <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge">
                      Đang hoạt động
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-[var(--s-xs)]">
                    <Button variant="secondary" disabled={driveBusy} onClick={() => void handleSyncNow()}>
                      {driveBusy
                        ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Đang xử lý…</>
                        : <><RefreshCw className="mr-2 h-4 w-4" />Đồng bộ ngay</>}
                    </Button>
                    <Button variant="outline" disabled={driveBusy} onClick={() => void handleRestoreFromDrive()}>
                      <Download className="mr-2 h-4 w-4" />Khôi phục từ Drive
                    </Button>
                    <Button variant="destructive" disabled={driveBusy} onClick={() => void handleDisconnectDrive()}>
                      Ngắt kết nối
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="default" disabled={driveBusy || !driveConfigured} onClick={() => void handleConnectDrive()}>
                  {driveBusy
                    ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Đang kết nối…</>
                    : <><Cloud className="mr-2 h-4 w-4" />Kết nối Google Drive</>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Kilo Free AI settings">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent-fg" />
                <CardTitle>Kilo Free (cloud)</CardTitle>
              </div>
              {enableKiloFree !== false ? (
                <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge gap-1">
                  <CheckCircle size={12} className="inline" aria-hidden="true" />
                  Ưu tiên online
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <XCircle size={12} className="inline" aria-hidden="true" />
                  Tắt
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-[var(--s-sm)]">
              <p className="text-xs text-text-muted">
                Dùng{' '}
                <a
                  href="https://kilo.ai/docs/gateway/models-and-providers"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-fg underline"
                >
                  kilo-auto/free
                </a>
                {' '}— tự chọn model free tốt nhất qua{' '}
                <a
                  href="https://kilo.ai/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-fg underline"
                >
                  Kilo Gateway
                </a>
                . Không cần API key. Giới hạn ~200 req/giờ/IP.
              </p>
              <p className="text-xs text-warning-fg">
                Privacy: Auto Free có thể gửi prompt tới provider log dữ liệu (vd. NVIDIA trial).
                Không gửi thông tin mật/cá nhân nhạy cảm. Dev dùng proxy Vite (`/api/kilo`) vì Gateway chặn CORS browser.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-primary">Bật Kilo Free (ưu tiên trước Gemini)</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableKiloFree !== false}
                  onClick={() => setEnableKiloFree(!(enableKiloFree !== false))}
                  className={
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ' +
                    (enableKiloFree !== false ? 'bg-accent-fg' : 'bg-input-bg border-input-border')
                  }
                >
                  <span
                    className={
                      'pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform ' +
                      (enableKiloFree !== false ? 'translate-x-4' : 'translate-x-0')
                    }
                  />
                </button>
              </div>
              <Button
                variant="secondary"
                disabled={testingKilo || enableKiloFree === false}
                onClick={() => void handleTestKilo()}
              >
                {testingKilo
                  ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Đang kiểm tra…</>
                  : 'Kiểm tra Kilo Free'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Gemini API settings">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-accent-fg" />
                <CardTitle>Gemini API</CardTitle>
              </div>
              {geminiConfigured ? (
                <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge gap-1">
                  <CheckCircle size={12} className="inline" aria-hidden="true" />
                  Đã cấu hình
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <XCircle size={12} className="inline" aria-hidden="true" />
                  Chưa cấu hình
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-[var(--s-md)]">
              <p className="text-xs text-text-muted">
                Nhập API key từ{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-fg underline"
                >
                  Google AI Studio
                </a>
                {' '}rồi bấm Lưu hoặc Kiểm tra.
              </p>

              <div className="flex items-center gap-[var(--s-xs)]">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Nhập API key..."
                  className={
                    'flex-1 bg-input-bg border border-input-border ' +
                    'rounded-field px-[var(--s-sm)] py-1 text-xs ' +
                    'text-text-primary placeholder:text-input-placeholder ' +
                    'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                  }
                  aria-label="Gemini API key"
                />
              </div>

              <div className="flex items-center gap-[var(--s-xs)] flex-wrap">
                <Button onClick={handleSaveGeminiKey}>Lưu API key</Button>
                <Button
                  variant="secondary"
                  disabled={!apiKey.trim() || testing}
                  onClick={() => void handleTestGemini()}
                >
                  {testing
                    ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Đang kiểm tra…</>
                    : <><SettingsIcon className="mr-2 h-4 w-4" />Kiểm tra</>}
                </Button>
                {geminiConfigured && (
                  <Button variant="destructive" onClick={handleClearGeminiKey}>
                    Xóa API key
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {isAdmin && (
        <section aria-label="EmailJS settings">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-accent-fg" />
                <CardTitle>EmailJS</CardTitle>
              </div>
              {emailjsConfigured ? (
                <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge gap-1">
                  <CheckCircle size={12} className="inline" aria-hidden="true" />
                  Đã cấu hình
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <XCircle size={12} className="inline" aria-hidden="true" />
                  Chưa cấu hình
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-[var(--s-md)]">
              <p className="text-xs text-text-muted">
                Cấu hình EmailJS để gửi mã OTP qua email.{' '}
                <a
                  href="https://dashboard.emailjs.com/admin"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-fg underline"
                >
                  Vào EmailJS Dashboard
                </a>
                {' '}→ tạo Service + Template với các biến{' '}
                <code className="text-[11px]">{'{{to_email}}'}</code>,{' '}
                <code className="text-[11px]">{'{{user_name}}'}</code>,{' '}
                <code className="text-[11px]">{'{{otp_code}}'}</code>.
              </p>

              <div>
                <Label htmlFor="ej-service-id" className="text-xs">Service ID</Label>
                <input
                  id="ej-service-id"
                  value={ejServiceId}
                  onChange={(e) => setEjServiceId(e.target.value)}
                  placeholder="service_xxxxxx"
                  className={
                    'w-full bg-input-bg border border-input-border ' +
                    'rounded-field px-[var(--s-sm)] py-1 text-xs ' +
                    'text-text-primary placeholder:text-input-placeholder ' +
                    'focus:outline-none focus:ring-2 focus:ring-input-focus-ring mt-1'
                  }
                  aria-label="EmailJS Service ID"
                />
              </div>

              <div>
                <Label htmlFor="ej-template-id" className="text-xs">Template ID</Label>
                <input
                  id="ej-template-id"
                  value={ejTemplateId}
                  onChange={(e) => setEjTemplateId(e.target.value)}
                  placeholder="template_xxxxxx"
                  className={
                    'w-full bg-input-bg border border-input-border ' +
                    'rounded-field px-[var(--s-sm)] py-1 text-xs ' +
                    'text-text-primary placeholder:text-input-placeholder ' +
                    'focus:outline-none focus:ring-2 focus:ring-input-focus-ring mt-1'
                  }
                  aria-label="EmailJS Template ID"
                />
              </div>

              <div>
                <Label htmlFor="ej-public-key" className="text-xs">Public Key</Label>
                <input
                  id="ej-public-key"
                  type="password"
                  value={ejPublicKey}
                  onChange={(e) => setEjPublicKey(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxx"
                  className={
                    'w-full bg-input-bg border border-input-border ' +
                    'rounded-field px-[var(--s-sm)] py-1 text-xs ' +
                    'text-text-primary placeholder:text-input-placeholder ' +
                    'focus:outline-none focus:ring-2 focus:ring-input-focus-ring mt-1'
                  }
                  aria-label="EmailJS Public Key"
                />
              </div>

              <div className="flex items-center gap-[var(--s-xs)] flex-wrap">
                <Button onClick={handleSaveEmailJS}>Lưu cấu hình</Button>
                <Button
                  variant="secondary"
                  disabled={!ejServiceId.trim() || !ejTemplateId.trim() || !ejPublicKey.trim() || ejTesting}
                  onClick={() => void handleTestEmailJS()}
                >
                  {ejTesting
                    ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Đang kiểm tra…</>
                    : <><SettingsIcon className="mr-2 h-4 w-4" />Kiểm tra kết nối</>}
                </Button>
                {emailjsConfigured && (
                  <Button variant="destructive" onClick={handleClearEmailJS}>
                    Xóa cấu hình
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        </section>
      )}

      {/* ── WebLLM toggle ──────────────────────────────────────────── */}
      <section aria-label="Local AI settings">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-accent-fg" />
              <CardTitle>AI Cục Bộ (WebLLM)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-[var(--s-sm)]">
              <p className="text-xs text-text-muted">
                Chạy model AI Qwen3-4B trực tiếp trên máy qua WebGPU. Có thể gây giật lag trên máy yếu.
                Tắt nếu không cần — app sẽ dùng Gemini cloud hoặc xử lý văn bản cục bộ.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-primary">Bật AI cục bộ</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableWebLLM}
                  onClick={() => setEnableWebLLM(!enableWebLLM)}
                  className={
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ' +
                    (enableWebLLM ? 'bg-accent-fg' : 'bg-input-bg border-input-border')
                  }
                >
                  <span
                    className={
                      'pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform ' +
                      (enableWebLLM ? 'translate-x-4' : 'translate-x-0')
                    }
                  />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-label="About">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-accent-fg" />
              <CardTitle>Thông tin</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-[var(--s-sm)]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Ứng dụng</span>
                <span className="text-xs font-medium text-text-primary">
                  Quản lý thu chi
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Phiên bản</span>
                <span className="bg-accent-bg text-accent-fg text-xs px-2 py-0.5 rounded-full">1.0.4</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Mô tả</span>
                <span className="text-xs text-text-primary">
                  Ứng dụng quản lý thu chi cá nhân với AI phân tích.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Dialogs */}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
}
