/**
 * SettingsScreen — Application settings page.
 *
 * Contains 3 Panel sections:
 * - Google Drive (connect/disconnect, status)
 * - Gemini API (API key input + save + real connectivity test)
 * - About (app name, version, description)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/authStore';
import { geminiService } from '@/services/geminiService';
import { toast } from 'sonner';
import {
  Key,
  Info,
  Cloud,
  Settings as SettingsIcon,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

export function SettingsScreen() {
  const {
    isGoogleConnected,
    geminiApiKey,
    geminiConfigured,
    setGoogleConnected,
    setGeminiApiKey,
    disconnectGoogle,
  } = useAuthStore();

  const [apiKey, setApiKey] = useState(geminiApiKey ?? '');
  const [testing, setTesting] = useState(false);

  // Sync input after localStorage rehydrate
  useEffect(() => {
    setApiKey(geminiApiKey ?? '');
  }, [geminiApiKey]);

  function handleConnectDrive(): void {
    setGoogleConnected(true);
    toast.success('Đã kết nối Google Drive (stub)');
  }

  function handleDisconnectDrive(): void {
    disconnectGoogle();
    toast.message('Đã ngắt kết nối Google Drive');
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
                Kết nối Google Drive để đồng bộ hóa dữ liệu tự động.
              </p>

              {isGoogleConnected ? (
                <div className="space-y-[var(--s-xs)]">
                  <div className="flex items-center justify-between py-[var(--s-xs)]">
                    <span className="text-xs text-text-muted">Trạng thái</span>
                    <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge">Đang hoạt động</Badge>
                  </div>
                  <Button variant="destructive" onClick={handleDisconnectDrive}>
                    Ngắt kết nối
                  </Button>
                </div>
              ) : (
                <Button variant="default" onClick={handleConnectDrive}>
                  <Cloud className="mr-2 h-4 w-4" />Kết nối Google Drive
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
                <span className="bg-accent-bg text-accent-fg text-xs px-2 py-0.5 rounded-full">1.0.0</span>
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
