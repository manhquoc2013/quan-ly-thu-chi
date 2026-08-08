/**
 * Flush local outbox to Supabase; re-run on online / visibility / interval.
 */

import {
  clearOutbox,
  listOutbox,
  pendingCount,
  removeOutbox,
  updateOutboxError,
} from './syncOutbox';
import { upsertProfile } from './profileService';
import { upsertUserSettings } from './userSettingsService';
import { isSupabaseConfigured } from './supabaseClient';
import { useAuthStore } from '@/store/authStore';

export async function flushOutbox(
  userId: string,
): Promise<{ flushed: number; failed: number }> {
  if (!isSupabaseConfigured() || !navigator.onLine) {
    return { flushed: 0, failed: 0 };
  }

  let flushed = 0;
  let failed = 0;
  const items = listOutbox(userId);

  for (const item of items) {
    try {
      if (item.entity === 'profiles' && item.op === 'upsert') {
        await upsertProfile({
          user_id: userId,
          store_name: String(item.payload.store_name ?? ''),
          phone: (item.payload.phone as string | null) ?? null,
          address: (item.payload.address as string | null) ?? null,
          email: (item.payload.email as string | null) ?? null,
        });
      } else if (item.entity === 'user_settings' && item.op === 'upsert') {
        await upsertUserSettings({
          user_id: userId,
          gemini_api_key: (item.payload.gemini_api_key as string | null) ?? null,
          groq_api_key: (item.payload.groq_api_key as string | null) ?? null,
          kilo_api_key: (item.payload.kilo_api_key as string | null) ?? null,
          openrouter_api_key: (item.payload.openrouter_api_key as string | null) ?? null,
          siliconflow_api_key: (item.payload.siliconflow_api_key as string | null) ?? null,
          enable_web_llm: item.payload.enable_web_llm !== false,
          enable_kilo_free: item.payload.enable_kilo_free !== false,
          enable_groq: item.payload.enable_groq !== false,
          enable_openrouter: item.payload.enable_openrouter !== false,
          enable_siliconflow: item.payload.enable_siliconflow !== false,
          ai_priority: Array.isArray(item.payload.ai_priority)
            ? (item.payload.ai_priority as string[])
            : undefined,
        });
      }
      removeOutbox(item.id);
      flushed += 1;
    } catch (err) {
      failed += 1;
      updateOutboxError(item.id, err instanceof Error ? err.message : String(err));
    }
  }

  return { flushed, failed };
}

export function startSyncEngine(): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    const userId = useAuthStore.getState().userId;
    if (!userId || !navigator.onLine) return;
    if (pendingCount(userId) === 0) return;
    void flushOutbox(userId);
  };

  const onOnline = () => tick();
  const onVisibility = () => {
    if (document.visibilityState === 'visible') tick();
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);
  timer = setInterval(tick, 30_000);

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibility);
    if (timer) clearInterval(timer);
  };
}

export { clearOutbox, pendingCount };
