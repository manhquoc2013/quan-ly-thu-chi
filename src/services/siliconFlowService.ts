/**
 * SiliconFlow Service — Cloud AI via SiliconFlow's OpenAI-compatible API.
 *
 * Free chat models are resolved dynamically from `/models?sub_type=chat`
 * (heuristic + seed intersect live list), with TTL cache and .com/.cn hosts.
 */

import {
  SILICONFLOW_FREE_SEED,
  resolveSiliconFlowFreeModels,
} from './freeModelCatalog';
import { sanitizeApiKey, validateApiKey } from '@/utils/apiKey';

const SILICONFLOW_BASES = [
  'https://api.siliconflow.com/v1',
  'https://api.siliconflow.cn/v1',
] as const;

const REQUEST_TIMEOUT_MS = 45_000;

let apiKey: string | null = null;
let enabled = true;
let configured = false;
let preferredBase: (typeof SILICONFLOW_BASES)[number] | null = null;
let lastModels: string[] = [...SILICONFLOW_FREE_SEED];

const envKey = sanitizeApiKey(import.meta.env.VITE_SILICONFLOW_API_KEY as string | undefined ?? '');
if (envKey) {
  apiKey = envKey;
  configured = true;
}

type GenerateResult =
  | { ok: true; text: string; model: string }
  | { ok: false; detail: string };

function summarizeHttpError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      message?: string;
      error?: { message?: string } | string;
      code?: number | string;
    };
    const msg =
      (typeof parsed.error === 'string' ? parsed.error : parsed.error?.message)?.trim() ||
      parsed.message?.trim();
    if (msg) return msg.slice(0, 160);
  } catch {
    // ignore
  }
  if (status === 401 || status === 403) return 'API key không hợp lệ hoặc bị từ chối';
  if (status === 402) return 'Hết hạn mức / cần nạp credit SiliconFlow';
  if (status === 429) return 'Rate limit — thử lại sau';
  if (status === 404) return 'Model không tồn tại hoặc đã gỡ';
  const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 120);
  return snippet || `HTTP ${status}`;
}

function basesToTry(): readonly string[] {
  if (!preferredBase) return SILICONFLOW_BASES;
  return [preferredBase, ...SILICONFLOW_BASES.filter((b) => b !== preferredBase)];
}

async function requestModel(
  base: string,
  modelId: string,
  prompt: string,
): Promise<{ text: string | null; error?: string; networkFail?: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
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
      console.warn(`SiliconFlow HTTP ${res.status} (${modelId} @ ${base}):`, body.slice(0, 200));
      return { text: null, error: detail };
    }

    const data = JSON.parse(body || '{}') as {
      choices?: Array<{ message?: { content?: string | null } }>;
      error?: { message?: string } | string;
      message?: string;
    };

    const errMsg =
      (typeof data.error === 'string' ? data.error : data.error?.message) || data.message;
    if (errMsg) {
      console.warn(`SiliconFlow API error (${modelId}):`, errMsg);
      return { text: null, error: String(errMsg).slice(0, 160) };
    }

    const text = data.choices?.[0]?.message?.content?.trim() || '';
    return { text: text || null, error: text ? undefined : 'Phản hồi trống' };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      console.warn(`SiliconFlow request timeout (${modelId} @ ${base})`);
      return { text: null, error: 'Timeout', networkFail: true };
    }
    console.warn(`SiliconFlow request failed (${modelId} @ ${base}):`, err);
    return {
      text: null,
      error: err instanceof Error ? err.message : 'Lỗi mạng',
      networkFail: true,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function modelsForRequest(forceRefresh = false): Promise<string[]> {
  if (!apiKey) return [...SILICONFLOW_FREE_SEED];
  const models = await resolveSiliconFlowFreeModels(apiKey, basesToTry(), { forceRefresh });
  lastModels = models;
  return models;
}

export const siliconFlowService = {
  get isConfigured(): boolean {
    return configured;
  },

  get isEnabled(): boolean {
    return enabled;
  },

  get model(): string {
    return lastModels[0] ?? SILICONFLOW_FREE_SEED[0];
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
    preferredBase = null;
  },

  async generateContent(prompt: string): Promise<string | null> {
    const result = await this.generateWithDetail(prompt);
    return result.ok ? result.text : null;
  },

  async generateWithDetail(prompt: string): Promise<GenerateResult> {
    if (!configured || !enabled || !navigator.onLine || !apiKey) {
      return { ok: false, detail: 'Chưa cấu hình hoặc offline' };
    }

    const models = await modelsForRequest(false);
    const errors: string[] = [];

    const tryModels = async (list: string[]) => {
      for (const modelId of list) {
        for (const base of basesToTry()) {
          const { text, error, networkFail } = await requestModel(base, modelId, prompt);
          if (text) {
            preferredBase = base as (typeof SILICONFLOW_BASES)[number];
            return { ok: true as const, text, model: modelId };
          }
          if (error) errors.push(`${modelId}: ${error}`);
          if (!networkFail) break;
        }
      }
      return null;
    };

    const first = await tryModels(models);
    if (first) return first;

    const refreshed = await modelsForRequest(true);
    if (refreshed.join('|') !== models.join('|')) {
      const second = await tryModels(refreshed);
      if (second) return second;
    }

    return {
      ok: false,
      detail: errors[0] ?? 'Không kết nối được SiliconFlow',
    };
  },

  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    if (!apiKey) return { ok: false, detail: 'Chưa có API key' };
    if (!navigator.onLine) return { ok: false, detail: 'Offline — cần mạng cho SiliconFlow' };

    await modelsForRequest(true);
    const result = await this.generateWithDetail('Trả lời đúng một từ: OK');
    if (!result.ok) return { ok: false, detail: result.detail };
    return { ok: true, detail: `${result.text.slice(0, 40)} · ${result.model}` };
  },
};
