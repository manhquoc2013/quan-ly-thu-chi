/**
 * WebLLM Service — Local AI running in the browser via WebGPU.
 *
 * Qwen3-4B (~2.7GB first download, cached in IndexedDB).
 * Context window raised above default 4K so long EXTRACT_PROMPT + data fits.
 */

import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';

const MODEL_ID = 'Qwen3-4B-q4f16_1-MLC';
/** Qwen3-4B supports 32K; 8K keeps VRAM reasonable on mid-range GPUs */
const CONTEXT_WINDOW_SIZE = 8192;

let engine: MLCEngine | null = null;
let loading = false;
let loaded = false;
let loadPercent = 0;
let loadText = '';

const CHAT_SYSTEM = `Bạn là "Trợ lý Tài Chính". Trả lời tiếng Việt, ngắn gọn.
Chỉ thêm action khi user yêu cầu tạo dữ liệu rõ ràng:
\`\`\`action
{"type":"create_expense"|"create_revenue","amount":N,"description":"...","category":"other"}
\`\`\`
category: office|rent|utilities|salary|marketing|supplies|transportation|maintenance|tax|other.
Hỏi phân tích/chat thường: trả lời, KHÔNG action. 12k=12000, 1.5m=1500000.`;

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

  async load(): Promise<boolean> {
    if (loaded) return true;
    if (loading) {
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
      engine = await CreateMLCEngine(
        MODEL_ID,
        {
          initProgressCallback: (report) => {
            loadPercent = Math.round(report.progress * 100);
            loadText = report.text;
            console.log(`WebLLM: ${loadPercent}% — ${report.text}`);
          },
        },
        { context_window_size: CONTEXT_WINDOW_SIZE },
      );
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
   */
  async generate(prompt: string, opts?: WebLlmGenerateOpts): Promise<string> {
    if (!engine) {
      if (!loading) await this.load();
    }
    if (!engine) return fallback(prompt);

    const mode = opts?.mode ?? 'chat';
    const maxTokens = opts?.maxTokens ?? (mode === 'raw' ? 512 : 1024);

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

      const reply = await engine.chat.completions.create({
        messages,
        max_tokens: maxTokens,
        temperature: mode === 'raw' ? 0.2 : 0.7,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        enable_thinking: false,
      } as any);

      let content = reply.choices[0]?.message?.content ?? '[Không có phản hồi]';
      content = content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/<think>[\s\S]*$/, '')
        .trim();
      return content || '[Không có phản hồi]';
    } catch (err) {
      console.error('WebLLM generate error:', err);
      return `Lỗi sinh văn bản: ${err instanceof Error ? err.message : 'Unknown'}`;
    }
  },

  async unload(): Promise<void> {
    engine = null;
    loaded = false;
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
