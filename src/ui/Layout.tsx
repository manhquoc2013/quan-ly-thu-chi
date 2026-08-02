/**
 * Layout — App shell with top navigation bar, content area, status bar, and FAB.
 *
 * Structure:
 *   - Top nav bar: brand logo + 5 tabs + sync badge + clock
 *   - Content area: <Outlet /> with max-width container
 *   - Bottom: StatusBar
 *   - FAB (Bot icon) bottom-right to toggle AI ChatPanel
 *   - ChatPanel slide-in overlay
 *   - Mobile (<768px): tabs move to bottom navigation
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, Coins, BarChart3, Settings, Bot, Users, Package, Store } from 'lucide-react';
import { useUIStore } from '@store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { ChatPanel } from '@screens/ai/ChatPanel';
import { MascotOverlay } from '@/ui/components/MascotOverlay';
import { bootstrapAppData } from '@/services/bootstrap';
import { webLLM } from '@/services/webLLM';

const tabs = [
  { label: 'Tổng quan', route: '/', tab: 'dashboard' as const },
  { label: 'Chi phí', route: '/expense', tab: 'expense' as const },
  { label: 'Doanh thu', route: '/revenue', tab: 'revenue' as const },
  { label: 'Khách', route: '/customers', tab: 'customers' as const },
  { label: 'SP', route: '/products', tab: 'products' as const },
  { label: 'Kênh', route: '/platforms', tab: 'platforms' as const },
  { label: 'Báo cáo', route: '/report', tab: 'report' as const },
  { label: 'Cài đặt', route: '/settings', tab: 'settings' as const },
];

const tabIcons: Record<string, ReactNode> = {
  dashboard: <LayoutDashboard size={14} />,
  expense: <Receipt size={14} />,
  revenue: <Coins size={14} />,
  customers: <Users size={14} />,
  products: <Package size={14} />,
  platforms: <Store size={14} />,
  report: <BarChart3 size={14} />,
  settings: <Settings size={14} />,
};

function tabClass({ isActive }: { isActive: boolean }): string {
  return [
    'px-[var(--s-md)] py-1 text-xs font-medium rounded transition-colors duration-[var(--d-fast)]',
    'hover:bg-surface-hover',
    isActive
      ? 'text-accent-fg bg-accent-bg'
      : 'text-text-secondary',
  ].join(' ');
}

function mobileTabClass({ isActive }: { isActive: boolean }): string {
  return [
    'flex flex-col items-center gap-0.5 flex-1 py-1 text-[10px] font-medium transition-colors duration-[var(--d-fast)]',
    isActive
      ? 'text-accent-fg'
      : 'text-text-muted',
  ].join(' ');
}

export function Layout() {
  const fabOpen = useUIStore((s) => s.fabOpen);
  const toggleFab = useUIStore((s) => s.toggleFab);
  const [clock, setClock] = useState('');
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [dataReady, setDataReady] = useState(false);

  // Hydrate stores from IndexedDB once on mount
  useEffect(() => {
    let cancelled = false;
    setSyncState(navigator.onLine ? 'syncing' : 'offline');
    bootstrapAppData()
      .then(() => {
        if (!cancelled) {
          setDataReady(true);
          setSyncState(navigator.onLine ? 'synced' : 'offline');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataReady(true); // still render UI even if cache fail
          setSyncState(navigator.onLine ? 'synced' : 'offline');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync WebLLM disabled state from store
  const enableWebLLM = useAuthStore((s) => s.enableWebLLM);
  useEffect(() => {
    webLLM.setDisabled(!enableWebLLM);
  }, [enableWebLLM]);

  // Live clock
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Detect online/offline
  useEffect(() => {
    const online = () => setSyncState('synced');
    const offline = () => setSyncState('offline');
    setSyncState(navigator.onLine ? (dataReady ? 'synced' : 'syncing') : 'offline');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [dataReady]);

  return (
    <div className="flex flex-col h-screen bg-background min-w-0 overflow-hidden">
      {/* ── Top Navigation Bar ─────────────────────────────────────── */}
      <header
        className="shrink-0 flex items-center justify-between gap-2 px-[var(--s-md)] h-12 bg-surface border-b border-border sticky top-0 z-20 min-w-0"
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-initial">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-field shrink-0 object-cover"
          />
          <div className="min-w-0">
            <p className="text-text-primary font-semibold text-sm leading-tight truncate">
              <span className="md:hidden">Thu Chi</span>
              <span className="hidden md:inline">Quản Lý Tài Chính</span>
            </p>
            <p className="md:hidden text-[10px] text-text-muted leading-tight truncate">
              Quản lý thu · chi
            </p>
          </div>
        </div>

        {/* Center Tabs — visible on md+ */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Primary tabs">
          {tabs.map((tab) => (
            <NavLink key={tab.route} to={tab.route} className={tabClass} end={tab.route === '/'}>
              <span className="flex items-center gap-1.5">
                {tabIcons[tab.tab]}
                {tab.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Right: Sync + clock — always visible */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-text-secondary bg-success-bg px-2 py-0.5 rounded-badge max-w-[9.5rem]"
            title={
              syncState === 'synced'
                ? 'Đã đồng bộ'
                : syncState === 'syncing'
                  ? 'Đang đồng bộ'
                  : 'Ngoại tuyến'
            }
          >
            <span
              className={`size-1.5 rounded-full shrink-0 ${
                syncState === 'synced'
                  ? 'bg-success-fg'
                  : syncState === 'syncing'
                    ? 'bg-warning-fg animate-pulse'
                    : 'bg-text-disabled'
              }`}
            />
            <span className="truncate">
              {syncState === 'synced' ? 'Đồng bộ' : syncState === 'syncing' ? 'Đang sync' : 'Offline'}
            </span>
          </div>
          <span className="text-[11px] text-text-muted tabular-nums">{clock || '--:--'}</span>
        </div>
      </header>

      {/* ── Content Area with max-width container ──────────────────── */}
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-6xl mx-auto w-full p-[var(--s-md)] md:p-[var(--s-xl)] min-w-0 pb-[calc(var(--dimens-fabClearance)+0.5rem)]">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile Tabs (bottom bar) ───────────────────────────────── */}
      <nav
        className="md:hidden flex items-center justify-around h-14 bg-surface border-t border-border px-1 shrink-0"
        aria-label="Primary tabs (mobile)"
      >
        {tabs.map((tab) => (
          <NavLink key={tab.route} to={tab.route} className={mobileTabClass} end={tab.route === '/'}>
            <span className="text-base">{tabIcons[tab.tab]}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom Status Bar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-[var(--s-md)] h-[var(--dimens-statusBarHeight)] bg-surface border-t border-border text-[10px] text-text-muted shrink-0 pb-[env(safe-area-inset-bottom,0px)]">
        <span>© 2026 Quản Lý Tài Chính</span>
        <span>v1.0.0</span>
      </div>

      {/* ── FAB — AI Chat Toggle ───────────────────────────────────── */}
      <button
        type="button"
        onClick={toggleFab}
        className="fixed z-40 flex items-center justify-center size-12 text-2xl rounded-full shadow-xl bg-accent-fg hover:bg-accent-fg-hover text-white transition-all duration-[var(--d-fast)] hover:scale-110 bottom-[calc(var(--dimens-statusBarHeight)+3.5rem+0.75rem)] right-4 md:bottom-[calc(var(--dimens-statusBarHeight)+0.75rem)] md:right-6"
        aria-label="Toggle AI chat"
      >
        <span className="absolute inset-[-4px] rounded-full border-2 border-accent-fg opacity-0 animate-[fabPulse_2s_infinite]" />
        <Bot size={20} />
      </button>

      {/* ── AI Chat Panel ──────────────────────────────────────────── */}
      {fabOpen && <ChatPanel />}

      {/* ── Mascot Overlay ──────────────────────────────────────────── */}
      <MascotOverlay />
    </div>
  );
}
