/**
 * SiliconFlow Service — Cloud AI via SiliconFlow's OpenAI-compatible API.
 *
 * Auto-fallbacks across 5 free models; cascade tries each on non-200/error.
 * Docs: https://docs.siliconflow.cn
 *
 * SiliconFlow API is OpenAI-compatible — POST /v1/chat/completions.
 * Free models are available without payment on the platform.
 */

const MODEL_LIST = [
  'Qwen/Qwen2.5-7B-Instruct',
  'deepseek-ai/DeepSeek-V2.5',
  'Qwen/Qwen2-7B-Instruct',
  'THUDM/glm-4-9b-chat',
  'Pro/Meta-Llama-3.1-8B-Instruct',
] as const;

const SILICONFLOW_BASE = 'https://api.siliconflow.cn/v1';
const REQUEST_TIMEOUT_MS = 45_000;

let apiKey: string | null = null;
let enabled = true;
let configured = false;

// Auto-configure from build-time env var (developer convenience)
const envKey = (import.meta.env.VITE_SILICONFLOW_API_KEY as string | undefined)?.trim();
if (envKey) {
  apiKey = envKey;
  configured = true;
}

export const siliconFlowService = {
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
   * Chat completion against SiliconFlow API.
   * Iterates MODEL_LIST on any failure; returns null only if ALL models fail.
   */
  async generateContent(prompt: string): Promise<string | null> {
    if (!configured || !enabled || !navigator.onLine || !apiKey) return null;

    for (const modelId of MODEL_LIST) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(`${SILICONFLOW_BASE}/chat/completions`, {
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
          console.warn(`SiliconFlow HTTP ${res.status} (${modelId}):`, body.slice(0, 200));
          continue; // try next model
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string | null } }>;
          model?: string;
          error?: { message?: string };
        };

        if (data.error?.message) {
          console.warn(`SiliconFlow API error (${modelId}):`, data.error.message);
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
          console.warn(`SiliconFlow request timeout (${modelId})`);
        } else {
          console.warn(`SiliconFlow request failed (${modelId}):`, err);
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
    if (!navigator.onLine) return { ok: false, detail: 'Offline — cần mạng cho SiliconFlow' };

    const text = await this.generateContent('Trả lời đúng một từ: OK');
    if (!text) {
      return {
        ok: false,
        detail: 'Không kết nối được SiliconFlow (mạng, rate limit, hoặc key sai)',
      };
    }
    return { ok: true, detail: `${text.slice(0, 40)} · ${MODEL_LIST[0]}` };
  },
};
