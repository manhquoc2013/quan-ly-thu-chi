/**
 * Gemini Service — Cloud AI via @google/genai SDK.
 *
 * Requires a Gemini API key from https://aistudio.google.com/apikey
 * Set via Settings screen → stored in authStore → passed to configure().
 *
 * Features:
 *   - generateContent(prompt) — text generation
 *   - analyzeImage(imageBase64, prompt) — Vision OCR
 *
 * Usage:
 *   import { geminiService } from '@/services/geminiService';
 *   geminiService.configure(apiKey);
 *   const text = await geminiService.generateContent('Phân tích...');
 */

import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;
let configured = false;

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

export const geminiService = {
  get isConfigured(): boolean { return configured; },

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
      const response = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        config: { systemInstruction: SYSTEM_INSTRUCTION },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      return response.text ?? '[Không có phản hồi]';
    } catch (err) {
      console.error('Gemini error:', err);
      return `Lỗi Gemini: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  },

  async analyzeImage(imageBase64: string, prompt: string): Promise<string> {
    if (!client) return 'Cần cấu hình API key để dùng OCR.';

    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          ],
        }],
      });
      return response.text ?? '[Không đọc được ảnh]';
    } catch (err) {
      console.error('Gemini Vision error:', err);
      return `Lỗi OCR: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  },

  /** Extract structured expense data from an invoice image. */
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
