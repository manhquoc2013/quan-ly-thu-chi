/**
 * WebLLM Service — Local AI running in the browser via WebGPU.
 *
 * Uses Qwen 2.5 0.5B Instruct (~280MB) — optimized for low-end hardware.
 * Model is downloaded once and cached in IndexedDB by the WebLLM runtime.
 *
 * Works offline, no API key needed. Best for basic chat and simple tasks.
 *
 * Reference: docs/11-hybrid-ai-design.md, docs/12-resource-optimization.md
 *
 * Usage:
 *   import { webLLM } from '@/services/webLLM';
 *   await webLLM.load();
 *   const text = await webLLM.generate('Tổng chi phí tháng 7 là bao nhiêu?');
 */

import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';

// Qwen3 4B — thế hệ mới nhất, tiếng Việt vượt trội, context 32K
// ~2.7GB tải lần đầu, cache trong IndexedDB
// Fallback: nếu máy yếu có thể đổi về Qwen3-1.7B-q4f16_1-MLC (~1.6GB)
const MODEL_ID = 'Qwen3-4B-q4f16_1-MLC';

let engine: MLCEngine | null = null;
let loading = false;
let loaded = false;
let loadPercent = 0;
let loadText = '';

export const webLLM = {
  get isLoaded(): boolean { return loaded; },
  get isLoading(): boolean { return loading; },
  get loadProgress(): number { return loadPercent; },
  get loadStatus(): string { return loadText; },

  /**
   * Initialize and load the model. Downloads ~280MB on first run.
   * Subsequent calls are instant (model cached in browser).
   */
  async load(): Promise<boolean> {
    if (loaded) return true;
    if (loading) {
      // Wait for existing load to complete
      let retries = 0;
      while (loading && retries < 300) {
        await new Promise((r) => setTimeout(r, 100));
        retries++;
      }
      return loaded;
    }

    loading = true;
    loadPercent = 0;
    loadText = 'Đang khởi tạo...';
    try {
      engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          loadPercent = Math.round(report.progress * 100);
          loadText = report.text;
          console.log(`WebLLM: ${loadPercent}% — ${report.text}`);
        },
      });
      loaded = true;
      return true;
    } catch (err) {
      console.error('WebLLM failed to load:', err);
      return false;
    } finally {
      loading = false;
    }
  },

  /**
   * Generate text from a prompt using the local model.
   * Falls back to error message if model not loaded.
   */
  async generate(prompt: string): Promise<string> {
    if (!engine) {
      if (!loading) await this.load();
      if (!engine) return fallback(prompt);
    }

    try {
      const systemPrompt = `Bạn là trợ lý quản lý thu chi, tên "Trợ lý Tài Chính". Luôn trả lời bằng tiếng Việt, thân thiện, ngắn gọn.

QUAN TRỌNG — CHỈ thêm action khi user YÊU CẦU CỤ THỂ việc tạo dữ liệu:
- Nếu user nói "thêm chi phí X", "tạo khoản chi Y", "thêm khoản Z": thêm dòng NÀY vào cuối:
\`\`\`action
{"type":"create_expense","amount":SỐ_TIỀN,"description":"MÔ_TẢ","category":"MÃ"}
\`\`\`
MÃ danh mục: office=Văn phòng, rent=Thuê MB, utilities=Điện/nước/net, salary=Lương, marketing=Quảng cáo, supplies=Vật liệu, transportation=Vận chuyển/xăng xe, maintenance=Bảo trì/sửa chữa, tax=Thuế/phí, other=Khác.
- Nếu user nói "bán", "doanh thu", "đơn hàng": thay type="create_revenue".
- Nếu user hỏi phân tích, tổng quan, báo cáo, hoặc chat thông thường: TRẢ LỜI BÌNH THƯỜNG, KHÔNG thêm action.

Số tiền: 12k=12000, 1.5m=1500000.`;
      const fullPrompt = `${systemPrompt}\n\nNgười dùng: ${prompt}\nTrợ lý:`;

      const reply = await engine.chat.completions.create({
        messages: [{ role: 'user', content: fullPrompt }],
        max_tokens: 4096,
        temperature: 0.7,
        // Tắt thinking mode để tiết kiệm token cho câu trả lời thực tế
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        enable_thinking: false,
      } as any);

      let content = reply.choices[0]?.message?.content ?? '[Không có phản hồi]';
      // Strip Qwen3 thinking tags — xử lý cả trường hợp thiếu thẻ đóng
      content = content
        .replace(/<think>[\s\S]*?<\/think>/g, '')   // closed tags
        .replace(/<think>[\s\S]*$/, '')              // unclosed tag → drop everything after
        .trim();
      return content || '[Không có phản hồi]';
    } catch (err) {
      console.error('WebLLM generate error:', err);
      return `Lỗi sinh văn bản: ${err instanceof Error ? err.message : 'Unknown'}`;
    }
  },

  /** Unload model to free memory. */
  async unload(): Promise<void> {
    engine = null;
    loaded = false;
  },
};

function fallback(prompt: string): string {
  if (loading) return '⏳ Đang tải model AI... Vui lòng đợi (lần đầu ~280MB).';
  return `⚠️ Không thể tải model AI cục bộ.\nKiểm tra: Chrome 113+, WebGPU được bật.\n\nCâu hỏi: "${prompt.slice(0, 100)}..."`;
}
