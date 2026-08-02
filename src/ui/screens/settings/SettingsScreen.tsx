/**
 * SettingsScreen — Application settings page.
 *
 * - Google Drive (real GIS OAuth + app-data.json sync)
 * - Gemini API (API key + connectivity test)
 * - About
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/authStore';
import { geminiService } from '@/services/geminiService';
import {
  connectGoogleDrive,
  disconnectDrive,
  syncAppData,
  restoreFromDrive,
  isGoogleDriveConfigured,
  getDriveUser,
} from '@/services/googleDrive';
import { reloadAppData } from '@/services/bootstrap';
import { toast } from 'sonner';
import {
  Key,
  Info,
  Cloud,
  Settings as SettingsIcon,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Download,
} from 'lucide-react';

export function SettingsScreen() {
  const {
    isGoogleConnected,
    googleUser,
    geminiApiKey,
    geminiConfigured,
    setGoogleConnected,
    setGoogleUser,
    setGeminiApiKey,
    disconnectGoogle,
  } = useAuthStore();

  const [apiKey, setApiKey] = useState(geminiApiKey ?? '');
  const [testing, setTesting] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const driveConfigured = isGoogleDriveConfigured();

  useEffect(() => {
    setApiKey(geminiApiKey ?? '');
  }, [geminiApiKey]);

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

  return (
    <div className="p-[var(--s-md)] space-y-[var(--s-lg)]">
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
                <span className="bg-accent-bg text-accent-fg text-xs px-2 py-0.5 rounded-full">1.0.3</span>
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
    </div>
  );
}
