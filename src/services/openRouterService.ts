/**
 * OpenRouter Service — Cloud AI via OpenRouter's OpenAI-compatible API.
 *
 * Auto-fallbacks across 4 free models; cascade tries each on non-200/error.
 * Docs: https://openrouter.ai/docs
 *
 * OpenRouter API is OpenAI-compatible — POST /api/v1/chat/completions.
 * Free models require `:free` suffix and have per-model rate limits.
 */

const MODEL_LIST = [
  'google/gemini-2.0-flash-001:free',
  'meta-llama/llama-4-maverick:free',
  'qwen/qwen3-8b:free',
  'deepseek/deepseek-chat-v3-0324:free',
] as const;

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const REQUEST_TIMEOUT_MS = 45_000;

let apiKey: string | null = null;
let enabled = true;
let configured = false;

// Auto-configure from build-time env var (developer convenience)
const envKey = (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined)?.trim();
if (envKey) {
  apiKey = envKey;
  configured = true;
}

export const openRouterService = {
  get isConfigured(): boolean {
    return configured;
  },

  get isEnabled(): boolean {
    return enabled;
  },

  get model(): string {
    return MODEL_LIST[0];
  },

  setEnabled(v: boolean): void {
    enabled = v;
  },

  configure(key: string): void {
    const trimmed = key.trim();
    if (trimmed) {
      apiKey = trimmed;
      configured = true;
    }
  },

  disconnect(): void {
    apiKey = null;
    configured = false;
  },

  /**
   * Chat completion against OpenRouter API.
   * Iterates MODEL_LIST on any failure; returns null only if ALL models fail.
   */
  async generateContent(prompt: string): Promise<string | null> {
    if (!configured || !enabled || !navigator.onLine || !apiKey) return null;

    for (const modelId of MODEL_LIST) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Quản Lý Thu Chi',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: modelId,
            temperature: 0.2,
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.warn(`OpenRouter HTTP ${res.status} (${modelId}):`, body.slice(0, 200));
          continue; // try next model
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string | null } }>;
          model?: string;
          error?: { message?: string };
        };

        if (data.error?.message) {
          console.warn(`OpenRouter API error (${modelId}):`, data.error.message);
          continue; // try next model
        }

        const msg = data.choices?.[0]?.message as
          | { content?: string | null }
          | undefined;
        const text = msg?.content?.trim() || '';
        if (text) return text;
        // empty response — try next model
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          console.warn(`OpenRouter request timeout (${modelId})`);
        } else {
          console.warn(`OpenRouter request failed (${modelId}):`, err);
        }
        // fall through to next model
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return null;
  },

  /** Lightweight ping for Settings. Iterates models for test. */
  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    if (!apiKey) return { ok: false, detail: 'Chưa có API key' };
    if (!navigator.onLine) return { ok: false, detail: 'Offline — cần mạng cho OpenRouter' };

    const text = await this.generateContent('Trả lời đúng một từ: OK');
    if (!text) {
      return {
        ok: false,
        detail: 'Không kết nối được OpenRouter (mạng, rate limit, hoặc key sai)',
      };
    }
    return { ok: true, detail: `${text.slice(0, 40)} · ${MODEL_LIST[0]}` };
  },
};
