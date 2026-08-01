/**
 * SettingsScreen — Application settings page.
 *
 * Contains 3 Panel sections:
 * - Google Drive (connect/disconnect, status)
 * - Gemini API (API key input + save)
 * - About (app name, version, description)
 *
 * Reads auth store state for connection status display.
 *
 * Named export: `SettingsScreen`
 */

import { useState } from 'react';
import { Panel } from '@components/Panel';
import { Button } from '@components/Button';
import { Badge } from '@components/Badge';
import { useAuthStore } from '@/store/authStore';
import {
  HardDrive,
  Key,
  Info,
  Cloud,
  Settings as SettingsIcon,
  CheckCircle,
  XCircle,
} from 'lucide-react';

/* ─── Component ─────────────────────────────────────────────────────── */

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

  /* ── Handlers ───────────────────────────────────────────────────── */

  function handleConnectDrive(): void {
    // Stub: trigger Google OAuth flow in production
    setGoogleConnected(true);
  }

  function handleDisconnectDrive(): void {
    disconnectGoogle();
  }

  function handleSaveGeminiKey(): void {
    setGeminiApiKey(apiKey || null);
  }

  function handleTestGemini(): void {
    if (!apiKey.trim()) return;
    setTesting(true);
    // Stub: actual Gemini API test in production
    setTimeout(() => {
      setTesting(false);
    }, 1200);
  }

  return (
    <div className="p-[var(--s-md)] space-y-[var(--s-lg)]">
      {/* ── Google Drive ─────────────────────────────────────────────── */}
      <section aria-label="Google Drive settings">
        <Panel
          title="Google Drive"
          icon={Cloud}
          titleTrailing={
            isGoogleConnected ? (
              <Badge variant="success">
                <CheckCircle size={12} className="inline mr-1" aria-hidden="true" />
                Đã kết nối
              </Badge>
            ) : (
              <Badge variant="neutral">
                <XCircle size={12} className="inline mr-1" aria-hidden="true" />
                Chưa kết nối
              </Badge>
            )
          }
        >
          <div className="space-y-[var(--s-md)]">
            <p className="text-xs text-text-muted">
              Kết nối Google Drive để đồng bộ hóa dữ liệu tự động.
            </p>

            {isGoogleConnected ? (
              <div className="space-y-[var(--s-xs)]">
                <div className="flex items-center justify-between py-[var(--s-xs)]">
                  <span className="text-xs text-text-muted">Trạng thái</span>
                  <Badge variant="success">Đang hoạt động</Badge>
                </div>
                <Button variant="danger" onClick={handleDisconnectDrive}>
                  Ngắt kết nối
                </Button>
              </div>
            ) : (
              <Button variant="run" icon={Cloud} onClick={handleConnectDrive}>
                Kết nối Google Drive
              </Button>
            )}
          </div>
        </Panel>
      </section>

      {/* ── Gemini API ───────────────────────────────────────────────── */}
      <section aria-label="Gemini API settings">
        <Panel
          title="Gemini API"
          icon={Key}
          titleTrailing={
            geminiConfigured ? (
              <Badge variant="success">
                <CheckCircle size={12} className="inline mr-1" aria-hidden="true" />
                Đã cấu hình
              </Badge>
            ) : (
              <Badge variant="neutral">
                <XCircle size={12} className="inline mr-1" aria-hidden="true" />
                Chưa cấu hình
              </Badge>
            )
          }
        >
          <div className="space-y-[var(--s-md)]">
            <p className="text-xs text-text-muted">
              Nhập API key để kích hoạt tính năng AI phân tích tài chính.
            </p>

            {/* API key input */}
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

            {/* Action buttons */}
            <div className="flex items-center gap-[var(--s-xs)]">
              <Button onClick={handleSaveGeminiKey}>Lưu API key</Button>
              <Button
                variant="accent"
                icon={SettingsIcon}
                disabled={!apiKey.trim() || testing}
                busy={testing}
                onClick={handleTestGemini}
              >
                Kiểm tra
              </Button>
              {geminiConfigured && (
                <Button variant="danger" onClick={() => setGeminiApiKey(null)}>
                  Xóa API key
                </Button>
              )}
            </div>
          </div>
        </Panel>
      </section>

      {/* ── About ────────────────────────────────────────────────────── */}
      <section aria-label="About">
        <Panel title="Thông tin" icon={Info}>
          <div className="space-y-[var(--s-sm)]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Ứng dụng</span>
              <span className="text-xs font-medium text-text-primary">
                Quản lý thu chi
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Phiên bản</span>
              <Badge variant="accent">1.0.0</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Mô tả</span>
              <span className="text-xs text-text-primary">
                Ứng dụng quản lý thu chi cá nhân với AI phân tích.
              </span>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
