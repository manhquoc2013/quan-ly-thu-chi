/**
 * OpenRouter Service — Cloud AI via OpenRouter's OpenAI-compatible API.
 *
 * Free models are resolved dynamically from OpenRouter `/models` (zero-price
 * text→text) with TTL cache + seed fallback. Docs: https://openrouter.ai/docs
 */

import {
  OPENROUTER_FREE_SEED,
  resolveOpenRouterFreeModels,
} from './freeModelCatalog';
import { sanitizeApiKey, validateApiKey } from '@/utils/apiKey';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const REQUEST_TIMEOUT_MS = 45_000;

let apiKey: string | null = null;
let enabled = true;
let configured = false;
let lastModels: string[] = [...OPENROUTER_FREE_SEED];

const envKey = sanitizeApiKey(import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined ?? '');
if (envKey) {
  apiKey = envKey;
  configured = true;
}

type GenerateResult =
  | { ok: true; text: string; model: string }
  | { ok: false; detail: string };

function authHeaders(): Record<string, string> {
  // Header values must be ISO-8859-1 — ASCII only.
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
    'X-Title': 'Quan Ly Thu Chi',
    'X-OpenRouter-Title': 'Quan Ly Thu Chi',
  };
}

function summarizeHttpError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; code?: number | string } };
    const msg = parsed.error?.message?.trim();
    if (msg) return msg.slice(0, 160);
  } catch {
    // ignore
  }
  if (status === 401 || status === 403) return 'API key không hợp lệ hoặc bị từ chối';
  if (status === 402) return 'Hết hạn mức / cần nạp credit OpenRouter';
  if (status === 429) return 'Rate limit — thử lại sau';
  if (status === 404) return 'Model không tồn tại hoặc đã gỡ';
  if (status === 431) {
    return 'Header quá lớn (431) — API key bị dán thừa/quá dài. Xóa key, dán lại đúng sk-or-v1-… từ OpenRouter Keys.';
  }
  const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 120);
  return snippet || `HTTP ${status}`;
}

async function requestModel(
  modelId: string,
  prompt: string,
): Promise<{ text: string | null; error?: string; fatal?: boolean }> {
  if (!apiKey) return { text: null, error: 'Chưa có API key', fatal: true };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      credentials: 'omit',
      headers: authHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        model: modelId,
        temperature: 0.2,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const body = await res.text().catch(() => '');
    if (!res.ok) {
      const detail = summarizeHttpError(res.status, body);
      console.warn(`OpenRouter HTTP ${res.status} (${modelId}):`, body.slice(0, 200));
      // 431 / auth issues fail the same for every model — stop cascade
      const fatal = res.status === 431 || res.status === 401 || res.status === 403;
      return { text: null, error: detail, fatal };
    }

    const data = JSON.parse(body || '{}') as {
      choices?: Array<{ message?: { content?: string | null } }>;
      error?: { message?: string };
    };

    if (data.error?.message) {
      console.warn(`OpenRouter API error (${modelId}):`, data.error.message);
      return { text: null, error: data.error.message.slice(0, 160) };
    }

    const text = data.choices?.[0]?.message?.content?.trim() || '';
    return { text: text || null, error: text ? undefined : 'Phản hồi trống' };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      console.warn(`OpenRouter request timeout (${modelId})`);
      return { text: null, error: 'Timeout' };
    }
    console.warn(`OpenRouter request failed (${modelId}):`, err);
    const msg = err instanceof Error ? err.message : 'Lỗi mạng';
    // Browser maps 431 → Failed to fetch + CORS noise; treat as fatal
    const fatal =
      /Failed to fetch|NetworkError|ISO-8859-1|header/i.test(msg) ||
      (typeof apiKey === 'string' && apiKey.length > 200);
    return {
      text: null,
      error: fatal
        ? 'Không gọi được OpenRouter (thường do API key quá dài / header 431). Xóa key rồi dán lại đúng sk-or-v1-… từ https://openrouter.ai/keys'
        : msg,
      fatal,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function modelsForRequest(forceRefresh = false): Promise<string[]> {
  const models = await resolveOpenRouterFreeModels({ forceRefresh });
  lastModels = models;
  return models;
}

export const openRouterService = {
  get isConfigured(): boolean {
    return configured;
  },

  get isEnabled(): boolean {
    return enabled;
  },

  get model(): string {
    return lastModels[0] ?? OPENROUTER_FREE_SEED[0];
  },

  setEnabled(v: boolean): void {
    enabled = v;
  },

  configure(key: string): void {
    const parsed = validateApiKey(key);
    if (!parsed.ok) {
      apiKey = null;
      configured = false;
      return;
    }
    apiKey = parsed.key;
    configured = true;
    void modelsForRequest(true);
  },

  disconnect(): void {
    apiKey = null;
    configured = false;
  },

  async generateContent(prompt: string): Promise<string | null> {
    const result = await this.generateWithDetail(prompt);
    return result.ok ? result.text : null;
  },

  async generateWithDetail(prompt: string): Promise<GenerateResult> {
    if (!configured || !enabled || !navigator.onLine || !apiKey) {
      return { ok: false, detail: 'Chưa cấu hình hoặc offline' };
    }

    const keyCheck = validateApiKey(apiKey);
    if (!keyCheck.ok) return { ok: false, detail: keyCheck.detail };

    const models = await modelsForRequest(false);
    const errors: string[] = [];
    for (const modelId of models) {
      const { text, error, fatal } = await requestModel(modelId, prompt);
      if (text) return { ok: true, text, model: modelId };
      if (error) errors.push(`${modelId}: ${error}`);
      if (fatal) {
        return { ok: false, detail: error ?? 'Không kết nối được OpenRouter' };
      }
    }

    // Stale catalog — force refresh once and retry
    const refreshed = await modelsForRequest(true);
    if (refreshed.join('|') !== models.join('|')) {
      for (const modelId of refreshed) {
        const { text, error, fatal } = await requestModel(modelId, prompt);
        if (text) return { ok: true, text, model: modelId };
        if (error) errors.push(`${modelId}: ${error}`);
        if (fatal) {
          return { ok: false, detail: error ?? 'Không kết nối được OpenRouter' };
        }
      }
    }

    return {
      ok: false,
      detail: errors[0] ?? 'Không kết nối được OpenRouter',
    };
  },

  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    if (!apiKey) return { ok: false, detail: 'Chưa có API key' };
    if (!navigator.onLine) return { ok: false, detail: 'Offline — cần mạng cho OpenRouter' };
    const keyCheck = validateApiKey(apiKey);
    if (!keyCheck.ok) return { ok: false, detail: keyCheck.detail };

    await modelsForRequest(true);
    const result = await this.generateWithDetail('Trả lời đúng một từ: OK');
    if (!result.ok) return { ok: false, detail: result.detail };
    return { ok: true, detail: `${result.text.slice(0, 40)} · ${result.model}` };
  },
};
