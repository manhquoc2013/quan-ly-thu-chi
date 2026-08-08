/**
 * SettingsScreen — Application settings page.
 *
 * - Tài khoản (profile, change password, logout)
 * - Sổ chung Supabase
 * - AI providers (Kilo / Gemini / Groq / WebLLM)
 * - About
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { geminiService } from '@/services/geminiService';
import { groqService } from '@/services/groqService';
import { kiloService } from '@/services/kiloService';
import { openRouterService } from '@/services/openRouterService';
import { siliconFlowService } from '@/services/siliconFlowService';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';
import { type LlmSource, AI_PRIORITY_DEFAULT, llmSourceLabel } from '@/services/llmCall';
import { reloadAppData } from '@/services/bootstrap';
import { isSupabaseConfigured } from '@/services/supabaseClient';
import {
  createHousehold,
  createInvite,
  getSupabaseSessionEmail,
  redeemInvite,
} from '@/services/householdService';
import {
  hydrateStoresFromCloud,
  migrateLocalCacheToCloud,
  refreshHouseholdFromCloud,
} from '@/services/cloudSync';
import { queueUserSettingsSync } from '@/services/userSettingsService';
import { flushOutbox, pendingCount } from '@/services/syncEngine';
import { ProfileDialog } from '@/ui/screens/settings/ProfileDialog';
import { ChangePasswordDialog } from '@/ui/screens/settings/ChangePasswordDialog';
import { toast } from 'sonner';
import {
  Key,
  Info,
  Users,
  User,
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
  ArrowUp,
  ArrowDown,
  GripVertical,
  Zap,
  CloudUpload,
  Palette,
  Sun,
  Moon,
  Monitor,
  Save,
  Trash2,
  LogIn,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

export function SettingsScreen() {
  const { mode, setTheme } = useTheme();
  const {
    geminiApiKey,
    geminiConfigured,
    userProfile,
    setGeminiApiKey,
    logout,
    enableWebLLM,
    setEnableWebLLM,
    enableKiloFree,
    setEnableKiloFree,
    groqApiKey,
    groqConfigured,
    enableGroq,
    setGroqApiKey,
    setEnableGroq,
    openRouterApiKey,
    openRouterConfigured,
    enableOpenRouter,
    setOpenRouterApiKey,
    setEnableOpenRouter,
    siliconFlowApiKey,
    siliconFlowConfigured,
    enableSiliconFlow,
    setSiliconFlowApiKey,
    setEnableSiliconFlow,
    aiPriority,
    setAiPriority,
    householdId,
    householdName,
    householdRole,
    supabaseEmail,
    setHousehold,
    setSupabaseEmail,
  } = useAuthStore();

  const [apiKey, setApiKey] = useState(geminiApiKey ?? '');
  const [testing, setTesting] = useState(false);
  const [testingKilo, setTestingKilo] = useState(false);
  const [testingGroq, setTestingGroq] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState(groqApiKey ?? '');
  const [openRouterKeyInput, setOpenRouterKeyInput] = useState(openRouterApiKey ?? '');
  const [testingOpenRouter, setTestingOpenRouter] = useState(false);
  const [siliconFlowKeyInput, setSiliconFlowKeyInput] = useState(siliconFlowApiKey ?? '');
  const [testingSiliconFlow, setTestingSiliconFlow] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const supabaseConfigured = isSupabaseConfigured();

  const [cloudBusy, setCloudBusy] = useState(false);
  const [householdNameInput, setHouseholdNameInput] = useState('Gia đình');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (!userId) {
      setPendingSync(0);
      return;
    }
    const tick = () => setPendingSync(pendingCount(userId));
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [userId]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    void (async () => {
      const email = await getSupabaseSessionEmail();
      setSupabaseEmail(email);
      if (email) {
        const info = await refreshHouseholdFromCloud();
        if (info?.householdId) {
          try {
            await hydrateStoresFromCloud(info.householdId);
          } catch (err) {
            console.error(err);
          }
        }
      }
    })();
  }, [supabaseConfigured, setSupabaseEmail]);

  // Only show providers that are actually connected/available
  const availableSources = useMemo<LlmSource[]>(() => {
    const full = aiPriority?.length ? aiPriority : AI_PRIORITY_DEFAULT;
    return full.filter((src) => {
      switch (src) {
        case 'kilo':
          return enableKiloFree !== false;
        case 'openrouter':
          return enableOpenRouter !== false && openRouterConfigured;
        case 'siliconflow':
          return enableSiliconFlow !== false && siliconFlowConfigured;
        case 'groq':
          return enableGroq !== false && groqConfigured;
        case 'gemini':
          return geminiConfigured;
        case 'local':
          return enableWebLLM !== false;
        default:
          return false;
      }
    });
  }, [aiPriority, enableKiloFree, enableOpenRouter, openRouterConfigured, enableSiliconFlow, siliconFlowConfigured, enableGroq, groqConfigured, geminiConfigured, enableWebLLM]);

  useEffect(() => {
    setApiKey(geminiApiKey ?? '');
  }, [geminiApiKey]);

  useEffect(() => {
    setGroqKeyInput(groqApiKey ?? '');
  }, [groqApiKey]);

  useEffect(() => {
    setOpenRouterKeyInput(openRouterApiKey ?? '');
  }, [openRouterApiKey]);

  useEffect(() => {
    setSiliconFlowKeyInput(siliconFlowApiKey ?? '');
  }, [siliconFlowApiKey]);

  async function handleCreateHousehold(): Promise<void> {
    setCloudBusy(true);
    try {
      const info = await createHousehold(householdNameInput);
      setHousehold(info);
      toast.success(`Đã tạo sổ “${info.householdName}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tạo sổ thất bại');
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleRedeemInvite(): Promise<void> {
    setCloudBusy(true);
    try {
      const info = await redeemInvite(inviteCodeInput);
      setHousehold(info);
      await hydrateStoresFromCloud(info.householdId);
      toast.success(`Đã tham gia sổ “${info.householdName}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mã mời không hợp lệ');
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleCreateInviteCode(): Promise<void> {
    setCloudBusy(true);
    try {
      const code = await createInvite(72);
      setLastInviteCode(code);
      toast.success(`Mã mời: ${code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tạo được mã mời');
    } finally {
      setCloudBusy(false);
    }
  }

  async function handlePushLocalToCloud(): Promise<void> {
    if (!householdId) return;
    setCloudBusy(true);
    try {
      await migrateLocalCacheToCloud(householdId);
      toast.success('Đã đẩy dữ liệu local lên sổ chung');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Đẩy dữ liệu thất bại');
    } finally {
      setCloudBusy(false);
    }
  }

  async function handlePullCloud(): Promise<void> {
    if (!householdId) return;
    setCloudBusy(true);
    try {
      await hydrateStoresFromCloud(householdId);
      await reloadAppData();
      toast.success('Đã tải dữ liệu từ sổ chung');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tải dữ liệu thất bại');
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleFlushSettingsSync(): Promise<void> {
    if (!userId) return;
    if (!navigator.onLine) {
      toast.error('Đang offline — sẽ đồng bộ khi có mạng.');
      return;
    }
    setCloudBusy(true);
    try {
      const result = await flushOutbox(userId);
      setPendingSync(pendingCount(userId));
      if (result.failed > 0) toast.error(`Đồng bộ lỗi ${result.failed} mục`);
      else toast.success(result.flushed > 0 ? `Đã đồng bộ ${result.flushed} mục` : 'Không còn mục chờ');
    } finally {
      setCloudBusy(false);
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
    queueUserSettingsSync();
    toast.success('Đã lưu Gemini API key (đồng bộ cloud khi online)');
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
        queueUserSettingsSync();
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
    queueUserSettingsSync();
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

  // ── Groq handlers ──
  function handleSaveGroqKey(): void {
    const trimmed = groqKeyInput.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập Groq API key');
      return;
    }
    setGroqApiKey(trimmed);
    groqService.configure(trimmed);
    queueUserSettingsSync();
    toast.success('Đã lưu Groq API key (đồng bộ cloud khi online)');
  }

  async function handleTestGroq(): Promise<void> {
    const trimmed = groqKeyInput.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập API key trước khi kiểm tra');
      return;
    }
    setTestingGroq(true);
    try {
      groqService.configure(trimmed);
      const result = await groqService.testConnection();
      if (result.ok) {
        setGroqApiKey(trimmed);
        queueUserSettingsSync();
        toast.success(`Groq hoạt động tốt — ${result.detail}`);
      } else {
        toast.error(`Kiểm tra thất bại: ${result.detail}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không kết nối được Groq';
      toast.error(`Kiểm tra thất bại: ${msg}`);
    } finally {
      setTestingGroq(false);
    }
  }

  function handleClearGroqKey(): void {
    setGroqApiKey(null);
    groqService.disconnect();
    setGroqKeyInput('');
    queueUserSettingsSync();
    toast.message('Đã xóa Groq API key');
  }

  // ── OpenRouter handlers ──
  function handleSaveOpenRouterKey(): void {
    const trimmed = openRouterKeyInput.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập OpenRouter API key');
      return;
    }
    setOpenRouterApiKey(trimmed);
    openRouterService.configure(trimmed);
    queueUserSettingsSync();
    toast.success('Đã lưu OpenRouter API key (đồng bộ cloud khi online)');
  }

  async function handleTestOpenRouter(): Promise<void> {
    const trimmed = openRouterKeyInput.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập API key trước khi kiểm tra');
      return;
    }
    setTestingOpenRouter(true);
    try {
      openRouterService.configure(trimmed);
      const result = await openRouterService.testConnection();
      if (result.ok) {
        setOpenRouterApiKey(trimmed);
        queueUserSettingsSync();
        toast.success(`OpenRouter hoạt động tốt — ${result.detail}`);
      } else {
        toast.error(`Kiểm tra thất bại: ${result.detail}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không kết nối được OpenRouter';
      toast.error(`Kiểm tra thất bại: ${msg}`);
    } finally {
      setTestingOpenRouter(false);
    }
  }

  function handleClearOpenRouterKey(): void {
    setOpenRouterApiKey(null);
    openRouterService.disconnect();
    setOpenRouterKeyInput('');
    queueUserSettingsSync();
    toast.message('Đã xóa OpenRouter API key');
  }

  // ── SiliconFlow handlers ──
  function handleSaveSiliconFlowKey(): void {
    const trimmed = siliconFlowKeyInput.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập SiliconFlow API key');
      return;
    }
    setSiliconFlowApiKey(trimmed);
    siliconFlowService.configure(trimmed);
    queueUserSettingsSync();
    toast.success('Đã lưu SiliconFlow API key (đồng bộ cloud khi online)');
  }

  async function handleTestSiliconFlow(): Promise<void> {
    const trimmed = siliconFlowKeyInput.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập API key trước khi kiểm tra');
      return;
    }
    setTestingSiliconFlow(true);
    try {
      siliconFlowService.configure(trimmed);
      const result = await siliconFlowService.testConnection();
      if (result.ok) {
        setSiliconFlowApiKey(trimmed);
        queueUserSettingsSync();
        toast.success(`SiliconFlow hoạt động tốt — ${result.detail}`);
      } else {
        toast.error(`Kiểm tra thất bại: ${result.detail}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không kết nối được SiliconFlow';
      toast.error(`Kiểm tra thất bại: ${msg}`);
    } finally {
      setTestingSiliconFlow(false);
    }
  }

  function handleClearSiliconFlowKey(): void {
    setSiliconFlowApiKey(null);
    siliconFlowService.disconnect();
    setSiliconFlowKeyInput('');
    queueUserSettingsSync();
    toast.message('Đã xóa SiliconFlow API key');
  }

  // ── AI Priority handlers ──
  function swapAdjacent(order: LlmSource[], i: number): LlmSource[] {
    const result = [...order];
    const a = result[i];
    const b = result[i + 1];
    if (a === undefined || b === undefined) return result;
    result[i] = b;
    result[i + 1] = a;
    return result;
  }

  function handleMoveUp(index: number): void {
    if (index <= 0) return;
    const order = aiPriority.length ? aiPriority : AI_PRIORITY_DEFAULT;
    setAiPriority(swapAdjacent(order, index - 1));
    queueUserSettingsSync();
  }

  function handleMoveDown(index: number): void {
    const order = aiPriority.length ? aiPriority : AI_PRIORITY_DEFAULT;
    if (index >= order.length - 1) return;
    setAiPriority(swapAdjacent(order, index));
    queueUserSettingsSync();
  }

  async function handleLogout(): Promise<void> {
    await logout();
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
              <div className="flex flex-wrap gap-[var(--s-xs)] pt-2 justify-end">
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

      <section aria-label="Shared household ledger">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent-fg" />
                <CardTitle>Sổ chung (Supabase)</CardTitle>
              </div>
              {householdId ? (
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
                Đồng bộ chi/thu/khách/SP trên Postgres (nhóm nhỏ). Không dùng connection string DB trong app —
                chỉ anon key.
              </p>

              {!supabaseConfigured && (
                <p className="text-xs text-warning-fg bg-warning-bg rounded-field px-2 py-1.5">
                  Thêm <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> rồi chạy SQL trong{' '}
                  <code>supabase/migrations/</code> (kể cả <code>user_profiles_settings</code>).
                </p>
              )}

              {pendingSync > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-field border px-2 py-1.5">
                  <span className="text-xs text-warning-fg">Chưa đồng bộ cấu hình: {pendingSync}</span>
                  <Button size="sm" variant="outline" disabled={cloudBusy} onClick={() => void handleFlushSettingsSync()}>
                    <CloudUpload className="mr-1 h-3.5 w-3.5" />
                    Đồng bộ ngay
                  </Button>
                </div>
              )}

              {supabaseConfigured && !householdId && (
                <div className="space-y-[var(--s-xs)]">
                  <p className="text-xs text-text-primary">
                    Tài khoản: {supabaseEmail ?? userProfile?.email ?? '—'} — tạo hoặc tham gia sổ chung
                  </p>
                  <Label htmlFor="hh-name">Tên sổ mới</Label>
                  <Input
                    id="hh-name"
                    value={householdNameInput}
                    onChange={(e) => setHouseholdNameInput(e.target.value)}
                  />
                  <Button disabled={cloudBusy} onClick={() => void handleCreateHousehold()}>
                    <Users className="mr-2 h-4 w-4" />Tạo sổ chung
                  </Button>
                  <Label htmlFor="invite-in">Hoặc nhập mã mời</Label>
                  <Input
                    id="invite-in"
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                    placeholder="ABCD1234"
                  />
                  <Button variant="secondary" disabled={cloudBusy || !inviteCodeInput} onClick={() => void handleRedeemInvite()}>
                    <LogIn className="mr-2 h-4 w-4" />Tham gia bằng mã
                  </Button>
                </div>
              )}

              {householdId && (
                <div className="space-y-[var(--s-xs)]">
                  <div className="flex items-center justify-between py-[var(--s-xs)]">
                    <span className="text-xs text-text-muted">Sổ</span>
                    <span className="text-xs text-text-primary">{householdName}</span>
                  </div>
                  <div className="flex items-center justify-between py-[var(--s-xs)]">
                    <span className="text-xs text-text-muted">Vai trò</span>
                    <span className="text-xs text-text-primary">{householdRole}</span>
                  </div>
                  <div className="flex items-center justify-between py-[var(--s-xs)]">
                    <span className="text-xs text-text-muted">Email cloud</span>
                    <span className="text-xs text-text-primary truncate max-w-[60%]">{supabaseEmail}</span>
                  </div>
                  {householdRole === 'owner' && (
                    <div className="flex items-center gap-[var(--s-xs)] flex-wrap">
                      <Button variant="secondary" disabled={cloudBusy} onClick={() => void handleCreateInviteCode()}>
                        <Key className="mr-2 h-4 w-4" />Tạo mã mời (72h)
                      </Button>
                      <div className="flex items-center gap-[var(--s-xs)] ml-auto">
                        <Button variant="outline" disabled={cloudBusy} onClick={() => void handlePullCloud()}>
                          <RefreshCw className="mr-2 h-4 w-4" />Tải từ cloud
                        </Button>
                        <Button variant="outline" disabled={cloudBusy} onClick={() => void handlePushLocalToCloud()}>
                          <Download className="mr-2 h-4 w-4" />Đẩy local lên
                        </Button>
                      </div>
                    </div>
                  )}
                  {lastInviteCode && (
                    <p className="text-xs font-mono bg-muted rounded-field px-2 py-1.5">Mã: {lastInviteCode}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-label="AI provider priority order">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-accent-fg" />
              <CardTitle>Thứ tự ưu tiên AI</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-[var(--s-xs)]">
              <p className="text-xs text-text-muted">
                Kéo sắp xếp thứ tự ưu tiên — AI đầu tiên khả dụng sẽ được dùng.
              </p>
              <div className="space-y-1">
                {availableSources.map((source, visibleIdx) => {
                  const fullOrder = aiPriority?.length ? aiPriority : AI_PRIORITY_DEFAULT;
                  const fullIdx = fullOrder.indexOf(source);

                  return (
                  <div
                    key={source}
                    className="flex items-center justify-between bg-input-bg rounded-field px-[var(--s-sm)] py-1.5"
                  >
                    <span className="text-xs text-text-primary">{llmSourceLabel(source)}</span>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={visibleIdx === 0}
                        onClick={() => handleMoveUp(fullIdx)}
                        aria-label={`Di chuyển ${source} lên`}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={visibleIdx >= availableSources.length - 1}
                        onClick={() => handleMoveDown(fullIdx)}
                        aria-label={`Di chuyển ${source} xuống`}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Groq AI settings">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent-fg" />
                <CardTitle>Groq AI</CardTitle>
              </div>
              {groqConfigured ? (
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
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-fg underline"
                >
                  Groq Console
                </a>
                {' '}rồi bấm Lưu hoặc Kiểm tra. Model mặc định: <code>llama-3.3-70b-versatile</code>.
              </p>

              <div className="flex items-center gap-[var(--s-xs)]">
                <input
                  type="password"
                  value={groqKeyInput}
                  onChange={(e) => setGroqKeyInput(e.target.value)}
                  placeholder="Nhập Groq API key..."
                  className={
                    'flex-1 bg-input-bg border border-input-border ' +
                    'rounded-field px-[var(--s-sm)] py-1 text-xs ' +
                    'text-text-primary placeholder:text-input-placeholder ' +
                    'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                  }
                  aria-label="Groq API key"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-primary">Bật Groq</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableGroq !== false}
                  onClick={() => {
                    setEnableGroq(!(enableGroq !== false));
                    queueUserSettingsSync();
                  }}
                  className={
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ' +
                    (enableGroq !== false ? 'bg-accent-fg' : 'bg-input-bg border-input-border')
                  }
                >
                  <span
                    className={
                      'pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform ' +
                      (enableGroq !== false ? 'translate-x-4' : 'translate-x-0')
                    }
                  />
                </button>
              </div>

              <div className="flex items-center gap-[var(--s-xs)] flex-wrap justify-end">
                <Button onClick={handleSaveGroqKey}>
                  <Save className="mr-2 h-4 w-4" />Lưu API key
                </Button>
                <Button
                  variant="secondary"
                  disabled={!groqKeyInput.trim() || testingGroq}
                  onClick={() => void handleTestGroq()}
                >
                  {testingGroq
                    ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Đang kiểm tra…</>
                    : <><SettingsIcon className="mr-2 h-4 w-4" />Kiểm tra</>}
                </Button>
                {groqConfigured && (
                  <Button variant="destructive" onClick={handleClearGroqKey}>
                    <Trash2 className="mr-2 h-4 w-4" />Xóa API key
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-label="OpenRouter AI settings">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent-fg" />
                <CardTitle>OpenRouter</CardTitle>
              </div>
              {openRouterConfigured ? (
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
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-fg underline"
                >
                  OpenRouter Keys
                </a>
                {' '}rồi bấm Lưu hoặc Kiểm tra. Tự động thử 4 model free (Gemini Flash, Llama 4, Qwen3, DeepSeek V3).
              </p>

              <div className="flex items-center gap-[var(--s-xs)]">
                <input
                  type="password"
                  value={openRouterKeyInput}
                  onChange={(e) => setOpenRouterKeyInput(e.target.value)}
                  placeholder="Nhập OpenRouter API key..."
                  className={
                    'flex-1 bg-input-bg border border-input-border ' +
                    'rounded-field px-[var(--s-sm)] py-1 text-xs ' +
                    'text-text-primary placeholder:text-input-placeholder ' +
                    'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                  }
                  aria-label="OpenRouter API key"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-primary">Bật OpenRouter</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableOpenRouter !== false}
                  onClick={() => {
                    setEnableOpenRouter(!(enableOpenRouter !== false));
                    queueUserSettingsSync();
                  }}
                  className={
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ' +
                    (enableOpenRouter !== false ? 'bg-accent-fg' : 'bg-input-bg border-input-border')
                  }
                >
                  <span
                    className={
                      'pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform ' +
                      (enableOpenRouter !== false ? 'translate-x-4' : 'translate-x-0')
                    }
                  />
                </button>
              </div>

              <div className="flex items-center gap-[var(--s-xs)] flex-wrap justify-end">
                <Button onClick={handleSaveOpenRouterKey}>
                  <Save className="mr-2 h-4 w-4" />Lưu API key
                </Button>
                <Button
                  variant="secondary"
                  disabled={!openRouterKeyInput.trim() || testingOpenRouter}
                  onClick={() => void handleTestOpenRouter()}
                >
                  {testingOpenRouter
                    ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Đang kiểm tra…</>
                    : <><SettingsIcon className="mr-2 h-4 w-4" />Kiểm tra</>}
                </Button>
                {openRouterConfigured && (
                  <Button variant="destructive" onClick={handleClearOpenRouterKey}>
                    <Trash2 className="mr-2 h-4 w-4" />Xóa API key
                  </Button>
                )}
              </div>
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
                Không gửi thông tin mật/cá nhân nhạy cảm.
                {' '}Local: proxy Vite <code>/api/kilo</code>. GitHub Pages: cần Edge Function{' '}
                <code>kilo-proxy</code> (Supabase) — Gateway chặn CORS browser.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-primary">Bật Kilo Free (ưu tiên trước Gemini)</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableKiloFree !== false}
                  onClick={() => {
                    setEnableKiloFree(!(enableKiloFree !== false));
                    queueUserSettingsSync();
                  }}
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

              <div className="flex items-center gap-[var(--s-xs)] flex-wrap justify-end">
                <Button onClick={handleSaveGeminiKey}>
                  <Save className="mr-2 h-4 w-4" />Lưu API key
                </Button>
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
                    <Trash2 className="mr-2 h-4 w-4" />Xóa API key
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

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
                  onClick={() => {
                    setEnableWebLLM(!enableWebLLM);
                    queueUserSettingsSync();
                  }}
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

      <section aria-label="Theme">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-accent-fg" />
              <CardTitle>Giao diện</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-text-muted mb-3">
              Chọn chế độ sáng/tối hoặc tự động theo hệ thống.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'light' as ThemeMode, label: 'Sáng', icon: Sun },
                { value: 'dark' as ThemeMode, label: 'Tối', icon: Moon },
                { value: 'system' as ThemeMode, label: 'Hệ thống', icon: Monitor },
              ]).map((opt) => {
                const Icon = opt.icon;
                const active = mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={[
                      'flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-all duration-150',
                      active
                        ? 'border-accent-fg bg-accent-bg text-accent-fg'
                        : 'border-border bg-surface hover:bg-surface-hover text-text-secondary',
                    ].join(' ')}
                  >
                    <Icon size={20} />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
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
                <span className="bg-accent-bg text-accent-fg text-xs px-2 py-0.5 rounded-full">1.0.5</span>
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
