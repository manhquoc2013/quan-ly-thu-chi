/**
 * Cloud user_settings — AI keys/toggles synced per auth.uid().
 */

import { groqService } from './groqService';
import { kiloService } from './kiloService';
import { openRouterService } from './openRouterService';
import { siliconFlowService } from './siliconFlowService';
import { webLLM } from './webLLM';
import { AI_PRIORITY_DEFAULT, mergeAiPriority, type LlmSource } from './llmTypes';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { useMascotStore } from '@/store/mascotStore';
import { enqueueOutbox } from './syncOutbox';

export interface UserSettingsRow {
  user_id: string;
  gemini_api_key: string | null;
  groq_api_key: string | null;
  openrouter_api_key: string | null;
  siliconflow_api_key: string | null;
  kilo_api_key: string | null;
  enable_web_llm: boolean;
  enable_kilo_free: boolean;
  enable_groq: boolean;
  enable_openrouter: boolean;
  enable_siliconflow: boolean;
  ai_priority: string[];
  mascot_activity: string;
  updated_at: string;
}

function parseAiPriority(raw: unknown): LlmSource[] {
  const allowed = new Set<LlmSource>(['kilo', 'openrouter', 'siliconflow', 'groq', 'gemini', 'local']);
  if (!Array.isArray(raw) || raw.length === 0) return [...AI_PRIORITY_DEFAULT];
  const mapped = raw
    .map((v) => (v === 'webllm' ? 'local' : v))
    .filter((v): v is LlmSource => typeof v === 'string' && allowed.has(v as LlmSource));
  return mergeAiPriority(mapped);
}

export async function fetchUserSettings(): Promise<UserSettingsRow | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase().from('user_settings').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as UserSettingsRow;
  return {
    ...row,
    ai_priority: parseAiPriority(row.ai_priority),
  };
}

export async function upsertUserSettings(
  patch: Partial<UserSettingsRow> & { user_id: string },
): Promise<void> {
  const { error } = await getSupabase()
    .from('user_settings')
    .upsert(
      {
        user_id: patch.user_id,
        gemini_api_key: patch.gemini_api_key ?? null,
        groq_api_key: patch.groq_api_key ?? null,
        kilo_api_key: patch.kilo_api_key ?? null,
        openrouter_api_key: patch.openrouter_api_key ?? null,
        siliconflow_api_key: patch.siliconflow_api_key ?? null,
        enable_web_llm: patch.enable_web_llm ?? true,
        enable_kilo_free: patch.enable_kilo_free ?? true,
        enable_groq: patch.enable_groq ?? true,
        enable_openrouter: patch.enable_openrouter ?? true,
        enable_siliconflow: patch.enable_siliconflow ?? true,
        ai_priority: patch.ai_priority ?? AI_PRIORITY_DEFAULT,
      },
      { onConflict: 'user_id' },
    );
  if (error) {
    console.error('[user_settings] upsert failed', error.code, error.message, error.details);
    throw new Error(error.message);
  }
}

export function applyUserSettingsToStore(row: UserSettingsRow): void {
  const priority = parseAiPriority(row.ai_priority);
  const store = useAuthStore.getState();
  store.setGeminiApiKey(row.gemini_api_key);
  store.setGroqApiKey(row.groq_api_key);
  store.setOpenRouterApiKey(row.openrouter_api_key);
  store.setSiliconFlowApiKey(row.siliconflow_api_key);
  store.setKiloApiKey(row.kilo_api_key);
  store.setEnableWebLLM(row.enable_web_llm !== false);
  store.setEnableKiloFree(row.enable_kilo_free !== false);
  store.setEnableGroq(row.enable_groq !== false);
  store.setEnableOpenRouter(row.enable_openrouter !== false);
  store.setEnableSiliconFlow(row.enable_siliconflow !== false);
  store.setAiPriority(priority);
  // Mascot activity
  useMascotStore.getState().setActivity((row.mascot_activity as 'low' | 'medium' | 'high') || 'medium');
  webLLM.setDisabled(row.enable_web_llm === false);
  groqService.setEnabled(row.enable_groq !== false);
  kiloService.setEnabled(row.enable_kilo_free !== false);
  openRouterService.setEnabled(row.enable_openrouter !== false);
  siliconFlowService.setEnabled(row.enable_siliconflow !== false);
}

export function settingsRowFromStore(userId: string): Omit<UserSettingsRow, 'updated_at'> {
  const s = useAuthStore.getState();
  return {
    user_id: userId,
    gemini_api_key: s.geminiApiKey,
    groq_api_key: s.groqApiKey,
    openrouter_api_key: s.openRouterApiKey,
    siliconflow_api_key: s.siliconFlowApiKey,
    kilo_api_key: s.kiloApiKey,
    enable_web_llm: s.enableWebLLM !== false,
    enable_kilo_free: s.enableKiloFree !== false,
    enable_groq: s.enableGroq !== false,
    enable_openrouter: s.enableOpenRouter !== false,
    enable_siliconflow: s.enableSiliconFlow !== false,
    ai_priority: s.aiPriority?.length ? s.aiPriority : AI_PRIORITY_DEFAULT,
    mascot_activity: (() => { try { return useMascotStore.getState().activity; } catch { return 'medium'; } })(),
  };
}

export function queueUserSettingsSync(): void {
  const userId = useAuthStore.getState().userId;
  if (!userId) return;
  const payload = settingsRowFromStore(userId);
  enqueueOutbox({
    userId,
    entity: 'user_settings',
    entityId: userId,
    op: 'upsert',
    payload: { ...payload },
    mutatedAt: new Date().toISOString(),
  });
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void import('./syncEngine').then((m) => m.flushOutbox(userId));
  }
}

export function queueProfileSync(patch: {
  store_name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
}): void {
  const userId = useAuthStore.getState().userId;
  if (!userId) return;
  enqueueOutbox({
    userId,
    entity: 'profiles',
    entityId: userId,
    op: 'upsert',
    payload: { user_id: userId, ...patch },
    mutatedAt: new Date().toISOString(),
  });
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void import('./syncEngine').then((m) => m.flushOutbox(userId));
  }
}
