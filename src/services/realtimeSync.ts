/**
 * Realtime sync — Supabase Realtime subscriptions for multi-browser sync.
 *
 * Subscribes to postgres_changes on expenses and revenues tables.
 * When another browser/client creates/updates/deletes a record,
 * this client auto-refreshes and shows a toast notification.
 */

import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { notifyListInvalidated } from './listQuery';
import { notify } from '@/utils/notify';
import { useNotificationStore } from '@/store/notificationStore';
import { getActiveHouseholdId, hydrateStoresFromCloud, isCloudSyncActive } from './cloudSync';
import type { RealtimeChannel } from '@supabase/supabase-js';

const activeChannels: RealtimeChannel[] = [];
let hydrateTimer: ReturnType<typeof setTimeout> | null = null;
let pendingTables = new Set<'expenses' | 'revenues'>();

function tableLabel(table: string): string {
  return table === 'expenses' ? 'chi phí' : 'đơn hàng';
}

function changeVerb(event: string): string {
  switch (event) {
    case 'INSERT': return 'thêm mới';
    case 'UPDATE': return 'cập nhật';
    case 'DELETE': return 'xóa';
    default: return 'thay đổi';
  }
}

async function refreshFromRemote(tables: Set<'expenses' | 'revenues'>): Promise<void> {
  if (isCloudSyncActive()) {
    const hid = getActiveHouseholdId();
    if (hid) {
      await hydrateStoresFromCloud(hid);
      for (const table of tables) notifyListInvalidated(table);
      return;
    }
  }
  if (tables.has('expenses')) {
    const { getAllExpenses } = await import('./expenseService');
    await getAllExpenses();
    notifyListInvalidated('expenses');
  }
  if (tables.has('revenues')) {
    const { getAllRevenues } = await import('./revenueService');
    await getAllRevenues();
    notifyListInvalidated('revenues');
  }
}

function scheduleRefresh(table: 'expenses' | 'revenues'): void {
  pendingTables.add(table);
  if (hydrateTimer) clearTimeout(hydrateTimer);
  hydrateTimer = setTimeout(() => {
    const batch = pendingTables;
    pendingTables = new Set();
    hydrateTimer = null;
    void refreshFromRemote(batch).catch(() => {});
  }, 600);
}

export function startRealtimeSync(): void {
  if (!isSupabaseConfigured()) return;
  if (activeChannels.length > 0) return; // Already started

  try {
    const supabase = getSupabase();

    for (const table of ['expenses', 'revenues'] as const) {
      const channel = supabase
        .channel(`realtime-${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            const verb = changeVerb(payload.eventType);
            const label = tableLabel(table);
            const msg = `Có ${verb} ${label} từ thiết bị khác — đang đồng bộ...`;
            notify.message(msg);
            useNotificationStore.getState().addNotification('realtime', 'Đồng bộ thời gian thực', msg);
            scheduleRefresh(table);
          },
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.warn(`[realtime] Subscribed to ${table} changes`);
          }
        });

      activeChannels.push(channel);
    }
  } catch (err) {
    console.warn('[realtime] Failed to start realtime sync:', err);
  }
}

export function stopRealtimeSync(): void {
  if (hydrateTimer) {
    clearTimeout(hydrateTimer);
    hydrateTimer = null;
  }
  pendingTables = new Set();
  for (const ch of activeChannels) {
    try {
      supabaseRemoveChannel(ch);
    } catch {
      // ignore
    }
  }
  activeChannels.length = 0;
}

function supabaseRemoveChannel(channel: RealtimeChannel): void {
  (channel as { unsubscribe?: () => void }).unsubscribe?.();
}
