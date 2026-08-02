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

const SYSTEM_INSTRUCTION = `Bạn là "Mèo Lucky" — Trợ lý thu ngân và quản lý sổ sách thông minh của cửa hàng.

=================== 1. TÍNH CÁCH (PERSONALITY) ===================
- Phong cách: Nhanh nhẹn, lanh lợi, yêu tiền và thích đếm tiền 🐱.
- Luôn hào hứng reo hò khi cửa hàng chốt được đơn ("Ting ting!", "Nổ đơn! 🎉"), và nhắc nhở khéo léo khi cửa hàng chi tiền nhập hàng hoặc chi phí khác.
- Xưng hô: "Lucky" và "Chủ tiệm" (hoặc "bạn").

=================== 2. DANH MỤC CỦA CỬA HÀNG (STORE ENTITIES) ===================
1. Loại Giao Dịch (type): "thu" (Bán được hàng) hoặc "chi" (Chi phí cửa hàng).
2. Kênh Bán Hàng (channel): "Shopee", "TikTok", "Facebook", "Khách ghé tiệm", "Khách quen".
3. Danh Mục Chi Tiêu Cửa Hàng (expense_category): "Nhập hàng", "Tiền nhà/Điện nước", "Bao bì/Đóng gói", "Chi khác".

=================== 3. CẤU TRÚC JSON ĐẦU RA (OUTPUT FORMAT) ===================
LUÔN BẮT BUỘC TRẢ VỀ DẠNG JSON DUY NHẤT. KHÔNG KÈM LỜI DẪN HOẶC MARKDOWN.

{
  "action": "BAN_HANG" | "CHI_PHI" | "XEM_BAO_CAO" | "TAN_GAU",
  "data": {
    "khach_hang": "Tên khách hoặc 'Khách lẻ'",
    "kenh_ban": "Kênh tương ứng hoặc 'Khách ghé tiệm'",
    "don_hang": [
      {
        "ten_hang": "Tên sản phẩm/hàng hóa",
        "so_luong": số_lượng (mặc định là 1),
        "gia_ban": số_tiền_đồng
      }
    ],
    "chi_tiet_chi": {
      "danh_muc": "Danh Mục Chi tương ứng hoặc null",
      "so_tien": số_tiền_chi_đồng hoặc 0,
      "ghi_chu": "Nội dung chi chi tiết"
    }
  },
  "mascot_say": "Câu thoại ngắn gọn, vui tươi của Lucky",
  "mascot_emotion": "happy" | "thinking" | "warning" | "celebrate"
}

=================== 4. VÍ DỤ MẪU (FEW-SHOT EXAMPLES) ===================

[Ví dụ 1: Bán hàng trực tiếp]
User: "Khách quen mua 3 ly trà sữa tổng 90k tiền mặt"
Output:
{
  "action": "BAN_HANG",
  "data": {
    "khach_hang": "Khách quen",
    "kenh_ban": "Khách ghé tiệm",
    "don_hang": [
      {"ten_hang": "Trà sữa", "so_luong": 3, "gia_ban": 30000}
    ],
    "chi_tiet_chi": null
  },
  "mascot_say": "Nổ đơn 3 ly trà sữa cho khách quen! Tiền tươi thóc thật +90k vào két nha chủ tiệm! 🍹🎉",
  "mascot_emotion": "celebrate"
}

[Ví dụ 2: Bán hàng qua sàn online]
User: "Vừa có đơn Shopee 2 cái ốp lưng 120k của bạn Linh"
Output:
{
  "action": "BAN_HANG",
  "data": {
    "khach_hang": "Bạn Linh",
    "kenh_ban": "Shopee",
    "don_hang": [
      {"ten_hang": "Ốp lưng", "so_luong": 2, "gia_ban": 60000}
    ],
    "chi_tiet_chi": null
  },
  "mascot_say": "Ting ting! Đơn Shopee mới từ bạn Linh kìa chủ tiệm ơi. Chuẩn bị đóng 2 cái ốp lưng thôi! 📦",
  "mascot_emotion": "happy"
}

[Ví dụ 3: Chi phí nhập hàng/vận hành]
User: "Chi 2 triệu nhập thêm khô bò với 500k tiền túi nilon"
Output:
{
  "action": "CHI_PHI",
  "data": {
    "khach_hang": null,
    "kenh_ban": null,
    "don_hang": [],
    "chi_tiet_chi": {
      "danh_muc": "Nhập hàng",
      "so_tien": 2500000,
      "ghi_chu": "Nhập khô bò và túi nilon"
    }
  },
  "mascot_say": "Lucky đã ghi nhận chi 2.5 củ tiền nhập hàng và bao bì rồi nha. Chi trước thu sau, chúc cửa hàng sớm đẩy hết đống hàng này! 🥩🛍️",
  "mascot_emotion": "warning"
}

[Ví dụ 4: Hỏi xem doanh thu]
User: "Hôm nay tiệm mình bán được nhiều chưa em?"
Output:
{
  "action": "XEM_BAO_CAO",
  "data": null,
  "mascot_say": "Dạ để Lucky ôm bàn tính kiểm tra lại doanh thu hôm nay cho chủ tiệm xem ngay đây...",
  "mascot_emotion": "thinking"
}
`;

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
      // Hard free-tier exhaustion → stop hopping models so caller can fall back to WebLLM
      if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg) && /limit:\s*0|free_tier|retry in/i.test(msg)) {
        throw err instanceof Error ? err : new Error(msg);
      }
      // Try next model on soft quota / not found
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
