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
import { bootstrapAppData } from '@/services/bootstrap';
import { webLLM } from '@/services/webLLM';
import { kiloService } from '@/services/kiloService';
import { pendingCount } from '@/services/syncOutbox';
import { flushOutbox } from '@/services/syncEngine';
import { useTheme } from '@/hooks/useTheme';

interface NavItem { label: string; route: string; tab: string; icon: ReactNode; }

const navItems: NavItem[] = [
  { label: 'Tổng quan', route: '/', tab: 'dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Chi phí', route: '/expense', tab: 'expense', icon: <Receipt size={18} /> },
  { label: 'Doanh thu', route: '/revenue', tab: 'revenue', icon: <Coins size={18} /> },
  { label: 'Khách', route: '/customers', tab: 'customers', icon: <Users size={18} /> },
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
  const logout = useAuthStore((s) => s.logout);
  const [clock, setClock] = useState('');
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline' | 'pending'>('synced');
  const [pending, setPending] = useState(0);
  const [dataReady, setDataReady] = useState(false);
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
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Quản Lý Tài Chính';
  const displayName = userProfile?.storeName ?? 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const closeChat = () => { setChatClosing(true); setTimeout(() => { setChatClosing(false); setFabOpen(false); }, 200); };

  useEffect(() => {
    let c = false;
    setSyncState(navigator.onLine ? 'syncing' : 'offline');
    bootstrapAppData().then(() => { if (!c) { setDataReady(true); setSyncState('synced'); } })
      .catch(() => { if (!c) { setDataReady(true); setSyncState('synced'); } });
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
    } catch { }
    setSyncing(false); setShowBell(false);
  };
  const isActive = (route: string) => route === '/' ? location.pathname === '/' : location.pathname.startsWith(route);
  const syncLabel = syncState === 'synced' ? 'Đã đồng bộ' : syncState === 'pending' ? `${pending} thay đổi` : 'Đang sync...';

  return (
    <div className="flex flex-col h-screen bg-background min-w-0 overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar — inline styles for smooth animation */}
        <aside
          className="hidden md:flex flex-col shrink-0 bg-sidebar-bg text-sidebar-fg border-r border-sidebar-border overflow-hidden"
          style={{ width: sidebarCollapsed ? 64 : 240, transition: 'width 0.3s ease' }}
        >
          <div className="flex items-center h-12 px-3 shrink-0 border-b border-sidebar-border overflow-hidden">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={28} height={28} className="size-7 rounded-field shrink-0 object-cover" />
            <span style={{
              opacity: sidebarCollapsed ? 0 : 1,
              maxWidth: sidebarCollapsed ? 0 : 200,
              marginLeft: sidebarCollapsed ? 0 : 12,
              transition: 'opacity 0.3s ease, max-width 0.3s ease, margin-left 0.3s ease',
            }} className="text-sm font-semibold text-sidebar-fg truncate overflow-hidden whitespace-nowrap">Quản Lý Tài Chính</span>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
            {navItems.map((item) => (
              <NavLink key={item.route} to={item.route} end={item.route === '/'}
                className={`flex items-center mb-0.5 rounded-lg transition-colors duration-150 ${isActive(item.route) ? 'bg-sidebar-active-bg text-sidebar-active-fg' : `text-sidebar-fg hover:bg-sidebar-hover`} ${sidebarCollapsed ? 'justify-center mx-0 px-0 h-10' : 'mx-2 px-3 h-10'}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                <span style={{
                  opacity: sidebarCollapsed ? 0 : 1,
                  maxWidth: sidebarCollapsed ? 0 : 160,
                  marginLeft: sidebarCollapsed ? 0 : 12,
                  transition: 'opacity 0.3s ease, max-width 0.3s ease, margin-left 0.3s ease',
                }} className="text-sm font-medium truncate overflow-hidden whitespace-nowrap">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className={`shrink-0 border-t border-sidebar-border flex items-center overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'justify-center px-0 h-12' : 'px-3 h-12'}`}>
            {sidebarCollapsed ? (
              <button type="button" onClick={() => logout()} className="p-1.5 rounded-lg hover:bg-sidebar-hover text-sidebar-fg hover:text-accent-fg transition-colors"><LogOut size={16} /></button>
            ) : (
              <div className="flex items-center gap-2 min-w-0 w-full">
                <div className="size-7 rounded-full bg-sidebar-active-bg text-white flex items-center justify-center text-xs font-semibold shrink-0">{avatarLetter}</div>
                <span className="text-xs text-sidebar-fg truncate flex-1 min-w-0">{displayName}</span>
                <button type="button" onClick={() => logout()} className="p-1 rounded hover:bg-sidebar-hover text-sidebar-fg hover:text-accent-fg transition-colors shrink-0"><LogOut size={15} /></button>
              </div>
            )}
          </div>
        </aside>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex shrink-0 items-center gap-3 px-4 h-12 bg-surface border-b border-border z-20">
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1.5 rounded-md hover:bg-surface-hover text-text-muted"><Menu size={18} /></button>
            <button type="button" onClick={toggleSidebar} className="hidden md:block p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors shrink-0">
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <h1 className="text-sm font-semibold text-text-primary truncate flex-1">{pageTitle}</h1>
            <button type="button" onClick={() => setShowSearch(true)}
              className="hidden lg:flex items-center gap-2 bg-background border border-border rounded-md px-3 py-1.5 text-xs text-text-muted w-56 hover:border-accent-fg transition-colors">
              <Search size={14} /><span className="flex-1 text-left">Tìm kiếm...</span>
              <kbd className="text-[10px] font-mono bg-surface border border-border rounded px-1.5 py-0.5 text-text-disabled">⌘K</kbd>
            </button>
            <button type="button" onClick={toggleDark} className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors shrink-0">
              {mode === 'system' ? <Monitor size={18} /> : isDark ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="relative shrink-0">
              <button type="button" onClick={() => setShowBell((v) => !v)}
                className="relative p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 rounded-full bg-accent-fg text-white text-[10px] font-bold flex items-center justify-center border-2 border-surface">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showBell && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowBell(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 w-80 bg-surface border border-border rounded-xl shadow-xl animate-scale-in max-h-[70vh] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border shrink-0">
                      <p className="text-sm font-semibold text-text-primary">Thông báo</p>
                      {unreadCount > 0 && (
                        <button type="button" onClick={() => markAllRead()}
                          className="text-xs text-accent-fg hover:text-accent-fg-hover transition-colors flex items-center gap-1">
                          <CheckCheck size={13} /> Đánh dấu đã đọc
                        </button>
                      )}
                    </div>

                    {/* Sync status bar */}
                    <div className="flex items-center gap-2 px-4 py-1.5 shrink-0">
                      <span className={`size-2 rounded-full ${syncState === 'synced' ? 'bg-success-fg' : syncState === 'offline' ? 'bg-text-disabled' : 'bg-warning-fg animate-pulse'}`} />
                      <span className="text-xs text-text-secondary">{syncLabel}</span>
                    </div>

                    {/* Notification list */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {notifications.length === 0 ? (
                        <div className="flex items-center justify-center py-8 text-xs text-text-muted">
                          Chưa có thông báo
                        </div>
                      ) : (
                        <div className="py-1">
                          {visibleNotifications.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => markRead(item.id)}
                              className={`w-full text-left px-4 py-2.5 border-b border-border/50 last:border-b-0 transition-colors hover:bg-surface-hover ${!item.read ? 'bg-surface-hover/50' : ''}`}
                            >
                              <div className="flex items-start gap-2.5">
                                <span className={`mt-0.5 shrink-0 ${item.type === 'error' ? 'text-error-fg' : item.type === 'sync' ? 'text-success-fg' : item.type === 'import' ? 'text-accent-fg' : item.type === 'ai' ? 'text-info-fg' : 'text-warning-fg'}`}>
                                  {NOTIFICATION_ICON[item.type]}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-text-primary truncate">{item.title}</p>
                                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{item.message}</p>
                                  <p className="text-[10px] text-text-muted mt-1">{formatRelativeTime(item.timestamp)}</p>
                                </div>
                                {!item.read && (
                                  <span className="mt-1.5 size-2 rounded-full bg-accent-fg shrink-0" />
                                )}
                              </div>
                            </button>
                          ))}
                          {notifications.length > 8 && (
                            <p className="text-center text-[10px] text-text-muted py-1.5">
                              +{notifications.length - 8} thông báo trước đó
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sync button */}
                    {pending > 0 && (
                      <div className="px-4 py-2 border-t border-border shrink-0">
                        <button type="button" onClick={handleSync} disabled={syncing}
                          className="w-full flex items-center justify-center gap-2 text-xs bg-accent-fg text-white rounded-lg px-3 py-2 hover:bg-accent-fg-hover transition-colors">
                          {syncing ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />} Đồng bộ ngay
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <span className="text-xs text-text-muted tabular-nums shrink-0 w-12 text-right">{clock || '--:--'}</span>
          </header>
          <main className="flex-1 overflow-y-auto min-h-0">
            <div key={location.pathname} className="animate-fade-in-up max-w-6xl mx-auto w-full p-[var(--s-md)] md:p-[var(--s-xl)] min-w-0 pb-[calc(var(--dimens-fabClearance)+0.5rem)]">
              <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="flex gap-1.5">{ [0,1,2].map(i => <div key={i} className="size-2 rounded-full bg-accent-fg animate-pulse" style={{animationDelay:`${i*0.2}s`}} />) }</div></div>}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
      {(mobileMenuOpen || menuClosing) && (
        <div className="md:hidden">
            <div className="fixed inset-0 z-50 bg-black/30 animate-fade-in" onClick={closeMobileMenu} />
            <div className={`fixed inset-y-0 left-0 z-50 w-60 bg-sidebar-bg border-r border-sidebar-border shadow-xl flex flex-col ${menuClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}>
              <div className="flex items-center justify-between h-12 px-3 shrink-0 border-b border-sidebar-border">
                <span className="text-sm font-semibold text-sidebar-fg">Quản Lý Tài Chính</span>
                <button type="button" onClick={closeMobileMenu} className="p-1 rounded hover:bg-sidebar-hover text-sidebar-fg"><X size={16} /></button>
              </div>
              <nav className="flex-1 overflow-y-auto py-2">
                {navItems.map((item) => (
                  <NavLink key={item.route} to={item.route} end={item.route === '/'}
                    onClick={closeMobileMenu}
                    className={`flex items-center gap-3 mx-2 px-3 h-10 rounded-lg text-sm transition-colors ${isActive(item.route) ? 'bg-sidebar-active-bg text-sidebar-active-fg' : 'text-sidebar-fg hover:bg-sidebar-hover'}`}>
                    {item.icon}<span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              <div className="shrink-0 border-t border-sidebar-border px-3 py-3 flex items-center gap-2">
                <div className="size-7 rounded-full bg-sidebar-active-bg text-white flex items-center justify-center text-xs font-semibold shrink-0">{avatarLetter}</div>
                <span className="text-xs text-sidebar-fg truncate flex-1">{displayName}</span>
                <button type="button" onClick={() => { closeMobileMenu(); logout(); }} className="p-1 rounded hover:bg-sidebar-hover text-sidebar-fg hover:text-accent-fg transition-colors"><LogOut size={15} /></button>
              </div>
            </div>
          </div>
        )}
      <div className="flex items-center justify-between px-[var(--s-md)] h-8 bg-surface border-t border-border text-[10px] text-text-muted shrink-0">
        <span>© 2026 Quản Lý Tài Chính</span><span>v1.3.0</span>
      </div>
      <button type="button" onClick={toggleFab}
        className="fixed z-40 flex items-center justify-center size-12 rounded-full shadow-xl bg-accent-fg hover:bg-accent-fg-hover text-white transition-all duration-150 hover:scale-110 bottom-20 right-4 md:bottom-4 md:right-6"
        aria-label="Toggle AI chat"><Bot size={20} /></button>
      <MascotOverlay />
      {(fabOpen || chatClosing) && (
        <>
          <div className="fixed inset-0 z-50" onClick={closeChat} />
          <div className={`fixed z-50 bottom-20 right-4 md:bottom-16 md:right-6 w-[calc(100vw-2rem)] max-w-[400px] h-[520px] max-h-[calc(100vh-8rem)] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${chatClosing ? 'animate-scale-out' : 'animate-scale-in'}`}>
            <ChatPanel />
          </div>
        </>
      )}
      <CommandPalette open={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}
