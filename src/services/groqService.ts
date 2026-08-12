/**
 * Groq Service — Cloud AI via Groq's OpenAI-compatible API.
 *
 * Lists chat models from Groq `/models`, then tries free/available IDs in
 * task order (extract → larger; chat → instant). 429/404 hops to next.
 * Docs: https://console.groq.com/docs
 */

import {
  GROQ_CHAT_SEED,
  buildGroqTaskModels,
  resolveGroqChatModels,
} from './freeModelCatalog';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const REQUEST_TIMEOUT_MS = 45_000;

let apiKey: string | null = null;
let enabled = true;
let configured = false;
let lastModel: string = GROQ_CHAT_SEED[0];

const envKey = (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim();
if (envKey) {
  apiKey = envKey;
  configured = true;
}

type GenerateResult =
  | { ok: true; text: string; model: string }
  | { ok: false; detail: string };

async function modelsForRequest(
  task: 'extract' | 'chat',
  forceRefresh = false,
): Promise<string[]> {
  const live = await resolveGroqChatModels(apiKey ?? '', { forceRefresh });
  const ordered = buildGroqTaskModels(live, task);
  if (lastModel && ordered.includes(lastModel)) {
    return [lastModel, ...ordered.filter((id) => id !== lastModel)];
  }
  return ordered;
}

async function requestModel(
  modelId: string,
  prompt: string,
): Promise<{ text: string | null; error?: string; fatal?: boolean }> {
  if (!apiKey) return { text: null, error: 'Chưa có API key', fatal: true };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
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

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const fatal = res.status === 401 || res.status === 403;
      console.warn(`Groq HTTP ${res.status} (${modelId}):`, body.slice(0, 200));
      return {
        text: null,
        error: res.status === 429 ? 'Rate limit' : `HTTP ${res.status}`,
        fatal,
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      error?: { message?: string };
    };
    if (data.error?.message) {
      return { text: null, error: data.error.message };
    }
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    return { text: text || null };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { text: null, error: 'Timeout' };
    }
    return { text: null, error: 'Network' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const groqService = {
  get isConfigured(): boolean {
    return configured;
  },

  get isEnabled(): boolean {
    return enabled;
  },

  get model(): string {
    return lastModel;
  },

  setEnabled(v: boolean): void {
    enabled = v;
  },

  configure(key: string): void {
    const trimmed = key.trim();
    if (trimmed) {
      apiKey = trimmed;
      configured = true;
      void resolveGroqChatModels(trimmed, { forceRefresh: true });
    }
  },

  disconnect(): void {
    apiKey = null;
    configured = false;
  },

  async generateContent(
    prompt: string,
    opts?: { task?: 'extract' | 'chat' },
  ): Promise<string | null> {
    const result = await this.generateWithDetail(prompt, opts?.task ?? 'chat');
    return result.ok ? result.text : null;
  },

  async generateWithDetail(
    prompt: string,
    task: 'extract' | 'chat' = 'chat',
  ): Promise<GenerateResult> {
    if (!configured || !enabled || !navigator.onLine || !apiKey) {
      return { ok: false, detail: 'Chưa cấu hình hoặc offline' };
    }

    const first = await modelsForRequest(task, false);
    const errors: string[] = [];
    for (const modelId of first) {
      const { text, error, fatal } = await requestModel(modelId, prompt);
      if (text) {
        lastModel = modelId;
        return { ok: true, text, model: modelId };
      }
      if (error) errors.push(`${modelId}: ${error}`);
      if (fatal) return { ok: false, detail: error ?? 'Không kết nối được Groq' };
    }

    const refreshed = await modelsForRequest(task, true);
    if (refreshed.join('|') !== first.join('|')) {
      for (const modelId of refreshed) {
        const { text, error, fatal } = await requestModel(modelId, prompt);
        if (text) {
          lastModel = modelId;
          return { ok: true, text, model: modelId };
        }
        if (error) errors.push(`${modelId}: ${error}`);
        if (fatal) return { ok: false, detail: error ?? 'Không kết nối được Groq' };
      }
    }

    return { ok: false, detail: errors[0] ?? 'Không kết nối được Groq' };
  },

  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    if (!apiKey) return { ok: false, detail: 'Chưa có API key' };
    if (!navigator.onLine) return { ok: false, detail: 'Offline — cần mạng cho Groq' };

    await modelsForRequest('chat', true);
    const result = await this.generateWithDetail('Trả lời đúng một từ: OK', 'chat');
    if (!result.ok) {
      return {
        ok: false,
        detail: result.detail || 'Không kết nối được Groq (mạng, rate limit, hoặc key sai)',
      };
    }
    return { ok: true, detail: `${result.text.slice(0, 40)} · ${result.model}` };
  },
};
