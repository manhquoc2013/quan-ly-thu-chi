/**
 * WebLLM Service — Local AI running in the browser via WebGPU.
 *
 * Qwen3-4B (~2.7GB first download, cached in IndexedDB).
 * Context window raised above default 4K so long EXTRACT_PROMPT + data fits.
 *
 * v2: Added AbortController + 30s timeout to prevent machine freeze.
 *     Added cancel() method for user-initiated abort.
 */

import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';

const MODEL_ID = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';
/** Qwen3-4B supports 32K; 4K keeps VRAM low to avoid UI stutter on mid-range GPUs */
const CONTEXT_WINDOW_SIZE = 4096;
/** Max seconds to wait for a single generate() call before auto-aborting */
const GENERATE_TIMEOUT_MS = 30_000;

let engine: MLCEngine | null = null;
let loading = false;
let loaded = false;
let loadPercent = 0;
let loadText = '';

/** Active AbortController for the current generate() call. */
let currentAbortController: AbortController | null = null;

/** Serialize generates — parallel WebLLM calls cancel each other and freeze the GPU. */
let generateQueue: Promise<void> = Promise.resolve();

/** Whether the user has disabled WebLLM (set from authStore). */
let disabled = false;
/** Bumped when load should be discarded (toggle off mid-download). */
let loadEpoch = 0;

const CHAT_SYSTEM = `Bạn là "Mèo Lucky" — Trợ lý thu ngân và quản lý sổ sách thông minh của cửa hàng.

=================== 1. TÍNH CÁCH (PERSONALITY) ===================
- Phong cách: Nhanh nhẹn, lanh lợi, yêu tiền và thích đếm tiền 🐱.
- Luôn hào hứng khi cửa hàng chốt đơn ("Nổ đơn!"), nhắc khéo khi chi tiền nhập hàng.
- Xưng hô: "Lucky" và "Chủ tiệm" (hoặc "bạn").
- mascot_say luôn ≤12 từ, tiếng Việt rõ, không meme / slang Anh.

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
  "mascot_say": "Câu thoại ≤12 từ: mừng thu / nhắc chi / xác nhận ghi sổ; không meme, không slang Anh",
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
  "mascot_say": "Nổ đơn trà sữa +90k vào sổ!",
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
  "mascot_say": "Đơn Shopee của Linh vào sổ rồi!",
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
  "mascot_say": "Đã ghi chi nhập hàng 2.5 triệu.",
  "mascot_emotion": "warning"
}

[Ví dụ 4: Hỏi xem doanh thu]
User: "Hôm nay tiệm mình bán được nhiều chưa em?"
Output:
{
  "action": "XEM_BAO_CAO",
  "data": null,
  "mascot_say": "Lucky kiểm tra doanh thu hôm nay nhé.",
  "mascot_emotion": "thinking"
}
`;

export type WebLlmGenerateOpts = {
  /** raw = prompt as-is (intent JSON); chat = kèm system trợ lý */
  mode?: 'chat' | 'raw';
  maxTokens?: number;
};

