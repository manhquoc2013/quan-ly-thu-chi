/**
 * Groq Service — Cloud AI via Groq's OpenAI-compatible API.
 *
 * Default model: llama-3.3-70b-versatile.
 * Docs: https://console.groq.com/docs
 *
 * Groq API is OpenAI-compatible, so we use the same chat/completions endpoint.
 * Free tier has rate limits (~30 req/min, ~14,400 req/day).
 * Privacy: Groq does NOT train on API data per their ToS (as of 2026).
 */

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const REQUEST_TIMEOUT_MS = 45_000;

let apiKey: string | null = null;
let enabled = true;
let configured = false;

// Auto-configure from build-time env var (developer convenience)
const envKey = (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim();
if (envKey) {
  apiKey = envKey;
  configured = true;
}

export const groqService = {
  get isConfigured(): boolean {
    return configured;
  },

  get isEnabled(): boolean {
    return enabled;
  },

  get model(): string {
    return DEFAULT_MODEL;
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
   * Chat completion against Groq API.
   * Returns null on ANY failure so callers can fall through the cascade.
   */
  async generateContent(prompt: string): Promise<string | null> {
    if (!configured || !enabled || !navigator.onLine || !apiKey) return null;

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
          model: DEFAULT_MODEL,
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
        console.warn(`Groq HTTP ${res.status}:`, body.slice(0, 200));
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        model?: string;
        error?: { message?: string };
      };

      if (data.error?.message) {
        console.warn('Groq API error:', data.error.message);
        return null;
      }

      const msg = data.choices?.[0]?.message as
        | { content?: string | null }
        | undefined;
      const text = msg?.content?.trim() || '';
      return text || null;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        console.warn('Groq request timeout');
      } else {
        console.warn('Groq request failed:', err);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /** Lightweight ping for Settings. */
  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    if (!apiKey) return { ok: false, detail: 'Chưa có API key' };
    if (!navigator.onLine) return { ok: false, detail: 'Offline — cần mạng cho Groq' };

    const text = await this.generateContent('Trả lời đúng một từ: OK');
    if (!text) {
      return {
        ok: false,
        detail: 'Không kết nối được Groq (mạng, rate limit, hoặc key sai)',
      };
    }
    return { ok: true, detail: `${text.slice(0, 40)} · ${DEFAULT_MODEL}` };
  },
};
