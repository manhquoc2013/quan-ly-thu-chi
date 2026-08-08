/**
 * Realtime sync — Supabase Realtime subscriptions for multi-browser sync.
 *
 * Subscribes to postgres_changes on expenses and revenues tables.
 * When another browser/client creates/updates/deletes a record,
 * this client auto-refreshes and shows a toast notification.
 */

import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { getAllExpenses } from './expenseService';
import { getAllRevenues } from './revenueService';
import { notify } from '@/utils/notify';
import { useNotificationStore } from '@/store/notificationStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

const activeChannels: RealtimeChannel[] = [];

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

            if (table === 'expenses') {
              getAllExpenses().catch(() => {});
            } else {
              getAllRevenues().catch(() => {});
            }
          },
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[realtime] Subscribed to ${table} changes`);
          }
        });

      activeChannels.push(channel);
    }
  } catch (err) {
    console.warn('[realtime] Failed to start realtime sync:', err);
  }
}

export function stopRealtimeSync(): void {
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
  // Supabase v2: channel.unsubscribe() returns the channel
  (channel as { unsubscribe?: () => void }).unsubscribe?.();
}
