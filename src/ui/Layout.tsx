/**
 * Layout — App shell with top navigation bar, content area, status bar, and FAB.
 *
 * Structure:
 *   - Top nav bar: brand logo + 5 tabs + sync badge + clock
 *   - Content area: <Outlet /> with max-width container
 *   - Bottom: StatusBar
 *   - FAB (🤖) bottom-right to toggle AI ChatPanel
 *   - ChatPanel slide-in overlay
 *   - Mobile (<768px): tabs move to bottom navigation
 */

import { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useUIStore } from '@store/uiStore';
import { StatusBar } from '@components/StatusBar';
import { ChatPanel } from '@screens/ai/ChatPanel';

const tabs = [
  { label: 'Tổng quan', route: '/', tab: 'dashboard' as const },
  { label: 'Chi phí', route: '/expense', tab: 'expense' as const },
  { label: 'Doanh thu', route: '/revenue', tab: 'revenue' as const },
  { label: 'Báo cáo', route: '/report', tab: 'report' as const },
  { label: 'Cài đặt', route: '/settings', tab: 'settings' as const },
];

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
    setSyncState(navigator.onLine ? 'synced' : 'offline');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background min-w-0 overflow-hidden">
      {/* ── Top Navigation Bar ─────────────────────────────────────── */}
      <header
        className="shrink-0 flex items-center justify-between px-[var(--s-md)] h-12 bg-surface border-b border-border sticky top-0 z-20 min-w-0 overflow-hidden"
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Brand with logo */}
        <div className="flex items-center gap-[var(--s-sm)] min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-field bg-gradient-to-br from-accent-fg to-purple-600 text-white text-sm font-bold shrink-0">
            ₫
          </div>
          <span className="hidden sm:inline text-text-primary font-semibold text-sm">
            Quản Lý Tài Chính
          </span>
        </div>

        {/* Center Tabs — visible on md+ */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Primary tabs">
          {tabs.map((tab) => (
            <NavLink key={tab.route} to={tab.route} className={tabClass} end={tab.route === '/'}>
              {tab.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: Sync Status + Clock */}
        <div className="hidden sm:flex items-center gap-[var(--s-md)] min-w-0">
          <div className="flex items-center gap-[var(--s-xs)] text-[11px] text-text-secondary bg-success-bg px-2 py-0.5 rounded-badge">
            <span className={`size-1.5 rounded-full ${syncState === 'synced' ? 'bg-success-fg' : syncState === 'syncing' ? 'bg-warning-fg animate-pulse' : 'bg-text-disabled'}`} />
            {syncState === 'synced' ? 'Đã đồng bộ' : syncState === 'syncing' ? 'Đang đồng bộ...' : 'Ngoại tuyến'}
          </div>
          <span className="text-[11px] text-text-muted tabular-nums">{clock}</span>
        </div>
      </header>

      {/* ── Mobile Tabs (bottom bar) ───────────────────────────────── */}
      <nav
        className="md:hidden flex items-center justify-around h-14 bg-surface border-t border-border px-1 shrink-0 pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Primary tabs (mobile)"
      >
        {tabs.map((tab) => (
          <NavLink key={tab.route} to={tab.route} className={mobileTabClass} end={tab.route === '/'}>
            <span className="text-base">
              {tab.tab === 'dashboard' && '📊'}
              {tab.tab === 'expense' && '💸'}
              {tab.tab === 'revenue' && '💰'}
              {tab.tab === 'report' && '📈'}
              {tab.tab === 'settings' && '⚙️'}
            </span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Content Area with max-width container ──────────────────── */}
      <main className="flex-1 overflow-y-auto min-h-0 pb-[88px] md:pb-0">
        <div className="max-w-6xl mx-auto w-full p-[var(--s-md)] md:p-[var(--s-xl)] min-w-0 overflow-x-auto">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom Status Bar ──────────────────────────────────────── */}
      <StatusBar syncStatus={syncState} />

      {/* ── FAB — AI Chat Toggle ───────────────────────────────────── */}
      <button
        type="button"
        onClick={toggleFab}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex items-center justify-center size-12 text-2xl rounded-full shadow-xl bg-accent-fg hover:bg-accent-fg-hover text-white transition-all duration-[var(--d-fast)] hover:scale-110"
        aria-label="Toggle AI chat"
      >
        <span className="absolute inset-[-4px] rounded-full border-2 border-accent-fg opacity-0 animate-[fabPulse_2s_infinite]" />
        🤖
      </button>

      {/* ── AI Chat Panel ──────────────────────────────────────────── */}
      {fabOpen && <ChatPanel />}
    </div>
  );
}
