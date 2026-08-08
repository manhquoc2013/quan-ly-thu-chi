/**
 * Kilo AI Gateway — free cloud models via OpenAI-compatible API.
 *
 * Default model: kilo-auto/free (server picks best free model).
 * Docs: https://kilo.ai/docs/gateway
 *
 * Browser CORS: Gateway blocks browser origins.
 * - DEV: Vite proxy `/api/kilo`
 * - PROD: Supabase Edge Function `kilo-proxy` (via VITE_SUPABASE_URL)
 *   or explicit `VITE_KILO_GATEWAY_BASE`
 *
 * Free tier works anonymously (~200 req/h/IP). Optional API key for higher limits.
 * Privacy: Auto Free may route to providers that log prompts — do not send secrets.
 */

const FREE_MODEL = 'kilo-auto/free';
const REQUEST_TIMEOUT_MS = 45_000;
const DIRECT_GATEWAY = 'https://api.kilo.ai/api/gateway';

let apiKey: string | null = null;
let enabled = true;

export type KiloGenerateResult = {
  text: string;
  model: string;
};

function supabaseKiloProxyBase(): string | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/functions/v1/kilo-proxy`;
}

/** Same-origin proxy in DEV; Supabase edge proxy / env override in prod. */
export function getKiloGatewayBase(): string {
  const fromEnv = (import.meta.env.VITE_KILO_GATEWAY_BASE as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (import.meta.env.DEV) return '/api/kilo';
  const viaSupabase = supabaseKiloProxyBase();
  if (viaSupabase) return viaSupabase;
  return DIRECT_GATEWAY;
}

export function isKiloProxyConfigured(): boolean {
  if ((import.meta.env.VITE_KILO_GATEWAY_BASE as string | undefined)?.trim()) return true;
  if (import.meta.env.DEV) return true;
  return Boolean(supabaseKiloProxyBase());
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const base = getKiloGatewayBase();
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  const usingSupabaseProxy = Boolean(anon && base.includes('/functions/v1/kilo-proxy'));

  if (usingSupabaseProxy && anon) {
    headers.Authorization = `Bearer ${anon}`;
    headers.apikey = anon;
    if (apiKey) headers['X-Kilo-Api-Key'] = apiKey;
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

export const kiloService = {
  get isEnabled(): boolean {
    return enabled;
  },

  get model(): string {
    return FREE_MODEL;
  },

  get hasApiKey(): boolean {
    return !!apiKey;
  },

  setEnabled(v: boolean): void {
    enabled = v;
  },

  configure(key: string | null): void {
    apiKey = key?.trim() || null;
  },

  /**
   * Chat completion against kilo-auto/free.
   * Returns null on network/HTTP failure so callers can fall back.
   */
  async generateContent(prompt: string): Promise<string | null> {
    if (!enabled || !navigator.onLine) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const url = `${getKiloGatewayBase()}/chat/completions`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          model: FREE_MODEL,
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
        console.warn(`Kilo Gateway HTTP ${res.status}:`, body.slice(0, 200));
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        model?: string;
        error?: { message?: string };
      };

      if (data.error?.message) {
        console.warn('Kilo Gateway error:', data.error.message);
        return null;
      }

      const msg = data.choices?.[0]?.message as
        | { content?: string | null; reasoning?: string | null }
        | undefined;
      // Some free models return empty content + fill `reasoning` instead
      const text = msg?.content?.trim() || msg?.reasoning?.trim() || '';
      return text || null;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        console.warn('Kilo Gateway timeout');
      } else {
        console.warn('Kilo Gateway request failed:', err);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /** Lightweight ping for Settings. */
  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    if (!navigator.onLine) return { ok: false, detail: 'Offline — cần mạng cho Kilo Free' };
    if (!import.meta.env.DEV && !isKiloProxyConfigured()) {
      return {
        ok: false,
        detail:
          'GitHub Pages bị CORS — deploy Supabase function kilo-proxy hoặc set VITE_KILO_GATEWAY_BASE',
      };
    }
    const text = await this.generateContent('Trả lời đúng một từ: OK');
    if (!text) {
      return {
        ok: false,
        detail: 'Không kết nối được Kilo (CORS/proxy, rate limit, hoặc mạng)',
      };
    }
    return { ok: true, detail: `${text.slice(0, 40)} · ${FREE_MODEL}` };
  },
};
