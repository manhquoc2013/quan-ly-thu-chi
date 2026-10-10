/**
 * Layout — App shell with animated sidebar, top bar, command palette, chat panel.
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, Coins, BarChart3, Settings,
  Bot, Users, Package, Store,
  Sun, Moon, Monitor, Bell, Search, LogOut,
  ChevronLeft, ChevronRight, RefreshCw, X, Menu,
  FileUp, Radio, AlertTriangle, CheckCheck,
} from 'lucide-react';
import { useUIStore } from '@store/uiStore';
import { useAuthStore, useNotificationStore, useUnreadCount } from '@/store';
import type { NotificationType } from '@/store';
import { formatRelativeTime } from '@/utils/date';
import { ChatPanel } from '@screens/ai/ChatPanel';
import { MascotOverlay } from '@/ui/components/MascotOverlay';
import { CommandPalette } from '@/ui/components/CommandPalette';
import { useWebLLMLoad } from '@/ui/components/WebLLMLoader';
import { bootstrapAppData } from '@/services/bootstrap';
import { pendingCount } from '@/services/syncOutbox';
import { flushOutbox } from '@/services/syncEngine';
import { useTheme } from '@/hooks/useTheme';
import { APP_VERSION_LABEL } from '@/appVersion';

interface NavItem { label: string; route: string; tab: string; icon: ReactNode; }

const navItems: NavItem[] = [
  { label: 'Tổng quan', route: '/', tab: 'dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Chi phí', route: '/expense', tab: 'expense', icon: <Receipt size={18} /> },
  { label: 'Doanh thu', route: '/revenue', tab: 'revenue', icon: <Coins size={18} /> },
  { label: 'Khách hàng', route: '/customers', tab: 'customers', icon: <Users size={18} /> },
  { label: 'Sản phẩm', route: '/products', tab: 'products', icon: <Package size={18} /> },
  { label: 'Kênh', route: '/platforms', tab: 'platforms', icon: <Store size={18} /> },
  { label: 'Báo cáo', route: '/report', tab: 'report', icon: <BarChart3 size={18} /> },
  { label: 'Cài đặt', route: '/settings', tab: 'settings', icon: <Settings size={18} /> },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Tổng quan', '/expense': 'Chi phí', '/revenue': 'Doanh thu',
  '/customers': 'Khách hàng', '/products': 'Sản phẩm', '/platforms': 'Kênh bán',
  '/report': 'Báo cáo', '/settings': 'Cài đặt',
};

export function Layout() {
  const location = useLocation();
  const fabOpen = useUIStore((s) => s.fabOpen);
  const toggleFab = useUIStore((s) => s.toggleFab);
  const setFabOpen = useUIStore((s) => s.setFabOpen);
  const userId = useAuthStore((s) => s.userId);
  const userProfile = useAuthStore((s) => s.userProfile);
  const enableWebLLM = useAuthStore((s) => s.enableWebLLM);
  const logout = useAuthStore((s) => s.logout);
  // Eager-load only inside the app when Settings → AI cục bộ is on (never on login)
  const { progress: webLLMProgress, done: webLLMDone } = useWebLLMLoad({ enabled: enableWebLLM });
  const [clock, setClock] = useState('');
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline' | 'pending'>('synced');
  const [pending, setPending] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const { mode, isDark, cycleTheme: toggleDark } = useTheme();
  const [chatClosing, setChatClosing] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const closeMobileMenu = () => { setMenuClosing(true); setTimeout(() => { setMenuClosing(false); setMobileMenuOpen(false); }, 250); };
  const unreadCount = useUnreadCount();
  const notifications = useNotificationStore((s) => s.notifications);
  const { markRead, markAllRead } = useNotificationStore.getState();
  const NOTIFICATION_ICON: Record<NotificationType, ReactNode> = useMemo(() => ({
    sync: <RefreshCw size={14} />,
    import: <FileUp size={14} />,
    ai: <Bot size={14} />,
    realtime: <Radio size={14} />,
    error: <AlertTriangle size={14} />,
  }), []);
  const visibleNotifications = useMemo(() => notifications.slice(0, 8), [notifications]);

  const sidebarCollapsed = collapsed;
  const toggleSidebar = () => setCollapsed((prev) => !prev);

  useEffect(() => {
    const offset = sidebarCollapsed
      ? 'var(--dimens-sidebar-collapsed)'
      : 'var(--dimens-sidebar-width)';
    document.documentElement.style.setProperty('--layout-sidebar-offset', offset);
    return () => {
      document.documentElement.style.removeProperty('--layout-sidebar-offset');
    };
  }, [sidebarCollapsed]);

  /* overflow-y:auto also enables overflow-x in CSS — pin scrollLeft so content never sits under the sidebar */
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    main.scrollLeft = 0;
    const lock = () => { if (main.scrollLeft !== 0) main.scrollLeft = 0; };
    main.addEventListener('scroll', lock, { passive: true });
    return () => main.removeEventListener('scroll', lock);
  }, [location.pathname]);
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Quản Lý Tài Chính';
  const displayName = userProfile?.storeName ?? 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const closeChat = () => { setChatClosing(true); setTimeout(() => { setChatClosing(false); setFabOpen(false); }, 200); };

  useEffect(() => {
    let c = false;
    setSyncState(navigator.onLine ? 'syncing' : 'offline');
    bootstrapAppData().then(() => { if (!c) setSyncState('synced'); })
      .catch(() => { if (!c) setSyncState('synced'); });
    return () => { c = true; };
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (!navigator.onLine) { setSyncState('offline'); return; }
      const n = userId ? pendingCount(userId) : 0; setPending(n);
      setSyncState(n > 0 ? 'pending' : 'synced');
    };
    refresh();
    const on = () => { refresh(); if (userId) flushOutbox(userId).then(refresh).catch(() => {}); };
    window.addEventListener('online', on);
    window.addEventListener('offline', () => setSyncState('offline'));
    const id = setInterval(refresh, 5000);
    return () => { window.removeEventListener('online', on); clearInterval(id); };
  }, [userId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch((v) => !v); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const handleSync = async () => {
    if (!userId || syncing) return; setSyncing(true);
    try {
      const result = await flushOutbox(userId);
      const { flushed, failed } = result;
      if (flushed > 0) {
        useNotificationStore.getState().addNotification(
          'sync', 'Đồng bộ dữ liệu',
          flushed === 1 ? 'Đã đồng bộ 1 thay đổi' : `Đã đồng bộ ${flushed} thay đổi`,
        );
      }
      if (failed > 0) {
        useNotificationStore.getState().addNotification(
          'error', 'Lỗi đồng bộ',
          failed === 1 ? '1 thay đổi không đồng bộ được' : `${failed} thay đổi không đồng bộ được`,
        );
      }
    } catch (err) {
      console.warn('Sync flush failed', err);
    }
    setSyncing(false); setShowBell(false);
  };
  const isActive = (route: string) => route === '/' ? location.pathname === '/' : location.pathname.startsWith(route);
  const syncLabel = syncState === 'synced' ? 'Đã đồng bộ' : syncState === 'pending' ? `${pending} thay đổi` : 'Đang sync...';

  return (
    <div className="fixed inset-0 flex flex-col bg-background min-w-0 overflow-hidden font-sans">
      <div className="flex flex-1 min-h-0 min-w-0">
        {/* Sidebar — inline styles for smooth animation */}
        <aside
          className="hidden md:flex flex-col shrink-0 bg-sidebar-bg text-sidebar-fg border-r border-sidebar-border overflow-hidden select-none transition-all duration-300"
          style={{ width: sidebarCollapsed ? 68 : 252 }}
        >
          {/* Brand header */}
          <div className={`flex items-center h-14 shrink-0 border-b border-sidebar-border overflow-hidden ${sidebarCollapsed ? 'justify-center px-0' : 'px-4'}`}>
            <div className="size-9 rounded-xl bg-gradient-to-tr from-teal-600 via-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-sm shadow-teal-700/20 shrink-0 font-bold glow-teal-sm">
              <Coins size={18} className="stroke-[2.2]" />
            </div>
            <div
              style={{
                opacity: sidebarCollapsed ? 0 : 1,
                maxWidth: sidebarCollapsed ? 0 : 200,
                marginLeft: sidebarCollapsed ? 0 : 12,
                transition: 'opacity 0.3s ease, max-width 0.3s ease, margin-left 0.3s ease',
              }}
              className="flex flex-col min-w-0 overflow-hidden whitespace-nowrap"
            >
              <span className="text-xs font-bold text-sidebar-fg tracking-tight uppercase">Quản Lý Thu Chi</span>
              <span className="text-[10px] text-text-muted truncate">Sổ quỹ & Bán hàng thông minh</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 scrollbar-thin overscroll-contain space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.route);
              return (
                <NavLink
                  key={item.route}
                  to={item.route}
                  end={item.route === '/'}
                  className={`group relative flex items-center rounded-xl transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
                    active
                      ? 'bg-accent-fg text-white shadow-sm shadow-teal-700/30 font-semibold'
                      : 'text-sidebar-fg hover:bg-sidebar-hover/80 hover:text-text-primary font-medium'
                  } ${sidebarCollapsed ? 'justify-center mx-auto size-11 p-0' : 'px-3 h-10 w-full'}`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className={`shrink-0 flex items-center justify-center w-5 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white' : 'text-text-muted group-hover:text-text-primary'}`}>
                    {item.icon}
                  </span>
                  <span
                    style={{
                      opacity: sidebarCollapsed ? 0 : 1,
                      maxWidth: sidebarCollapsed ? 0 : 160,
                      marginLeft: sidebarCollapsed ? 0 : 12,
                      transition: 'opacity 0.3s ease, max-width 0.3s ease, margin-left 0.3s ease',
                    }}
                    className="text-xs truncate overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </nav>

          {/* User profile / Bottom bar */}
          <div className={`shrink-0 border-t border-sidebar-border flex items-center overflow-hidden transition-all duration-300 p-2 ${sidebarCollapsed ? 'justify-center h-14' : 'h-14'}`}>
            {sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => logout()}
                className="size-10 rounded-xl flex items-center justify-center hover:bg-sidebar-hover text-sidebar-fg hover:text-danger-fg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
                title="Đăng xuất"
                aria-label="Đăng xuất"
              >
                <LogOut size={16} />
              </button>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0 w-full px-2 py-1.5 rounded-xl hover:bg-sidebar-hover/40 transition-colors">
                <div className="relative size-8 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                  {avatarLetter}
                  <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-400 ring-1 ring-sidebar-bg" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-sidebar-fg truncate leading-tight">{displayName}</span>
                  <span className="text-[10px] text-text-muted truncate leading-tight">Chủ cửa hàng</span>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="p-1.5 rounded-lg hover:bg-sidebar-hover text-sidebar-fg hover:text-danger-fg transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-fg"
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Content Viewport */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
          {/* Frosted Topbar */}
          <header className="flex shrink-0 items-center gap-3 px-4 md:px-5 h-14 bg-surface/85 backdrop-blur-md border-b border-border/80 z-20">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden size-11 flex items-center justify-center rounded-xl hover:bg-surface-hover text-text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
              aria-label="Mở menu điều hướng"
            >
              <Menu size={20} />
            </button>

            {/* Desktop sidebar toggle */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:flex size-9 items-center justify-center rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-all duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
              aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            {/* Page title */}
            <h1 className="text-sm md:text-base font-bold text-text-primary truncate flex-1 flex items-center gap-2 tracking-tight">
              <span>{pageTitle}</span>
            </h1>

            {/* Quick Search Bar */}
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="hidden lg:flex items-center gap-2 bg-background/80 hover:bg-background border border-border/80 hover:border-accent-fg rounded-xl px-3.5 py-1.5 text-xs text-text-muted w-64 transition-all duration-200 shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
              aria-label="Tìm kiếm nhanh (Command + K)"
            >
              <Search size={14} className="text-text-muted shrink-0" />
              <span className="flex-1 text-left truncate">Tìm kiếm nhanh...</span>
              <kbd className="text-[10px] font-mono bg-surface border border-border rounded-md px-1.5 py-0.5 text-text-disabled shadow-2xs">⌘K</kbd>
            </button>

            {/* Cloud Sync Status Chip */}
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
                syncState === 'synced'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/15'
                  : syncState === 'offline'
                  ? 'bg-neutral-500/10 text-text-muted border-border hover:bg-neutral-500/15'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 hover:bg-amber-500/15'
              }`}
              title={syncing ? 'Đang đồng bộ...' : 'Nhấp để đồng bộ ngay'}
              aria-label={`Trạng thái đồng bộ: ${syncLabel}`}
            >
              {syncing ? (
                <RefreshCw size={12} className="animate-spin text-accent-fg shrink-0" />
              ) : (
                <span className={`size-2 rounded-full shrink-0 ${
                  syncState === 'synced'
                    ? 'bg-emerald-500'
                    : syncState === 'offline'
                    ? 'bg-text-disabled'
                    : 'bg-amber-500 animate-pulse'
                }`} />
              )}
              <span className="tabular-nums leading-none">{syncing ? 'Đang sync...' : syncLabel}</span>
            </button>

            {/* Theme switch button */}
            <button
              type="button"
              onClick={toggleDark}
              className="size-9 flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-all duration-200 hover:scale-105 active:scale-95 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
              title={`Giao diện: ${mode === 'system' ? 'Hệ thống' : isDark ? 'Tối' : 'Sáng'}`}
              aria-label="Chuyển đổi giao diện Sáng / Tối"
            >
              {mode === 'system' ? <Monitor size={18} /> : isDark ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Notification Bell */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowBell((v) => !v)}
                className="relative size-9 flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
                title="Thông báo hệ thống"
                aria-label={`Thông báo ${unreadCount > 0 ? `(${unreadCount} chưa đọc)` : ''}`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute 1 top-1 right-1 size-4 rounded-full bg-accent-fg text-white text-[10px] font-bold flex items-center justify-center border-2 border-surface animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showBell && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowBell(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 w-84 bg-surface border border-border rounded-2xl shadow-2xl animate-scale-in max-h-[75vh] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/70 backdrop-blur-sm shrink-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-text-primary">Thông báo</p>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-accent-bg text-accent-fg text-[10px] font-bold">
                            {unreadCount} mới
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => markAllRead()}
                          className="text-xs font-medium text-accent-fg hover:text-accent-fg-hover transition-colors flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:underline"
                        >
                          <CheckCheck size={13} /> Đã đọc hết
                        </button>
                      )}
                    </div>

                    {/* Sync status bar in panel */}
                    <div className="flex items-center justify-between px-4 py-2 bg-surface-hover/40 border-b border-border/50 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${syncState === 'synced' ? 'bg-success-fg' : syncState === 'offline' ? 'bg-text-disabled' : 'bg-warning-fg animate-pulse'}`} />
                        <span className="text-xs text-text-secondary">{syncLabel}</span>
                      </div>
                      {pending > 0 && (
                        <button
                          type="button"
                          onClick={handleSync}
                          disabled={syncing}
                          className="text-xs text-accent-fg hover:underline font-medium cursor-pointer"
                        >
                          {syncing ? 'Đang gửi...' : 'Đồng bộ'}
                        </button>
                      )}
                    </div>

                    {/* Notification list */}
                    <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border/40">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                          <Bell size={28} className="text-text-muted/40 mb-2" />
                          <p className="text-xs font-medium text-text-secondary">Chưa có thông báo nào</p>
                          <p className="text-[11px] text-text-muted mt-0.5">Mọi cập nhật đồng bộ và AI sẽ xuất hiện tại đây</p>
                        </div>
                      ) : (
                        <div className="py-1">
                          {visibleNotifications.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => markRead(item.id)}
                              className={`w-full text-left px-4 py-3 transition-colors hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:bg-surface-hover ${!item.read ? 'bg-accent-fg/5' : ''}`}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                                  item.type === 'error'
                                    ? 'bg-danger-bg text-danger-fg'
                                    : item.type === 'sync'
                                    ? 'bg-success-bg text-success-fg'
                                    : item.type === 'import'
                                    ? 'bg-accent-bg text-accent-fg'
                                    : item.type === 'ai'
                                    ? 'bg-info-bg text-info-fg'
                                    : 'bg-warning-bg text-warning-fg'
                                }`}>
                                  {NOTIFICATION_ICON[item.type]}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-text-primary truncate">{item.title}</p>
                                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-2 leading-relaxed">{item.message}</p>
                                  <p className="text-[10px] text-text-muted mt-1 tabular-nums">{formatRelativeTime(item.timestamp)}</p>
                                </div>
                                {!item.read && (
                                  <span className="mt-1.5 size-2 rounded-full bg-accent-fg shrink-0" />
                                )}
                              </div>
                            </button>
                          ))}
                          {notifications.length > 8 && (
                            <p className="text-center text-[10px] text-text-muted py-2 bg-surface-hover/20">
                              +{notifications.length - 8} thông báo trước đó
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sync button in dropdown */}
                    {pending > 0 && (
                      <div className="p-3 border-t border-border bg-surface shrink-0">
                        <button
                          type="button"
                          onClick={handleSync}
                          disabled={syncing}
                          className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-accent-fg text-white rounded-xl py-2.5 hover:bg-accent-fg-hover transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
                        >
                          {syncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />} Đồng bộ {pending} thay đổi
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Monospace Clock */}
            <span className="hidden sm:inline-block text-xs font-mono font-medium text-text-secondary bg-surface-hover/60 border border-border/50 rounded-lg px-2 py-1 tabular-nums shrink-0">
              {clock || '--:--'}
            </span>
          </header>

          {/* Main Scroller Content */}
          <main
            ref={(node) => {
              if (node) node.scrollLeft = 0;
            }}
            className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-clip overscroll-y-contain"
          >
            <div key={location.pathname} className="animate-fade-in-up w-full max-w-7xl mx-auto min-w-0 p-4 sm:p-6 pb-[calc(var(--dimens-fabClearance)+1rem)]">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-24">
                    <div className="flex gap-2">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="size-2.5 rounded-full bg-accent-fg animate-pulse"
                          style={{ animationDelay: `${i * 0.2}s` }}
                        />
                      ))}
                    </div>
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {(mobileMenuOpen || menuClosing) && (
        <div className="md:hidden">
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={closeMobileMenu} />
          <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar-bg border-r border-sidebar-border shadow-2xl flex flex-col ${menuClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}>
            <div className="flex items-center justify-between h-14 px-4 shrink-0 border-b border-sidebar-border">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-xs font-bold">
                  <Coins size={16} />
                </div>
                <span className="text-sm font-bold text-sidebar-fg">Quản Lý Thu Chi</span>
              </div>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="size-11 flex items-center justify-center rounded-lg hover:bg-sidebar-hover text-sidebar-fg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
                aria-label="Đóng menu"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.route}
                  to={item.route}
                  end={item.route === '/'}
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive(item.route)
                      ? 'bg-accent-fg text-white shadow-xs font-semibold'
                      : 'text-sidebar-fg hover:bg-sidebar-hover'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="shrink-0 border-t border-sidebar-border p-4 flex items-center gap-3">
              <div className="size-8 rounded-full bg-accent-fg text-white flex items-center justify-center text-xs font-bold shrink-0">
                {avatarLetter}
              </div>
              <span className="text-xs font-semibold text-sidebar-fg truncate flex-1">{displayName}</span>
              <button
                type="button"
                onClick={() => { closeMobileMenu(); logout(); }}
                className="p-2 rounded-lg hover:bg-sidebar-hover text-sidebar-fg hover:text-danger-fg transition-colors cursor-pointer"
                title="Đăng xuất"
                aria-label="Đăng xuất"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer / Status bar */}
      <footer className="flex items-center justify-between px-4 h-8 bg-surface/90 backdrop-blur-xs border-t border-border text-[11px] text-text-muted shrink-0 z-10">
        <span className="font-medium">© 2026 Quản Lý Thu Chi</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-text-disabled">{APP_VERSION_LABEL}</span>
        </div>
      </footer>

      {/* Floating Action AI Button */}
      <button
        type="button"
        onClick={toggleFab}
        className="fixed z-50 flex items-center justify-center size-13 rounded-full shadow-xl shadow-teal-700/30 bg-gradient-to-tr from-teal-600 via-emerald-600 to-teal-400 hover:from-teal-500 hover:to-emerald-400 text-white transition-all duration-200 hover:scale-105 active:scale-95 right-5 md:right-7 bottom-[calc(var(--dimens-statusBarHeight)+0.5rem)] ring-2 ring-white/25 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-fg"
        aria-label="Mở Trợ lý AI Thông Minh"
        title="Trợ lý AI"
      >
        <Bot size={22} className="stroke-[2.2]" />
      </button>

      {enableWebLLM && !webLLMDone && (
        <div
          className="fixed z-50 flex items-center gap-2.5 rounded-full border border-border bg-surface/95 px-3.5 py-1.5 shadow-lg backdrop-blur right-5 md:right-7 bottom-[calc(var(--dimens-statusBarHeight)+4.25rem)]"
          title={`Đang tải AI cục bộ… ${Math.round(webLLMProgress)}%`}
        >
          <Bot size={14} className="text-accent-fg shrink-0" />
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-accent-fg transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, webLLMProgress))}%` }} />
          </div>
          <span className="text-[10px] font-mono font-medium text-text-muted tabular-nums">{Math.round(webLLMProgress)}%</span>
        </div>
      )}

      <MascotOverlay />

      {(fabOpen || chatClosing) && (
        <div className={`fixed z-50 right-4 md:right-7 w-[calc(100vw-2rem)] max-w-[420px] h-[540px] max-h-[calc(100vh-8rem)] bg-surface border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden bottom-[calc(var(--dimens-statusBarHeight)+var(--dimens-fabSize)+1rem)] ${chatClosing ? 'animate-scale-out' : 'animate-scale-in'}`}>
          <ChatPanel onClose={closeChat} />
        </div>
      )}

      <CommandPalette open={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}
