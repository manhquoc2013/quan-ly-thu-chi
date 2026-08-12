/**
 * Gemini Service — Cloud AI via @google/genai SDK.
 *
 * Lists models from Gemini `models.list`, then picks flash (extract/OCR) or
 * flash-lite (chat). Quota/404 hops to the other live model.
 */

import { GoogleGenAI } from '@google/genai';
import {
  GEMINI_MODEL_SEED,
  buildGeminiTaskModels,
  resolveGeminiModels,
} from './freeModelCatalog';

let client: GoogleGenAI | null = null;
let apiKeyStored: string | null = null;
let configured = false;

export const GEMINI_FLASH = GEMINI_MODEL_SEED[0];
export const GEMINI_FLASH_LITE = GEMINI_MODEL_SEED[1];

export type GeminiTask = 'extract' | 'chat' | 'vision';

const lastOkByTask: Partial<Record<GeminiTask, string>> = {};

export function modelsForGeminiTask(task: GeminiTask, liveIds?: string[]): string[] {
  const preferred = buildGeminiTaskModels(liveIds ?? [...GEMINI_MODEL_SEED], task);
  const last = lastOkByTask[task];
  if (last && preferred.includes(last)) {
    return [last, ...preferred.filter((model) => model !== last)];
  }
  return preferred;
}

async function modelsForRequest(task: GeminiTask, forceRefresh = false): Promise<string[]> {
  const live = await resolveGeminiModels(apiKeyStored ?? '', { forceRefresh });
  return modelsForGeminiTask(task, live);
}

function formatGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(raw)) {
    const retry = raw.match(/retry in ([\d.]+)\s*s/i)?.[1];
    const wait = retry ? ` Thử lại sau ~${Math.ceil(Number(retry))}s.` : '';
    return (
      `Hết hạn mức Gemini (429). Model free-tier tạm hết quota hoặc chưa bật billing.` +
      wait +
      ' Key vẫn được lưu — app sẽ dùng WebLLM/Tesseract khi cloud bận. Xem: https://ai.google.dev/gemini-api/docs/rate-limits'
    );
  }
  if (/API_KEY_INVALID|invalid.*key|403|PERMISSION_DENIED/i.test(raw)) {
    return 'API key không hợp lệ hoặc bị hạn chế. Tạo key mới tại https://aistudio.google.com/apikey';
  }
  // Strip huge JSON bodies for UI
  const short = raw.replace(/\s+/g, ' ').slice(0, 220);
  return short;
}

async function generateWithFallback(
  ai: GoogleGenAI,
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
  task: GeminiTask,
): Promise<string> {
  let lastErr: unknown;
  const tryList = async (models: string[], skip: Set<string>) => {
    for (const model of models) {
      if (skip.has(model)) continue;
      skip.add(model);
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
        });
        lastOkByTask[task] = model;
        return response.text ?? '';
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (/429|RESOURCE_EXHAUSTED|quota|not found|NOT_FOUND|404/i.test(msg)) {
          continue;
        }
        throw err;
      }
    }
    return null;
  };

  const tried = new Set<string>();
  const first = await modelsForRequest(task, false);
  const hit = await tryList(first, tried);
  if (hit !== null) return hit;

  const refreshed = await modelsForRequest(task, true);
  if (refreshed.join('|') !== first.join('|')) {
    const again = await tryList(refreshed, tried);
    if (again !== null) return again;
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export const geminiService = {
  get isConfigured(): boolean {
    return configured;
  },

  get model(): string {
    return lastOkByTask.chat ?? GEMINI_FLASH_LITE;
  },

  configure(apiKey: string): void {
    const trimmed = apiKey.trim();
    client = new GoogleGenAI({ apiKey: trimmed });
    apiKeyStored = trimmed;
    configured = true;
    void resolveGeminiModels(trimmed, { forceRefresh: true });
  },

  disconnect(): void {
    client = null;
    apiKeyStored = null;
    configured = false;
  },

  async generateContent(
    prompt: string,
    opts?: { task?: GeminiTask },
  ): Promise<string> {
    if (!client) return fallback(prompt);

    try {
      const text = await generateWithFallback(
        client,
        [{ text: prompt }],
        opts?.task ?? 'chat',
      );
      return text || '[Không có phản hồi]';
    } catch (err) {
      console.error('Gemini error:', err);
      return `Lỗi Gemini: ${formatGeminiError(err)}`;
    }
  },

  /** Ping Gemini with a tiny prompt; throws on failure (friendly message). */
  async testConnection(apiKey?: string): Promise<{
    ok: boolean;
    detail: string;
    quota?: boolean;
  }> {
    const key = apiKey?.trim();
    const testClient = key ? new GoogleGenAI({ apiKey: key }) : client;
    if (!testClient) return { ok: false, detail: 'Chưa có API key' };

    const prevKey = apiKeyStored;
    if (key) {
      apiKeyStored = key;
      await resolveGeminiModels(key, { forceRefresh: true });
    }

    try {
      const text = (
        await generateWithFallback(
          testClient,
          [{ text: 'Trả lời đúng một từ: OK' }],
          'chat',
        )
      ).trim();
      if (!text) return { ok: false, detail: 'Gemini không trả lời' };
      return { ok: true, detail: `${text.slice(0, 40)} · model ${lastOkByTask.chat ?? GEMINI_FLASH_LITE}` };
    } catch (err) {
      const detail = formatGeminiError(err);
      const quota = /429|hết hạn mức|quota|RESOURCE_EXHAUSTED/i.test(detail);
      // Quota means the key was accepted by Google — not an invalid key
      if (quota) {
        return { ok: true, detail: `Key hợp lệ · ${detail}`, quota: true };
      }
      return { ok: false, detail };
    } finally {
      if (key && !configured) apiKeyStored = prevKey;
    }
  },

  async analyzeImage(imageBase64: string, prompt: string): Promise<string> {
    if (!client) return 'Cần cấu hình API key để dùng OCR.';

    try {
      const text = await generateWithFallback(
        client,
        [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        ],
        'vision',
      );
      return text || '[Không đọc được ảnh]';
    } catch (err) {
      console.error('Gemini Vision error:', err);
      return `Lỗi OCR: ${formatGeminiError(err)}`;
    }
  },

  async ocrInvoice(imageBase64: string): Promise<{
    date: string;
    amount: number;
    category: string;
    description: string;
    supplier: string;
  } | null> {
    if (!client) return null;

    const prompt = `Đọc hóa đơn này và trả về JSON:
{
  "date": "YYYY-MM-DD",
  "amount": số tiền (VND, chỉ số),
  "category": "office|utilities|supplies|transportation|maintenance|marketing|other",
  "description": "mô tả ngắn",
  "supplier": "tên nhà cung cấp"
}
Chỉ trả về JSON, không thêm text khác.`;

    const text = await this.analyzeImage(imageBase64, prompt);
    if (text.startsWith('Lỗi OCR:')) return null;
    try {
      const json = JSON.parse(text.replace(/```json\n?/g, '').replace(/```/g, '').trim());
      return {
        date: json.date || new Date().toISOString().slice(0, 10),
        amount: Number(json.amount) || 0,
        category: json.category || 'other',
        description: json.description || 'Hóa đơn',
        supplier: json.supplier || '',
      };
    } catch {
      return null;
    }
  },
};

function fallback(prompt: string): string {
  return `[Gemini chưa cấu hình] Để dùng AI, vào Cài đặt → nhập Gemini API key.\n\nCâu hỏi của bạn: "${prompt.slice(0, 100)}..."`;
}
