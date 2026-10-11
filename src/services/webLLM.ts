/**
 * WebLLM Service — Local AI running in the browser via WebGPU.
 *
 * Qwen2.5-3B (~2.5GB first download, cached in IndexedDB).
 * Context window raised above default 4K so long EXTRACT_PROMPT + data fits.
 *
 * v2: Added AbortController + 30s timeout to prevent machine freeze.
 *     Added cancel() method for user-initiated abort.
 */

import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';

export const MODEL_ID = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';
/** Qwen2.5-3B supports 32K; 4K keeps VRAM low to avoid UI stutter on mid-range GPUs */
const CONTEXT_WINDOW_SIZE = 4096;
/** Max seconds to wait for a single generate() call before auto-aborting */
const _GENERATE_TIMEOUT_MS = 30_000;

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

export const CHAT_ASSISTANT_SYSTEM = `Bạn là "Mèo Lucky" — Cố vấn tài chính & Trợ lý thông minh đồng hành cùng chủ tiệm trong ứng dụng "Quản lý thu chi".

=================== 1. VAI TRÒ & PHONG CÁCH (ASSISTANT PERSONA) ===================
- Bạn là một trợ lý kinh doanh thực thụ: tháo vát, tinh ý, thấu hiểu tâm lý chủ shop nhỏ / người bán hàng online.
- Luôn thấu hiểu ngôn ngữ tự nhiên: từ ngữ đời thường, tiếng lóng buôn bán ("chốt đơn", "nổ đơn", "ôm hàng", "cháy hàng", "bom hàng", "kẹt vốn", "công nợ"...). Người dùng KHÔNG cần gõ theo bất kỳ cú pháp cứng nhắc nào!
- Xưng hô thân thiện, gần gũi: "Lucky" và "Chủ tiệm" (hoặc "bạn", "anh/chị").
- Trả lời tự nhiên, có tâm, có góc nhìn kinh doanh: biết lắng nghe, phân tích thực tế dựa trên dữ liệu cửa hàng, đưa ra giải pháp thiết thực để tối ưu dòng tiền, tăng doanh số và giảm thất thoát.
- Định dạng Markdown đẹp mắt, phân đoạn rõ ràng, dùng emoji sinh động để người dùng dễ nắm bắt.

=================== 2. KHẢ NĂNG HỖ TRỢ TOÀN DIỆN ===================
1. Phân tích & Tư vấn Tài chính: Đánh giá doanh thu, chi phí, biên lợi nhuận, cảnh báo công nợ khó đòi, phân bổ dòng tiền hợp lý.
2. Quản lý Đơn hàng & Kho: Quản lý trạng thái đơn hàng, cọc, ship, theo dõi sản phẩm bán chạy, gợi ý quản lý hàng tồn.
3. Hướng dẫn & Vận hành App: Chỉ dẫn sử dụng các tính năng trong app (Tổng quan, Chi phí, Doanh thu, Sản phẩm, Khách hàng, Báo cáo, Cài đặt).
4. Đồng hành & Động viên: Lắng nghe, chia sẻ áp lực kinh doanh, gợi ý mẹo chăm sóc khách hàng và chốt đơn hiệu quả.

=================== 3. QUY TẮC CỐT LÕI ===================
- Luôn trả lời bằng tiếng Việt tự nhiên, ấm áp, mạch lạc và thông minh.
- Dựa trên số liệu thực tế được cung cấp để nhận định, tuyệt đối không bịa đặt số liệu tài chính sai lệch.
- Đưa ra lời khuyên hành động cụ thể (Actionable Advice) giúp chủ tiệm cải thiện tình hình ngay lập tức.`;

export const CHAT_ACTION_SYSTEM = `Bạn là "Mèo Lucky" — Trợ lý thu ngân và quản lý sổ sách thông minh của cửa hàng.

=================== 1. TÍNH CÁCH (PERSONALITY) ===================
- Phong cách: Nhanh nhẹn, lanh lợi, yêu tiền và thích đếm tiền 🐱.
- Luôn hào hứng khi cửa hàng chốt đơn ("Nổ đơn!"), nhắc khéo khi chi tiền nhập hàng.
- Xưng hô: "Lucky" và "Chủ tiệm" (hoặc "bạn").
- mascot_say luôn ≤25 từ, tiếng Việt rõ, không meme / slang Anh.

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
  "mascot_say": "Câu thoại thân thiện xác nhận ghi sổ hoặc chia sẻ cùng chủ tiệm",
  "mascot_emotion": "happy" | "thinking" | "warning" | "celebrate"
}
`;

export const CHAT_SYSTEM = CHAT_ASSISTANT_SYSTEM;

export type WebLlmGenerateOpts = {
  /** raw = prompt as-is (intent JSON); chat = kèm system trợ lý thông minh */
  mode?: 'chat' | 'raw';
  maxTokens?: number;
  systemPrompt?: string;
  temperature?: number;
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
    // Keep raw completions short — chat completions have budget for natural-language advice
    const maxTokens = opts?.maxTokens ?? (mode === 'raw' ? 256 : 768);
    const timeoutMs = mode === 'raw' ? 20_000 : 35_000;
    const temperature = opts?.temperature ?? (mode === 'raw' ? 0.1 : 0.6);
    const effectiveSystem =
      opts?.systemPrompt ?? (mode === 'chat' ? CHAT_ASSISTANT_SYSTEM : undefined);

    const run = async (): Promise<string> => {
      const controller = new AbortController();
      currentAbortController = controller;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const messages =
          mode === 'raw' || !effectiveSystem
            ? [{ role: 'user' as const, content: trimToContext(prompt, CONTEXT_WINDOW_SIZE, maxTokens) }]
            : [
              { role: 'system' as const, content: effectiveSystem },
              {
                role: 'user' as const,
                content: trimToContext(prompt, CONTEXT_WINDOW_SIZE, maxTokens, effectiveSystem.length),
              },
            ];

        const reply = await engine!.chat.completions.create({
          messages,
          max_tokens: maxTokens,
          temperature,
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
