/**
 * Gemini Service — Cloud AI via @google/genai SDK.
 *
 * Default models prefer free-tier Flash-Lite / Flash (2.5), with fallbacks.
 */

import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;
let configured = false;
let activeModel = 'gemini-2.5-flash-lite';

/** Prefer free-tier friendly models first (limit:0 on older 2.0-flash is common). */
const MODEL_CANDIDATES = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
] as const;

const SYSTEM_INSTRUCTION = `Bạn là trợ lý quản lý thu chi tài chính, tên là "Trợ lý Tài Chính".
QUAN TRỌNG:
1. Chỉ trả lời bằng tiếng Việt, TUYỆT ĐỐI KHÔNG dùng tiếng Trung hay ngôn ngữ khác.
2. Trả lời ngắn gọn, thân thiện.

3. KHI NGƯỜI DÙNG YÊU CẦU THÊM/SỬA/XÓA DỮ LIỆU:
   a) THÊM CHI PHÍ: thêm dòng này vào CUỐI:
\`\`\`action
{"type":"create_expense","amount":SỐ_TIỀN,"description":"MÔ_TẢ","category":"MÃ"}
\`\`\`
   MÃ = office (Văn phòng), rent (Thuê MB), utilities (Điện/nước/net), salary (Lương), marketing (Quảng cáo), supplies (Vật liệu), transportation (Vận chuyển/xăng xe), maintenance (Bảo trì/sửa chữa), tax (Thuế/phí), other (Khác).
   b) THÊM DOANH THU: thêm:
\`\`\`action
{"type":"create_revenue","amount":SỐ_TIỀN,"description":"MÔ_TẢ","customerName":"TÊN_KHÁCH"}
\`\`\`
   SỐ_TIỀN: số nguyên (12k=12000, 1.5m=1500000). 4. Nếu không phải thêm/sửa/xóa thì trả lời bình thường, KHÔNG thêm action.`;

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
  withSystem: boolean,
): Promise<string> {
  let lastErr: unknown;
  const models = [activeModel, ...MODEL_CANDIDATES.filter((m) => m !== activeModel)];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        ...(withSystem ? { config: { systemInstruction: SYSTEM_INSTRUCTION } } : {}),
        contents: [{ role: 'user', parts }],
      });
      activeModel = model;
      return response.text ?? '';
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Try next model on quota / not found
      if (/429|RESOURCE_EXHAUSTED|quota|not found|NOT_FOUND|404/i.test(msg)) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export const geminiService = {
  get isConfigured(): boolean {
    return configured;
  },

  get model(): string {
    return activeModel;
  },

  configure(apiKey: string): void {
    client = new GoogleGenAI({ apiKey });
    configured = true;
  },

  disconnect(): void {
    client = null;
    configured = false;
  },

  async generateContent(prompt: string): Promise<string> {
    if (!client) return fallback(prompt);

    try {
      const text = await generateWithFallback(client, [{ text: prompt }], true);
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

    try {
      const text = (
        await generateWithFallback(
          testClient,
          [{ text: 'Trả lời đúng một từ: OK' }],
          false,
        )
      ).trim();
      if (!text) return { ok: false, detail: 'Gemini không trả lời' };
      return { ok: true, detail: `${text.slice(0, 40)} · model ${activeModel}` };
    } catch (err) {
      const detail = formatGeminiError(err);
      const quota = /429|hết hạn mức|quota|RESOURCE_EXHAUSTED/i.test(detail);
      // Quota means the key was accepted by Google — not an invalid key
      if (quota) {
        return { ok: true, detail: `Key hợp lệ · ${detail}`, quota: true };
      }
      return { ok: false, detail };
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
        false,
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
