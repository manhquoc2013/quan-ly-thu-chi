/**
 * SettingsScreen — Tabbed settings: Tài khoản | AI | Mascot | About.
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { useMascotStore, type MascotActivity } from '@/store/mascotStore';
import { geminiService } from '@/services/geminiService';
import { groqService } from '@/services/groqService';
import { kiloService } from '@/services/kiloService';
import { openRouterService } from '@/services/openRouterService';
import { siliconFlowService } from '@/services/siliconFlowService';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';
import { type LlmSource, llmSourceLabel } from '@/services/llmCall';
import { mergeAiPriority } from '@/services/llmTypes';
import { reloadAppData } from '@/services/bootstrap';
import { isSupabaseConfigured } from '@/services/supabaseClient';
import { createHousehold, createInvite, getSupabaseSessionEmail, redeemInvite } from '@/services/householdService';
import { hydrateStoresFromCloud, migrateLocalCacheToCloud, refreshHouseholdFromCloud } from '@/services/cloudSync';
import { queueUserSettingsSync } from '@/services/userSettingsService';
import { flushOutbox, pendingCount } from '@/services/syncEngine';
import { ProfileDialog } from '@/ui/screens/settings/ProfileDialog';
import { ChangePasswordDialog } from '@/ui/screens/settings/ChangePasswordDialog';
import { toast } from 'sonner';
import { Key, Info, Users, User, Settings as SettingsIcon, CheckCircle, XCircle,
  Loader2, RefreshCw, Download, Pencil, Lock, LogOut, Bot, ArrowUp, ArrowDown,
  Zap, CloudUpload, Palette, Sun, Moon, Monitor, Save, Trash2, LogIn, Cat,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ToggleSwitch } from '@/ui/components/ToggleSwitch';
import { validateApiKey } from '@/utils/apiKey';

type Tab = 'account' | 'ai' | 'mascot' | 'about';

const TABS: { key: Tab; label: string; icon: typeof Cat }[] = [
  { key: 'account', label: 'Tài khoản', icon: User },
  { key: 'ai', label: 'AI', icon: Bot },
  { key: 'mascot', label: 'Mascot', icon: Cat },
  { key: 'about', label: 'Thông tin', icon: Info },
];

const ACTIVITY_LABELS: Record<MascotActivity, string> = {
  low: 'Ít (thư giãn)',
  medium: 'Vừa (mặc định)',
  high: 'Nhiều (năng động)',
};

export function SettingsScreen() {
  const [tab, setTab] = useState<Tab>('account');
  const { mode, setTheme } = useTheme();
  const {
    geminiApiKey, geminiConfigured, userProfile, setGeminiApiKey, logout,
    enableWebLLM, setEnableWebLLM, enableKiloFree, setEnableKiloFree,
    groqApiKey, groqConfigured, enableGroq, setGroqApiKey, setEnableGroq,
    openRouterApiKey, openRouterConfigured, enableOpenRouter, setOpenRouterApiKey, setEnableOpenRouter,
    siliconFlowApiKey, siliconFlowConfigured, enableSiliconFlow, setSiliconFlowApiKey, setEnableSiliconFlow,
    aiPriority, setAiPriority,
    householdId, householdName, householdRole, supabaseEmail, setHousehold, setSupabaseEmail,
  } = useAuthStore();

  const activity = useMascotStore((s) => s.activity);
  const setActivity = useMascotStore((s) => s.setActivity);

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
    if (!userId) { setPendingSync(0); return; }
    const tick = () => setPendingSync(pendingCount(userId));
    tick(); const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [userId]);

  // Only refresh session email + household metadata — never auto-pull ledger here.
  // Full hydrate overwrites IndexedDB; use "Tải từ sổ chung" explicitly.
  useEffect(() => {
    if (!supabaseConfigured) return;
    void (async () => {
      const email = await getSupabaseSessionEmail();
      setSupabaseEmail(email);
      if (email) {
        try {
          await refreshHouseholdFromCloud();
        } catch (err) {
          console.error('[settings] refreshHousehold', err);
        }
      }
    })();
  }, [supabaseConfigured, setSupabaseEmail]);

  const priorityOrder = useMemo(() => mergeAiPriority(aiPriority), [aiPriority]);

  // Persist merged order once so older saves that omitted openrouter/siliconflow get upgraded
  useEffect(() => {
    const merged = mergeAiPriority(aiPriority);
    if (
      !aiPriority?.length ||
      merged.length !== aiPriority.length ||
      merged.some((s, i) => s !== aiPriority[i])
    ) {
      setAiPriority(merged);
      queueUserSettingsSync();
    }
  }, [aiPriority, setAiPriority]);

  const availableSources = useMemo<LlmSource[]>(() => {
    return priorityOrder.filter((src) => {
      switch (src) {
        case 'kilo': return enableKiloFree !== false;
        case 'openrouter': return enableOpenRouter !== false && openRouterConfigured;
        case 'siliconflow': return enableSiliconFlow !== false && siliconFlowConfigured;
        case 'groq': return enableGroq !== false && groqConfigured;
        case 'gemini': return geminiConfigured;
        case 'local': return enableWebLLM !== false;
        default: return false;
      }
    });
  }, [priorityOrder, enableKiloFree, enableOpenRouter, openRouterConfigured, enableSiliconFlow, siliconFlowConfigured, enableGroq, groqConfigured, geminiConfigured, enableWebLLM]);

  useEffect(() => { setApiKey(geminiApiKey ?? ''); }, [geminiApiKey]);
  useEffect(() => { setGroqKeyInput(groqApiKey ?? ''); }, [groqApiKey]);
  useEffect(() => { setOpenRouterKeyInput(openRouterApiKey ?? ''); }, [openRouterApiKey]);
  useEffect(() => { setSiliconFlowKeyInput(siliconFlowApiKey ?? ''); }, [siliconFlowApiKey]);

  async function handleCreateHousehold(): Promise<void> {
    setCloudBusy(true);
    try { const info = await createHousehold(householdNameInput); setHousehold(info); toast.success(`Đã tạo sổ "${info.householdName}"`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Tạo sổ thất bại'); }
    finally { setCloudBusy(false); }
  }
  async function handleRedeemInvite(): Promise<void> {
    setCloudBusy(true);
    try { const info = await redeemInvite(inviteCodeInput); setHousehold(info); await hydrateStoresFromCloud(info.householdId); toast.success(`Đã tham gia sổ "${info.householdName}"`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Mã mời không hợp lệ'); }
    finally { setCloudBusy(false); }
  }
  async function handleCreateInviteCode(): Promise<void> {
    setCloudBusy(true);
    try { const code = await createInvite(72); setLastInviteCode(code); toast.success(`Mã mời: ${code}`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Không tạo được mã mời'); }
    finally { setCloudBusy(false); }
  }
  async function handlePushLocalToCloud(): Promise<void> {
    if (!householdId) return; setCloudBusy(true);
    try { await migrateLocalCacheToCloud(householdId); toast.success('Đã đẩy dữ liệu local lên sổ chung'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Đẩy dữ liệu thất bại'); }
    finally { setCloudBusy(false); }
  }
  async function handlePullCloud(): Promise<void> {
    if (!householdId) return; setCloudBusy(true);
    try {
      await hydrateStoresFromCloud(householdId, { force: true });
      await reloadAppData();
      toast.success('Đã tải dữ liệu từ sổ chung');
    }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Tải dữ liệu thất bại'); }
    finally { setCloudBusy(false); }
  }
  async function handleFlushSettingsSync(): Promise<void> {
    if (!userId) return;
    if (!navigator.onLine) { toast.error('Đang offline — sẽ đồng bộ khi có mạng.'); return; }
    setCloudBusy(true);
    try { const result = await flushOutbox(userId); setPendingSync(pendingCount(userId)); if (result.failed > 0) toast.error(`Đồng bộ lỗi ${result.failed} mục`); else toast.success(result.flushed > 0 ? `Đã đồng bộ ${result.flushed} mục` : 'Không còn mục chờ'); }
    finally { setCloudBusy(false); }
  }

  function handleSaveGeminiKey(): void {
    const trimmed = apiKey.trim(); if (!trimmed) { toast.error('Vui lòng nhập API key'); return; }
    setGeminiApiKey(trimmed); geminiService.configure(trimmed); queueUserSettingsSync(); toast.success('Đã lưu Gemini API key');
  }
  async function handleTestGemini(): Promise<void> {
    const trimmed = apiKey.trim(); if (!trimmed) { toast.error('Vui lòng nhập API key trước khi kiểm tra'); return; }
    setTesting(true);
    try { geminiService.configure(trimmed); const result = await geminiService.testConnection(trimmed); if (result.ok) { setGeminiApiKey(trimmed); queueUserSettingsSync(); if (result.quota) toast.message('Key hợp lệ — tạm hết hạn mức free-tier', { description: 'Đợi ~30s rồi thử lại. Key đã được lưu.' }); else toast.success(`Gemini hoạt động tốt — ${result.detail}`); } else toast.error(`Kiểm tra thất bại: ${result.detail}`); }
    catch (err) { toast.error(`Kiểm tra thất bại: ${err instanceof Error ? err.message : 'Không kết nối được Gemini'}`); }
    finally { setTesting(false); }
  }
  function handleClearGeminiKey(): void { setGeminiApiKey(null); geminiService.disconnect(); setApiKey(''); queueUserSettingsSync(); toast.message('Đã xóa Gemini API key'); }
  async function handleTestKilo(): Promise<void> {
    setTestingKilo(true);
    try { kiloService.setEnabled(true); const result = await kiloService.testConnection(); if (result.ok) toast.success(`Kilo Free OK — ${result.detail}`); else toast.error(`Kilo Free: ${result.detail}`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Không kết nối được Kilo'); }
    finally { setTestingKilo(false); }
  }

  function handleSaveGroqKey(): void { const t = groqKeyInput.trim(); if (!t) { toast.error('Vui lòng nhập Groq API key'); return; } setGroqApiKey(t); groqService.configure(t); queueUserSettingsSync(); toast.success('Đã lưu Groq API key'); }
  async function handleTestGroq(): Promise<void> { const t = groqKeyInput.trim(); if (!t) { toast.error('Vui lòng nhập API key trước'); return; } setTestingGroq(true); try { groqService.configure(t); const r = await groqService.testConnection(); if (r.ok) { setGroqApiKey(t); queueUserSettingsSync(); toast.success(`Groq hoạt động tốt — ${r.detail}`); } else toast.error(`Kiểm tra thất bại: ${r.detail}`); } catch (err) { toast.error(err instanceof Error ? err.message : 'Không kết nối được Groq'); } finally { setTestingGroq(false); } }
  function handleClearGroqKey(): void { setGroqApiKey(null); groqService.disconnect(); setGroqKeyInput(''); queueUserSettingsSync(); toast.message('Đã xóa Groq API key'); }

  function handleSaveOpenRouterKey(): void {
    const parsed = validateApiKey(openRouterKeyInput);
    if (!parsed.ok) { toast.error(parsed.detail); return; }
    setOpenRouterKeyInput(parsed.key);
    setOpenRouterApiKey(parsed.key);
    openRouterService.configure(parsed.key);
    queueUserSettingsSync();
    toast.success('Đã lưu OpenRouter API key');
  }
  async function handleTestOpenRouter(): Promise<void> {
    const parsed = validateApiKey(openRouterKeyInput);
    if (!parsed.ok) { toast.error(parsed.detail); return; }
    setOpenRouterKeyInput(parsed.key);
    setTestingOpenRouter(true);
    try {
      openRouterService.configure(parsed.key);
      const r = await openRouterService.testConnection();
      if (r.ok) {
        setOpenRouterApiKey(parsed.key);
        queueUserSettingsSync();
        toast.success(`OpenRouter hoạt động tốt — ${r.detail}`);
      } else toast.error(`Kiểm tra thất bại: ${r.detail}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không kết nối được OpenRouter');
    } finally {
      setTestingOpenRouter(false);
    }
  }
  function handleClearOpenRouterKey(): void { setOpenRouterApiKey(null); openRouterService.disconnect(); setOpenRouterKeyInput(''); queueUserSettingsSync(); toast.message('Đã xóa OpenRouter API key'); }

  function handleSaveSiliconFlowKey(): void { const t = siliconFlowKeyInput.trim(); if (!t) { toast.error('Vui lòng nhập SiliconFlow API key'); return; } setSiliconFlowApiKey(t); siliconFlowService.configure(t); queueUserSettingsSync(); toast.success('Đã lưu SiliconFlow API key'); }
  async function handleTestSiliconFlow(): Promise<void> { const t = siliconFlowKeyInput.trim(); if (!t) { toast.error('Vui lòng nhập API key trước'); return; } setTestingSiliconFlow(true); try { siliconFlowService.configure(t); const r = await siliconFlowService.testConnection(); if (r.ok) { setSiliconFlowApiKey(t); queueUserSettingsSync(); toast.success(`SiliconFlow hoạt động tốt — ${r.detail}`); } else toast.error(`Kiểm tra thất bại: ${r.detail}`); } catch (err) { toast.error(err instanceof Error ? err.message : 'Không kết nối được SiliconFlow'); } finally { setTestingSiliconFlow(false); } }
  function handleClearSiliconFlowKey(): void { setSiliconFlowApiKey(null); siliconFlowService.disconnect(); setSiliconFlowKeyInput(''); queueUserSettingsSync(); toast.message('Đã xóa SiliconFlow API key'); }

  function swapAdjacent(order: LlmSource[], i: number): LlmSource[] { const r = [...order]; const a = r[i], b = r[i+1]; if (a === undefined || b === undefined) return r; r[i] = b; r[i+1] = a; return r; }
  function handleMoveUp(index: number): void {
    if (index <= 0) return;
    setAiPriority(swapAdjacent(priorityOrder, index - 1));
    queueUserSettingsSync();
  }
  function handleMoveDown(index: number): void {
    if (index >= priorityOrder.length - 1) return;
    setAiPriority(swapAdjacent(priorityOrder, index));
    queueUserSettingsSync();
  }

  async function handleLogout(): Promise<void> { await logout(); toast.message('Đã đăng xuất.'); }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 px-[var(--s-md)] pt-[var(--s-md)] pb-2 border-b border-border-subtle bg-surface shrink-0">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={['flex items-center gap-1.5 px-3 py-1.5 rounded-field text-xs font-medium transition-colors',
                active ? 'bg-accent-bg text-accent-fg' : 'text-text-muted hover:bg-surface-hover'].join(' ')}>
              <Icon size={14} />{t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-[var(--s-md)] space-y-[var(--s-lg)]">

        {/* ═══ TAB: Tài khoản ═══ */}
        {tab === 'account' && (<>
          <section aria-label="Account settings">
            <Card><CardHeader><div className="flex items-center gap-2"><User className="h-4 w-4 text-accent-fg" /><CardTitle>Tài khoản</CardTitle></div></CardHeader>
              <CardContent><div className="space-y-[var(--s-sm)]">
                <div className="flex items-center justify-between"><span className="text-xs text-text-muted">Cửa hàng</span><span className="text-xs font-medium text-text-primary">{userProfile?.storeName ?? '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-text-muted">Email</span><span className="text-xs font-medium text-text-primary">{userProfile?.email ?? '—'}</span></div>
                {userProfile?.phone && <div className="flex items-center justify-between"><span className="text-xs text-text-muted">Số điện thoại</span><span className="text-xs text-text-primary">{userProfile.phone}</span></div>}
                {userProfile?.address && <div className="flex items-center justify-between"><span className="text-xs text-text-muted">Địa chỉ</span><span className="text-xs text-text-primary truncate max-w-[60%]">{userProfile.address}</span></div>}
                <div className="flex flex-wrap gap-[var(--s-xs)] pt-2 justify-end">
                  <Button variant="secondary" size="sm" onClick={() => setProfileOpen(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Sửa thông tin</Button>
                  <Button variant="outline" size="sm" onClick={() => setChangePasswordOpen(true)}><Lock className="mr-1.5 h-3.5 w-3.5" />Đổi mật khẩu</Button>
                  <Button variant="destructive" size="sm" onClick={handleLogout}><LogOut className="mr-1.5 h-3.5 w-3.5" />Đăng xuất</Button>
                </div>
              </div></CardContent>
            </Card>
          </section>

          <section aria-label="Shared household ledger">
            <Card><CardHeader><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-accent-fg" /><CardTitle>Sổ chung (Supabase)</CardTitle></div>
              {householdId ? <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge gap-1"><CheckCircle size={12} />Đã kết nối</Badge> : <Badge variant="outline" className="gap-1"><XCircle size={12} />Chưa kết nối</Badge>}
            </div></CardHeader>
              <CardContent><div className="space-y-[var(--s-md)]">
                <p className="text-xs text-text-muted">Đồng bộ chi/thu/khách/SP trên Postgres (nhóm nhỏ). Không dùng connection string DB trong app — chỉ anon key.</p>
                {!supabaseConfigured && <p className="text-xs text-warning-fg bg-warning-bg rounded-field px-2 py-1.5">Thêm <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> rồi chạy SQL trong <code>supabase/migrations/</code>.</p>}
                {pendingSync > 0 && <div className="flex items-center justify-between gap-2 rounded-field border px-2 py-1.5"><span className="text-xs text-warning-fg">Chưa đồng bộ cấu hình: {pendingSync}</span><Button size="sm" variant="outline" disabled={cloudBusy} onClick={() => void handleFlushSettingsSync()}><CloudUpload className="mr-1 h-3.5 w-3.5" />Đồng bộ ngay</Button></div>}
                {supabaseConfigured && !householdId && (<div className="space-y-[var(--s-xs)]"><p className="text-xs text-text-primary">Tài khoản: {supabaseEmail ?? userProfile?.email ?? '—'} — tạo hoặc tham gia sổ chung</p><Label htmlFor="hh-name">Tên sổ mới</Label><Input id="hh-name" value={householdNameInput} onChange={(e) => setHouseholdNameInput(e.target.value)} /><Button disabled={cloudBusy} onClick={() => void handleCreateHousehold()}><Users className="mr-2 h-4 w-4" />Tạo sổ chung</Button><Label htmlFor="invite-in">Hoặc nhập mã mời</Label><Input id="invite-in" value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())} placeholder="ABCD1234" /><Button variant="secondary" disabled={cloudBusy || !inviteCodeInput} onClick={() => void handleRedeemInvite()}><LogIn className="mr-2 h-4 w-4" />Tham gia bằng mã</Button></div>)}
                {householdId && (<div className="space-y-[var(--s-xs)]"><div className="flex items-center justify-between py-[var(--s-xs)]"><span className="text-xs text-text-muted">Sổ</span><span className="text-xs text-text-primary">{householdName}</span></div><div className="flex items-center justify-between py-[var(--s-xs)]"><span className="text-xs text-text-muted">Vai trò</span><span className="text-xs text-text-primary">{householdRole}</span></div><div className="flex items-center justify-between py-[var(--s-xs)]"><span className="text-xs text-text-muted">Email cloud</span><span className="text-xs text-text-primary truncate max-w-[60%]">{supabaseEmail}</span></div>{householdRole === 'owner' && <div className="flex items-center gap-[var(--s-xs)] flex-wrap"><Button variant="secondary" disabled={cloudBusy} onClick={() => void handleCreateInviteCode()}><Key className="mr-2 h-4 w-4" />Tạo mã mời (72h)</Button><div className="flex items-center gap-[var(--s-xs)] ml-auto"><Button variant="outline" disabled={cloudBusy} onClick={() => void handlePullCloud()}><RefreshCw className="mr-2 h-4 w-4" />Tải từ cloud</Button><Button variant="outline" disabled={cloudBusy} onClick={() => void handlePushLocalToCloud()}><Download className="mr-2 h-4 w-4" />Đẩy local lên</Button></div></div>}{lastInviteCode && <p className="text-xs font-mono bg-muted rounded-field px-2 py-1">Mã mời: <strong>{lastInviteCode}</strong> (72h)</p>}</div>)}
              </div></CardContent>
            </Card>
          </section>

          <section aria-label="Theme">
            <Card><CardHeader><div className="flex items-center gap-2"><Palette className="h-4 w-4 text-accent-fg" /><CardTitle>Giao diện</CardTitle></div></CardHeader>
              <CardContent><p className="text-xs text-text-muted mb-3">Chọn chế độ sáng/tối hoặc tự động theo hệ thống.</p>
                <div className="grid grid-cols-3 gap-2">{([{ value: 'light' as ThemeMode, label: 'Sáng', icon: Sun },{ value: 'dark' as ThemeMode, label: 'Tối', icon: Moon },{ value: 'system' as ThemeMode, label: 'Hệ thống', icon: Monitor }]).map((opt) => { const Icon = opt.icon; const active = mode === opt.value; return <button key={opt.value} type="button" onClick={() => setTheme(opt.value)} className={['flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-all', active ? 'border-accent-fg bg-accent-fg text-white shadow-sm' : 'border-border bg-neutral-bg hover:bg-surface-hover text-text-secondary'].join(' ')}><Icon size={20} /><span className="text-xs font-medium">{opt.label}</span></button>; })}</div>
              </CardContent>
            </Card>
          </section>
        </>)}

        {/* ═══ TAB: AI ═══ */}
        {tab === 'ai' && (<>
          <section aria-label="AI provider priority order">
            <Card><CardHeader><div className="flex items-center gap-2"><ArrowUp className="h-4 w-4 text-accent-fg" /><CardTitle>Thứ tự ưu tiên AI</CardTitle></div></CardHeader>
              <CardContent><div className="space-y-[var(--s-xs)]"><p className="text-xs text-text-muted">Kéo sắp xếp thứ tự ưu tiên — AI đầu tiên khả dụng sẽ được dùng.</p>
                <div className="space-y-1">{availableSources.map((source, visibleIdx) => { const fullIdx = priorityOrder.indexOf(source); return <div key={source} className="flex items-center justify-between bg-input-bg rounded-field px-[var(--s-sm)] py-1.5"><span className="text-xs text-text-primary">{llmSourceLabel(source)}</span><div className="flex items-center gap-0.5"><Button variant="ghost" size="sm" disabled={visibleIdx === 0} onClick={() => handleMoveUp(fullIdx)} aria-label={`Di chuyển ${source} lên`} className="h-7 w-7 p-0"><ArrowUp className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" disabled={visibleIdx >= availableSources.length - 1} onClick={() => handleMoveDown(fullIdx)} aria-label={`Di chuyển ${source} xuống`} className="h-7 w-7 p-0"><ArrowDown className="h-3.5 w-3.5" /></Button></div></div>; })}</div>
              </div></CardContent>
            </Card>
          </section>

          {([ 
            { label: 'Groq AI', configured: groqConfigured, enable: enableGroq, setEnable: setEnableGroq, keyInput: groqKeyInput, setKeyInput: setGroqKeyInput, testing, setTesting: setTestingGroq, onSave: handleSaveGroqKey, onTest: handleTestGroq, onClear: handleClearGroqKey, link: 'https://console.groq.com/keys', linkLabel: 'Groq Console', desc: 'Model mặc định: llama-3.3-70b-versatile.' },
            { label: 'OpenRouter', configured: openRouterConfigured, enable: enableOpenRouter, setEnable: setEnableOpenRouter, keyInput: openRouterKeyInput, setKeyInput: setOpenRouterKeyInput, testing: testingOpenRouter, setTesting: setTestingOpenRouter, onSave: handleSaveOpenRouterKey, onTest: handleTestOpenRouter, onClear: handleClearOpenRouterKey, link: 'https://openrouter.ai/keys', linkLabel: 'OpenRouter Keys', desc: 'Tự động lấy danh sách model free mới nhất từ OpenRouter (cập nhật định kỳ, có fallback).' },
            { label: 'SiliconFlow', configured: siliconFlowConfigured, enable: enableSiliconFlow, setEnable: setEnableSiliconFlow, keyInput: siliconFlowKeyInput, setKeyInput: setSiliconFlowKeyInput, testing: testingSiliconFlow, setTesting: setTestingSiliconFlow, onSave: handleSaveSiliconFlowKey, onTest: handleTestSiliconFlow, onClear: handleClearSiliconFlowKey, link: 'https://cloud.siliconflow.com/account/ak', linkLabel: 'SiliconFlow API Keys', desc: 'Tự động lấy model chat free mới nhất từ SiliconFlow (cập nhật định kỳ; host .com/.cn tự chuyển).' },
          ] as const).map((p) => (
            <section key={p.label} aria-label={`${p.label} AI settings`}>
              <Card><CardHeader><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 min-w-0"><Zap className="h-4 w-4 text-accent-fg shrink-0" /><CardTitle>{p.label}</CardTitle></div><div className="flex items-center gap-2 shrink-0">{p.configured ? <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge gap-1"><CheckCircle size={12} />Đã cấu hình</Badge> : <Badge variant="outline" className="gap-1"><XCircle size={12} />Chưa cấu hình</Badge>}<ToggleSwitch aria-label={`Bật ${p.label}`} checked={p.enable !== false} onCheckedChange={(on) => { p.setEnable(on); queueUserSettingsSync(); }} /></div></div></CardHeader>
                <CardContent><div className="space-y-[var(--s-md)]"><p className="text-xs text-text-muted">Nhập API key từ <a href={p.link} target="_blank" rel="noreferrer" className="text-accent-fg underline">{p.linkLabel}</a> rồi bấm Lưu hoặc Kiểm tra. {p.desc}</p><div className="flex items-center gap-[var(--s-xs)]"><input type="password" value={p.keyInput} onChange={(e) => p.setKeyInput(e.target.value)} placeholder={`Nhập ${p.label} API key...`} className="flex-1 bg-input-bg border border-input-border rounded-field px-[var(--s-sm)] py-1 text-xs text-text-primary placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-input-focus-ring" aria-label={`${p.label} API key`} /></div><div className="flex items-center gap-[var(--s-xs)] flex-wrap justify-end"><Button onClick={p.onSave}><Save className="mr-2 h-4 w-4" />Lưu API key</Button><Button variant="secondary" disabled={!p.keyInput.trim() || p.testing} onClick={() => void (p.onTest as () => Promise<void>)()}>{p.testing ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Đang kiểm tra…</> : <><SettingsIcon className="mr-2 h-4 w-4" />Kiểm tra</>}</Button>{p.configured && <Button variant="destructive" onClick={p.onClear}><Trash2 className="mr-2 h-4 w-4" />Xóa API key</Button>}</div></div></CardContent>
              </Card>
            </section>
          ))}

          <section aria-label="Kilo Free AI settings">
            <Card><CardHeader><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 min-w-0"><Bot className="h-4 w-4 text-accent-fg shrink-0" /><CardTitle>Kilo Free (cloud)</CardTitle></div><div className="flex items-center gap-2 shrink-0">{enableKiloFree !== false ? <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge gap-1"><CheckCircle size={12} />Ưu tiên online</Badge> : <Badge variant="outline" className="gap-1"><XCircle size={12} />Tắt</Badge>}<ToggleSwitch aria-label="Bật Kilo Free" checked={enableKiloFree !== false} onCheckedChange={(on) => { setEnableKiloFree(on); queueUserSettingsSync(); }} /></div></div></CardHeader>
              <CardContent><div className="space-y-[var(--s-sm)]"><p className="text-xs text-text-muted">Dùng <a href="https://kilo.ai/docs/gateway/models-and-providers" target="_blank" rel="noreferrer" className="text-accent-fg underline">kilo-auto/free</a> — tự chọn model free tốt nhất qua <a href="https://kilo.ai/" target="_blank" rel="noreferrer" className="text-accent-fg underline">Kilo Gateway</a>. Không cần API key. Giới hạn ~200 req/giờ/IP.</p><Button variant="secondary" disabled={testingKilo || enableKiloFree === false} onClick={() => void handleTestKilo()}>{testingKilo ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Đang kiểm tra…</> : 'Kiểm tra Kilo Free'}</Button></div></CardContent>
            </Card>
          </section>

          <section aria-label="Gemini API settings">
            <Card><CardHeader><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Key className="h-4 w-4 text-accent-fg" /><CardTitle>Gemini API</CardTitle></div>{geminiConfigured ? <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge gap-1"><CheckCircle size={12} />Đã cấu hình</Badge> : <Badge variant="outline" className="gap-1"><XCircle size={12} />Chưa cấu hình</Badge>}</div></CardHeader>
              <CardContent><div className="space-y-[var(--s-md)]"><p className="text-xs text-text-muted">Nhập API key từ <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent-fg underline">Google AI Studio</a> rồi bấm Lưu hoặc Kiểm tra.</p><div className="flex items-center gap-[var(--s-xs)]"><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Nhập API key..." className="flex-1 bg-input-bg border border-input-border rounded-field px-[var(--s-sm)] py-1 text-xs text-text-primary placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-input-focus-ring" aria-label="Gemini API key" /></div><div className="flex items-center gap-[var(--s-xs)] flex-wrap justify-end"><Button onClick={handleSaveGeminiKey}><Save className="mr-2 h-4 w-4" />Lưu API key</Button><Button variant="secondary" disabled={!apiKey.trim() || testing} onClick={() => void handleTestGemini()}>{testing ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Đang kiểm tra…</> : <><SettingsIcon className="mr-2 h-4 w-4" />Kiểm tra</>}</Button>{geminiConfigured && <Button variant="destructive" onClick={handleClearGeminiKey}><Trash2 className="mr-2 h-4 w-4" />Xóa API key</Button>}</div></div></CardContent>
            </Card>
          </section>

          <section aria-label="Local AI settings">
            <Card><CardHeader><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 min-w-0"><Bot className="h-4 w-4 text-accent-fg shrink-0" /><CardTitle>AI Cục Bộ (WebLLM)</CardTitle></div><div className="flex items-center gap-2 shrink-0">{enableWebLLM ? <Badge variant="default" className="bg-success-bg text-success-fg border-success-bg-badge gap-1"><CheckCircle size={12} />Đang bật</Badge> : <Badge variant="outline" className="gap-1"><XCircle size={12} />Tắt</Badge>}<ToggleSwitch aria-label="Bật AI cục bộ" checked={enableWebLLM} onCheckedChange={(on) => { setEnableWebLLM(on); queueUserSettingsSync(); }} /></div></div></CardHeader>
              <CardContent><p className="text-xs text-text-muted">Chạy model AI Qwen3-4B trực tiếp trên máy qua WebGPU. Có thể gây giật lag trên máy yếu.</p></CardContent>
            </Card>
          </section>
        </>)}

        {/* ═══ TAB: Mascot ═══ */}
        {tab === 'mascot' && (
          <section aria-label="Mascot settings">
            <Card><CardHeader><div className="flex items-center gap-2"><Cat className="h-4 w-4 text-accent-fg" /><CardTitle>Mèo Lucky</CardTitle></div></CardHeader>
              <CardContent><div className="space-y-[var(--s-md)]">
                <p className="text-xs text-text-muted">Điều chỉnh mức độ hoạt động của mascot trên màn hình. Chọn là lưu ngay — giữ sau khi tải lại trang. Double-click vào mèo để đổi nhanh.</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as MascotActivity[]).map((level) => {
                    const active = activity === level;
                    return (
                      <button key={level} type="button" onClick={() => {
                        if (activity === level) return;
                        setActivity(level);
                        toast.success(`Đã lưu: ${ACTIVITY_LABELS[level]}`);
                      }}
                        className={['flex flex-col items-center gap-1 py-3 px-2 rounded-lg border transition-all',
                          active ? 'border-accent-fg bg-accent-bg text-accent-fg shadow-sm' : 'border-border bg-neutral-bg hover:bg-surface-hover text-text-secondary'].join(' ')}>
                        <span className="text-lg">{level === 'low' ? '🐢' : level === 'high' ? '🐇' : '🐱'}</span>
                        <span className="text-xs font-medium">{ACTIVITY_LABELS[level]}</span>
                      </button>
                    );
                  })}
                </div>
              </div></CardContent>
            </Card>

            <Card className="mt-[var(--s-lg)]"><CardHeader><div className="flex items-center gap-2"><Info className="h-4 w-4 text-accent-fg" /><CardTitle>Hướng dẫn & Tính năng</CardTitle></div></CardHeader>
              <CardContent><div className="space-y-[var(--s-sm)] text-xs text-text-muted">
                <p>🐱 <strong>Mèo Lucky</strong> — thú cưng ảo sống trong app, tự động đi lại, leo trèo, nhảy nhót.</p>
                <div className="space-y-1 mt-2">
                  <p>🖱️ <strong>Click</strong> — mèo giật mình</p>
                  <p>🖱️🖱️ <strong>Double-click</strong> — đổi nhanh mức hoạt động</p>
                  <p>↗️ <strong>Kéo + thả</strong> — ném mèo đi, mèo sẽ bung dù rơi xuống</p>
                </div>
                <div className="space-y-1 mt-2">
                  <p>🚶 <strong>Đi bộ</strong> — dọc mặt đất hoặc trên element</p>
                  <p>🤸 <strong>Nhảy</strong> — bật lên rồi đáp xuống</p>
                  <p>🧗 <strong>Leo trèo</strong> — trèo lên card, button, bảng...</p>
                  <p>🪝 <strong>Grapple</strong> — bắn móc câu lên platform cao</p>
                  <p>🪂 <strong>Bung dù</strong> — khi rơi từ trên cao</p>
                </div>
                <p className="mt-2">💬 Mèo tự động nói chuyện khi rảnh hoặc khi có giao dịch mới.</p>
              </div></CardContent>
            </Card>
          </section>
        )}

        {/* ═══ TAB: About ═══ */}
        {tab === 'about' && (
          <section aria-label="About">
            <Card><CardHeader><div className="flex items-center gap-2"><Info className="h-4 w-4 text-accent-fg" /><CardTitle>Thông tin</CardTitle></div></CardHeader>
              <CardContent><div className="space-y-[var(--s-sm)]">
                <div className="flex items-center justify-between"><span className="text-xs text-text-muted">Ứng dụng</span><span className="text-xs font-medium text-text-primary">Quản lý thu chi</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-text-muted">Phiên bản</span><span className="bg-accent-bg text-accent-fg text-xs px-2 py-0.5 rounded-full">1.0.6</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-text-muted">Công nghệ</span><span className="text-xs text-text-primary">React 19 · Vite · TypeScript · Tailwind 4 · SQLite + Supabase</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-text-muted">AI</span><span className="text-xs text-text-primary">Kilo Free · OpenRouter · SiliconFlow · Groq · Gemini · WebLLM</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-text-muted">Tác giả</span><span className="text-xs text-text-primary">Quản Lý Tài Chính Team 🐱</span></div>
              </div></CardContent>
            </Card>
          </section>
        )}

      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
}