export const webLLM = {
  get isLoaded(): boolean {
    return loaded;
  },
  get isLoading(): boolean {
    return loading;
  },
  get loadProgress(): number {
    return loadPercent;
  },
  get loadStatus(): string {
    return loadText;
  },
  get isDisabled(): boolean {
    return disabled;
  },
  get isGenerating(): boolean {
    return currentAbortController !== null;
  },

  /** Enable or disable WebLLM (persisted via authStore). */
  setDisabled(v: boolean): void {
    disabled = v;
    if (v) {
      loadEpoch += 1;
      this.cancel();
      void this.unload();
    }
  },

  /** Cancel the in-flight generate() call. */
  cancel(): void {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
  },

  /** Release GPU/model resources if loaded. */
  async unload(): Promise<void> {
    const current = engine;
    engine = null;
    loaded = false;
    loadPercent = 0;
    loadText = '';
    if (!current) return;
    try {
      await current.unload();
    } catch {
      // ignore unload errors
    }
  },

  async load(): Promise<boolean> {
    if (disabled) return false;
    if (loaded) return true;
    if (loading) {
      let retries = 0;
      while (loading && retries < 300) {
        await new Promise((r) => setTimeout(r, 100));
        retries++;
      }
      return loaded && !disabled;
    }

    const epoch = loadEpoch;
    loading = true;
    loadPercent = 0;
    loadText = 'Đang khởi tạo...';
    try {
      const nextEngine = await CreateMLCEngine(
        MODEL_ID,
        {
          initProgressCallback: (report) => {
            if (disabled || epoch !== loadEpoch) return;
            loadPercent = Math.round(report.progress * 100);
            loadText = report.text;
            console.warn(`WebLLM: ${loadPercent}% — ${report.text}`);
          },
        },
        { context_window_size: CONTEXT_WINDOW_SIZE },
      );
      if (disabled || epoch !== loadEpoch) {
        try {
          await nextEngine.unload();
        } catch {
          // ignore
        }
        return false;
      }
      engine = nextEngine;
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
   * Generate text. Use mode:'raw' for long structured prompts (intent extract)
   * so we don't stack a second system prompt.
   *
   * Calls are queued (never parallel). Auto-aborts after timeout.
   */
  async generate(prompt: string, opts?: WebLlmGenerateOpts): Promise<string> {
    if (disabled) return '⚠️ WebLLM đã bị tắt trong Cài đặt. Dùng Gemini cloud hoặc lệnh nhanh.';

    if (!engine) {
      if (!loading) await this.load();
    }
    if (!engine) return fallback(prompt);

    const mode = opts?.mode ?? 'chat';
    // Keep raw completions short — long decode is what freezes mid-range GPUs
    const maxTokens = opts?.maxTokens ?? (mode === 'raw' ? 256 : 512);
    const timeoutMs = mode === 'raw' ? 20_000 : GENERATE_TIMEOUT_MS;

    const run = async (): Promise<string> => {
      const controller = new AbortController();
      currentAbortController = controller;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const messages =
          mode === 'raw'
            ? [{ role: 'user' as const, content: trimToContext(prompt, CONTEXT_WINDOW_SIZE, maxTokens) }]
            : [
                { role: 'system' as const, content: CHAT_SYSTEM },
                {
                  role: 'user' as const,
                  content: trimToContext(prompt, CONTEXT_WINDOW_SIZE, maxTokens, CHAT_SYSTEM.length),
                },
              ];

        const reply = await engine!.chat.completions.create({
          messages,
          max_tokens: maxTokens,
          temperature: mode === 'raw' ? 0.1 : 0.4,
        });

        if (controller.signal.aborted) {
          return '⏹️ Đã hủy yêu cầu AI.';
        }

        let content = reply.choices[0]?.message?.content ?? '[Không có phản hồi]';
        content = content
          .replace(/<think>[\s\S]*?<\/think>/g, '')
          .replace(/<think>[\s\S]*$/, '')
          .trim();
        return content || '[Không có phản hồi]';
      } catch (err) {
        if (controller.signal.aborted) {
          return '⏱️ AI cục bộ chạy quá lâu — đã tự động dừng để tránh đơ máy. Thử câu ngắn hơn hoặc bật Gemini.';
        }
        console.error('WebLLM generate error:', err);
        return `Lỗi sinh văn bản: ${err instanceof Error ? err.message : 'Unknown'}`;
      } finally {
        clearTimeout(timeoutId);
        if (currentAbortController === controller) {
          currentAbortController = null;
        }
        // Yield so the UI can paint between queued jobs
        await new Promise((r) => setTimeout(r, 0));
      }
    };

    // Queue behind previous generate — do not cancel prior work mid-flight
    const queued = generateQueue.then(run, run);
    generateQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  },
};

/** Rough char budget (~3 chars/token) so prompt + max_tokens stay under window. */
function trimToContext(
  prompt: string,
  contextWindow: number,
  maxTokens: number,
  reservedChars = 0,
): string {
  const budgetChars = Math.max(2000, (contextWindow - maxTokens - 64) * 3 - reservedChars);
  if (prompt.length <= budgetChars) return prompt;
  return `${prompt.slice(0, budgetChars)}\n\n[…đã cắt ngữ cảnh cho vừa context window…]`;
}

function fallback(prompt: string): string {
  if (loading) {
    return '⏳ Đang tải model AI cục bộ (WebLLM)… Lần đầu có thể vài GB, vui lòng đợi rồi gửi lại.';
  }
  return `⚠️ Không thể tải model AI cục bộ.\nKiểm tra: Chrome 113+, WebGPU được bật.\n\nCâu hỏi: "${prompt.slice(0, 100)}..."`;
}
