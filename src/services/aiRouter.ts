/**
 * AI Router — Hybrid AI: WebLLM local + Gemini Cloud, with local command parsing.
 *
 * Routing logic (docs/11-hybrid-ai-design.md):
 *   1. SIMPLE (chat cơ bản, tổng hợp, hỏi đáp) → WebLLM Local
 *   2. MEDIUM (phân tích, so sánh) → Gemini nếu có API key + online, else WebLLM
 *   3. COMPLEX (OCR, dự báo, tạo báo cáo) → Gemini nếu có, else báo lỗi
 *
 * Command parsing: detects "thêm chi phí X do Y" etc. locally without AI, for instant data entry.
 *
 * Usage:
 *   import { aiRouter } from '@/services/aiRouter';
 *   const { text, source, action } = await aiRouter.sendMessage('Phân tích chi phí');
 */

import { geminiService } from './geminiService';
import { webLLM } from './webLLM';
import { useAuthStore } from '@/store/authStore';
import { createExpense } from './expenseService';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory, type ExpenseStatus, type PaymentMethod } from '@/models';
import {
  buildFinanceContext,
  intakeFromText,
  persistConfirmed,
  shouldAttachFinanceContext,
} from './intakeService';
import type { DraftRecord } from './draftTypes';

type RequestType = 'simple' | 'medium' | 'complex';
type AIProvider = 'local' | 'cloud';

function classifyRequest(message: string): RequestType {
  const complexKeywords = ['ocr', 'đọc ảnh', 'hóa đơn', 'ảnh', 'dự báo', 'dự đoán', 'báo cáo tổng hợp'];
  const mediumKeywords = ['phân tích', 'so sánh', 'bất thường', 'xu hướng', 'thống kê', 'tổng hợp'];

  const lower = message.toLowerCase();
  if (complexKeywords.some((k) => lower.includes(k))) return 'complex';
  if (mediumKeywords.some((k) => lower.includes(k))) return 'medium';
  return 'simple';
}

function isOnline(): boolean {
  return navigator.onLine;
}

async function getProvider(type: RequestType): Promise<AIProvider> {
  const { geminiConfigured } = useAuthStore.getState();
  const online = isOnline();

  switch (type) {
    case 'simple':
      // Prefer Gemini for better Vietnamese responses, fallback to local when offline
      if (geminiConfigured && online) return 'cloud';
      if (!webLLM.isLoaded && !webLLM.isLoading) {
        await webLLM.load();
      }
      return webLLM.isLoaded ? 'local' : 'cloud';

    case 'medium':
      // Prefer cloud if available, fallback to local
      if (geminiConfigured && online) return 'cloud';
      if (!webLLM.isLoaded && !webLLM.isLoading) await webLLM.load();
      return webLLM.isLoaded ? 'local' : 'cloud';

    case 'complex':
      // Must use cloud
      if (geminiConfigured && online) return 'cloud';
      // Can't do complex without cloud — try local anyway
      if (!webLLM.isLoaded && !webLLM.isLoading) await webLLM.load();
      return webLLM.isLoaded ? 'local' : 'cloud';
  }
}

export interface ChatAction {
  type: 'create_expense' | 'create_revenue';
  amount: number;
  description: string;
  category?: ExpenseCategory;
  customerName?: string;
}

// ─── Local Command Parser ──────────────────────────────────────────────────────

/**
 * Parse Vietnamese natural-language commands for instant data entry.
 * Handles: "thêm chi phí X do Y", "tạo khoản chi X Y"
 */
function parseLocalCommand(message: string): ChatAction | null {
  const lower = message.toLowerCase().trim();

  // ── Revenue patterns (check FIRST, before expense patterns) ──
  const revenuePatterns = [
    // "bán kẹp tóc 20k cho Hùng" / "bán nước 15k"
    /^bán\s+(.+?)\s+(\d+[kKmM]?)\s*(?:cho\s+(.+))?\s*$/i,
    // "bán cho Hùng kẹp tóc 20k"
    /^bán\s+cho\s+(.+?)\s+(.+?)\s+(\d+[kKmM]?)\s*$/i,
    // "thu 50k từ Hùng" / "thu 100k bán kẹp tóc"
    /^thu\s+(?:được\s+)?(\d+[kKmM]?)\s*(?:từ\s+(.+?)\s*)?(?:bán\s+(.+))?\s*$/i,
    // "doanh thu 100k bán nước"
    /^doanh thu\s+(\d+[kKmM]?)\s+(.+)/i,
    // "khách Hùng trả 50k"
    /^khách\s+(.+?)\s+trả\s+(\d+[kKmM]?)\s*(?:cho\s+(.+))?\s*$/i,
  ];

  for (const pattern of revenuePatterns) {
    const match = lower.match(pattern);
    if (match) {
      // Extract amount and description based on pattern
      let rawAmount: string, desc: string, customerName: string | undefined;

      if (pattern === revenuePatterns[0]) {
        // "bán X giá Y cho Z"
        desc = match[1]!;
        rawAmount = match[2]!;
        customerName = match[3] || undefined;
      } else if (pattern === revenuePatterns[1]) {
        // "bán cho Z X giá Y"
        customerName = match[1]!;
        desc = match[2]!;
        rawAmount = match[3]!;
      } else if (pattern === revenuePatterns[2]) {
        // "thu Y từ Z bán X"
        rawAmount = match[1]!;
        customerName = match[2] || undefined;
        desc = match[3] || (customerName ? `Bán hàng cho ${customerName}` : 'Doanh thu');
      } else if (pattern === revenuePatterns[3]) {
        // "doanh thu Y X"
        rawAmount = match[1]!;
        desc = match[2]!;
      } else if (pattern === revenuePatterns[4]) {
        // "khách Z trả Y cho X"
        customerName = match[1]!;
        rawAmount = match[2]!;
        desc = match[3] || `Bán hàng cho ${customerName}`;
      } else {
        continue;
      }

      desc = desc.replace(/\s+/g, ' ').trim();
      const amount = parseAmount(rawAmount);
      if (amount > 0 && desc.length > 1) {
        return {
          type: 'create_revenue',
          amount,
          description: desc,
          customerName: customerName || undefined,
        };
      }
    }
  }

  const expensePatterns = [
    // Pattern 1: "thêm chi phí X do Y" / "tạo khoản chi X Y"
    /(?:thêm|tạo|thêm mới)\s+(?:chi\s*phí|khoản\s*chi)\s+(\d+[kKmM]?)\s*(?:do|cho|vì|để|:|$)\s*(.+)/i,
    /(?:thêm|tạo|thêm mới)\s+(.+)\s+(\d+[kKmM]?)\s*(?:đồng|k|vnđ)?\s*$/i,
    // Pattern 2: "đổ xăng 30k" / "uống nước 12k" / "cà phê 25k" / "uống nước 10000"
    /^(.+)\s+(\d+[kKmM]?)\s*$/i,
    // Pattern 3: "30k đổ xăng" / "12000 nước"
    /^(\d+[kKmM]?)\s+(.+)$/i,
    // Pattern 4: "chi 30k xăng" / "trả 50000 tiền điện"
    /^(?:chi|trả|thanh toán|đóng)\s+(\d+[kKmM]?)\s+(.+)/i,
    // Pattern 5: "mua nước 12k" / "mua cà phê 30000"
    /^mua\s+(.+)\s+(\d+[kKmM]?)\s*$/i,
    // Pattern 6: "đổ xăng hết 30k" / "ăn sáng hết 25000"
    /^(.+)\s+hết\s+(\d+[kKmM]?)\s*$/i,
  ];

  for (const pattern of expensePatterns) {
    const match = lower.match(pattern);
    if (match) {
      const hasAmountFirst = pattern === expensePatterns[0] || pattern === expensePatterns[3] || pattern === expensePatterns[4];
      const hasAmountLast = pattern === expensePatterns[2] || pattern === expensePatterns[5] || pattern === expensePatterns[6];
      let rawAmount: string, desc: string;

      if (hasAmountFirst) {
        rawAmount = match[1]!;
        desc = (match[2] ?? match[1]!).trim();
        // If pattern 3 or 4, desc might have extra words after amount — already handled
        if (pattern === expensePatterns[3] || pattern === expensePatterns[4]) {
          desc = match[2]!;
        }
      } else if (hasAmountLast) {
        desc = match[1]!;
        rawAmount = match[2]!;
      } else {
        // Pattern 1: amount first, desc second
        rawAmount = match[1]!;
        desc = match[2]!;
        if (pattern === expensePatterns[1]) {
          desc = match[1]!;
          rawAmount = match[2]!;
        }
      }

      desc = desc.replace(/\s+/g, ' ').trim();
      const amount = parseAmount(rawAmount);
      if (amount > 0 && desc.length > 1) {
        return { type: 'create_expense', amount, description: desc, category: guessCategory(desc) };
      }
    }
  }
  return null;
}

/** Parse AI response for embedded ```action JSON block */
function parseAiAction(text: string): { cleanText: string; action?: ChatAction } {
  const actionMatch = text.match(/```action\n([\s\S]*?)\n```/);
  if (!actionMatch) return { cleanText: text };

  try {
    const action = JSON.parse(actionMatch[1]!);
    const cleanText = text.replace(/```action\n[\s\S]*?\n```/, '').trim();
    if (action.type === 'create_expense' && action.amount > 0 && action.description) {
      return {
        cleanText,
        action: {
          type: 'create_expense',
          amount: action.amount,
          description: action.description,
          category: action.category || 'other',
        },
      };
    }
    if (action.type === 'create_revenue' && action.amount > 0 && action.description) {
      return {
        cleanText,
        action: {
          type: 'create_revenue',
          amount: action.amount,
          description: action.description,
          customerName: action.customerName,
        },
      };
    }
  } catch { /* ignore malformed JSON */ }

  return { cleanText: text.replace(/```action\n[\s\S]*?\n```/, '').trim() };
}

function parseAmount(raw: string): number {
  if (/^\d+k$/i.test(raw)) return parseFloat(raw) * 1000;
  if (/^\d+m$/i.test(raw)) return parseFloat(raw) * 1_000_000;
  const n = parseInt(raw, 10);
  return (n > 0 && n < 1000 && raw.length <= 3) ? n * 1000 : n;
}

function guessCategory(desc: string): ExpenseCategory {
  // Comprehensive keyword mapping based on actual category definitions
  const catMap: [string, ExpenseCategory][] = [
    // office — Văn phòng phẩm
    ['văn phòng', 'office'], ['bút', 'office'], ['giấy', 'office'], ['mực in', 'office'],
    ['in ấn', 'office'], ['photo', 'office'], ['văn phòng phẩm', 'office'],
    ['ăn sáng', 'office'], ['ăn trưa', 'office'], ['ăn tối', 'office'], ['ăn vặt', 'office'],
    ['cà phê', 'office'], ['cafe', 'office'], ['trà', 'office'], ['nước uống', 'office'],
    ['nước', 'office'], ['đồ ăn', 'office'], ['bữa ăn', 'office'], ['tiếp khách', 'office'],
    // rent — Thuê mặt bằng
    ['thuê nhà', 'rent'], ['thuê mặt bằng', 'rent'], ['tiền thuê', 'rent'],
    ['mặt bằng', 'rent'], ['nhà xưởng', 'rent'], ['kho', 'rent'],
    // utilities — Điện, nước, internet
    ['tiền điện', 'utilities'], ['hóa đơn điện', 'utilities'], ['điện', 'utilities'],
    ['nước máy', 'utilities'], ['internet', 'utilities'], ['mạng', 'utilities'],
    ['wifi', 'utilities'], ['cước', 'utilities'], ['điện thoại', 'utilities'],
    // salary — Lương nhân viên
    ['lương', 'salary'], ['thưởng', 'salary'], ['nhân viên', 'salary'],
    ['bảo hiểm', 'salary'], ['bhxh', 'salary'], ['công lao động', 'salary'],
    // marketing — Marketing, quảng cáo
    ['quảng cáo', 'marketing'], ['marketing', 'marketing'], ['pr', 'marketing'],
    ['tờ rơi', 'marketing'], ['facebook ads', 'marketing'], ['google ads', 'marketing'],
    ['seo', 'marketing'], ['truyền thông', 'marketing'], ['sự kiện', 'marketing'],
    // supplies — Nguyên vật liệu
    ['nguyên liệu', 'supplies'], ['vật liệu', 'supplies'], ['vật tư', 'supplies'],
    ['nguyên vật liệu', 'supplies'], ['dụng cụ', 'supplies'], ['thiết bị', 'supplies'],
    ['mua sắm', 'supplies'],
    // transportation — Vận chuyển, xăng xe
    ['xăng', 'transportation'], ['dầu', 'transportation'], ['xe', 'transportation'],
    ['vận chuyển', 'transportation'], ['ship', 'transportation'], ['giao hàng', 'transportation'],
    ['gửi xe', 'transportation'], ['taxi', 'transportation'], ['grab', 'transportation'],
    ['cước vận', 'transportation'], ['phí đường', 'transportation'],
    // maintenance — Bảo trì, sửa chữa
    ['sửa', 'maintenance'], ['bảo trì', 'maintenance'], ['bảo dưỡng', 'maintenance'],
    ['sửa chữa', 'maintenance'], ['thay thế', 'maintenance'], ['hỏng', 'maintenance'],
    // tax — Thuế, phí
    ['thuế', 'tax'], ['phí ngân hàng', 'tax'], ['phí dịch vụ', 'tax'],
    ['phí thường niên', 'tax'], ['lệ phí', 'tax'],
  ];

  const lower = desc.toLowerCase();
  for (const [kw, cat] of catMap) {
    if (lower.includes(kw)) return cat;
  }
  return 'other';
}

/** Build category list string for AI system prompts */
function buildCategoryList(): string {
  return Object.entries(EXPENSE_CATEGORY_LABELS)
    .map(([key, label]) => `  - ${key} = ${label}`)
    .join('\n');
}

// ─── Chat History & Auto-Compact ────────────────────────────────────────────────

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  messages: HistoryEntry[];
}

interface HistoryEntry { role: 'user' | 'assistant'; content: string; }
const STORAGE_KEY = 'ql-tc-chat-threads';
const MAX_THREADS = 50;
const MAX_MESSAGES_PER_THREAD = 40;

let threads: ChatThread[] = [];
let activeThreadId: string | null = null;

/** Load persisted threads from localStorage */
function loadThreads(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatThread[];
      if (Array.isArray(parsed)) {
        // Drop empty placeholder threads left by older versions
        threads = parsed
          .filter((t) => Array.isArray(t.messages) && t.messages.length > 0)
          .slice(-MAX_THREADS);
        saveThreads();
      }
    }
  } catch { /* ignore corrupt data */ }
}

/** Save threads to localStorage */
function saveThreads(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(-MAX_THREADS)));
  } catch { /* storage full */ }
}

/** Get current thread messages */
function currentMessages(): HistoryEntry[] {
  const t = threads.find(th => th.id === activeThreadId);
  return t?.messages ?? [];
}

/** Auto-compact messages if too long */
function compactMessages(msgs: HistoryEntry[]): HistoryEntry[] {
  if (msgs.length > MAX_MESSAGES_PER_THREAD) {
    msgs = msgs.slice(-MAX_MESSAGES_PER_THREAD);
  }
  if (msgs.length > 30) {
    const old = msgs.slice(0, msgs.length - 10);
    const recent = msgs.slice(-10);
    const summary = old.map(e => `[${e.role === 'user' ? 'U' : 'A'}]: ${e.content.slice(0, 60)}...`).join(' | ');
    return [{ role: 'assistant', content: `[Tóm tắt]: ${summary}` }, ...recent];
  }
  return msgs;
}

// Load on module init
loadThreads();

/** Build context from current thread's messages */
function buildHistoryContext(): string {
  const msgs = currentMessages();
  if (msgs.length === 0) return '';
  return msgs.map(e =>
    e.role === 'user' ? `User: ${e.content}` : `AI: ${e.content}`
  ).join('\n');
}

/** Add to current thread, auto-create if none active */
function addToHistory(userMsg: string, aiMsg: string): void {
  if (!activeThreadId) {
    activeThreadId = crypto.randomUUID();
  }
  let t = threads.find((th) => th.id === activeThreadId);
  if (!t) {
    t = {
      id: activeThreadId,
      title: userMsg.slice(0, 60),
      createdAt: new Date().toISOString(),
      messages: [],
    };
    threads.unshift(t);
  } else if (t.messages.length === 0 && t.title === 'Cuộc trò chuyện mới') {
    t.title = userMsg.slice(0, 60);
  }
  t.messages.push({ role: 'user', content: userMsg });
  t.messages.push({ role: 'assistant', content: aiMsg });
  t.messages = compactMessages(t.messages);
  saveThreads();
}

export const aiRouter = {
  get isConfigured(): boolean {
    return geminiService.isConfigured || webLLM.isLoaded;
  },

  // ── Thread management ─────────────────────────────────────────────────

  /**
   * Start a new chat thread.
   * If the current thread is still empty, do not create another — returns created:false.
   */
  newThread(): { id: string; created: boolean } {
    const current = activeThreadId
      ? threads.find((th) => th.id === activeThreadId)
      : undefined;

    // Active empty thread (or no messages yet in UI-only session)
    if (current && current.messages.length === 0) {
      return { id: current.id, created: false };
    }
    // No persisted active thread yet — keep a soft id without listing empty chats
    if (!activeThreadId || !current) {
      // If nothing was ever said, reuse soft session instead of stacking empties
      if (!activeThreadId) {
        activeThreadId = crypto.randomUUID();
        return { id: activeThreadId, created: false };
      }
      // active id exists but not in list (soft session after previous newThread) — still empty
      return { id: activeThreadId, created: false };
    }

    activeThreadId = crypto.randomUUID();
    // Do not persist empty thread until first real message (addToHistory)
    return { id: activeThreadId, created: true };
  },

  /** True when active thread has no saved messages (still empty). */
  isActiveThreadEmpty(): boolean {
    if (!activeThreadId) return true;
    const current = threads.find((th) => th.id === activeThreadId);
    return !current || current.messages.length === 0;
  },

  /** Switch to an existing thread */
  switchThread(id: string): HistoryEntry[] {
    activeThreadId = id;
    return currentMessages();
  },

  /** Get all threads (for history list) — hide empty placeholders */
  getThreads(): ChatThread[] {
    return threads.filter((t) => t.messages.length > 0);
  },

  /** Delete a thread */
  deleteThread(id: string): void {
    threads = threads.filter((t) => t.id !== id);
    if (activeThreadId === id) activeThreadId = null;
    saveThreads();
  },

  /** Get current thread ID */
  getActiveThreadId(): string | null {
    return activeThreadId;
  },

  // ── Messaging ─────────────────────────────────────────────────────────

  async sendMessage(
    message: string,
    context?: string,
  ): Promise<{
    text: string;
    source: 'local' | 'cloud';
    action?: ChatAction;
    drafts?: DraftRecord[];
    createdRecord?: { kind: 'expense' | 'revenue'; id: string };
  }> {
    // 1. Text/voice create → persist immediately (no preview)
    const localIntake = intakeFromText(message, 'text');
    if (localIntake?.drafts?.length) {
      const draft = localIntake.drafts[0]!;
      try {
        const { ok, failed, created } = await persistConfirmed([draft]);
        if (ok > 0) {
          const kindLabel = draft.kind === 'expense' ? 'chi phí' : 'doanh thu';
          const fxNote = draft.rawFx
            ? ` (${draft.rawFx.original} ${draft.rawFx.currency})`
            : '';
          const qtyNote =
            draft.kind === 'revenue' && (draft.quantity ?? 1) > 1
              ? ` · SL **${draft.quantity}**`
              : '';
          const customerNote =
            draft.kind === 'revenue' && draft.customerName
              ? ` · khách **${draft.customerName}**`
              : '';
          const text = `✅ Đã thêm ${kindLabel}: **${draft.description}** — ${draft.amount.toLocaleString('vi-VN')}₫${fxNote}${qtyNote}${customerNote}`;
          addToHistory(message, text);
          return {
            text,
            source: 'local',
            createdRecord: created[0]
              ? { kind: created[0].kind, id: created[0].id }
              : undefined,
          };
        }
        const errText = `❌ Không lưu được: ${failed.join('; ')}`;
        addToHistory(message, errText);
        return { text: errText, source: 'local' };
      } catch (err) {
        const errText = `❌ Lỗi lưu: ${err instanceof Error ? err.message : 'Unknown'}`;
        addToHistory(message, errText);
        return { text: errText, source: 'local' };
      }
    }

    const localAction = parseLocalCommand(message);
    if (localAction) {
      const result = await this.executeAction(localAction);
      const text = result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
      addToHistory(message, text);
      return { text, source: 'local' };
    }

    // 1b. Help
    const lower = message.toLowerCase().trim();
    if (lower === 'help' || lower === 'hướng dẫn' || lower === '?' || lower === 'cách dùng' || lower === 'giúp đỡ') {
      const helpText = `📋 **Hướng dẫn sử dụng AI Chat:**

**Thêm chi phí** — gõ là lưu ngay:
• \`cà phê 25k\` • \`đổ xăng 30k\` • \`chi 50k ăn trưa\` • \`mua bút 15 USD\`
• \`thanh toán 2tr tiền thuê\` • \`xăng 30\`

**Thêm doanh thu** — gõ là lưu ngay:
• \`bán kẹp tóc 20k cho Hùng\` • \`thu 50k từ Hùng\` • \`doanh thu 200k bán mỹ phẩm\`

**Đính kèm (cần Xác nhận):** ảnh/PDF hóa đơn (OCR), CSV/XLS import.

**Giọng nói:** bấm 🎤 → nói → gửi (lưu như text).

**Phân tích:** "Tổng quan tháng" • "Phân tích chi phí" • "Lợi nhuận tháng này"`;
      addToHistory(message, helpText);
      return { text: helpText, source: 'local' };
    }

    // 2. Chat / analysis
    const history = buildHistoryContext();
    const parts: string[] = [];
    const financeCtx = context ?? (shouldAttachFinanceContext(message) ? buildFinanceContext() : undefined);
    if (financeCtx) parts.push(financeCtx);
    if (history) parts.push(`Lịch sử chat:\n${history}`);
    parts.push(`Người dùng: ${message}`);
    const fullContext = parts.join('\n\n');
    const type = classifyRequest(message);
    const provider = await getProvider(type);

    const toResult = async (rawText: string, source: 'local' | 'cloud') => {
      const { cleanText, action } = parseAiAction(rawText);
      // Text path: AI create actions also persist immediately
      if (action) {
        const result = await this.executeAction(action);
        const text = result.success
          ? `${cleanText ? `${cleanText}\n\n` : ''}✅ ${result.message}`
          : `${cleanText ? `${cleanText}\n\n` : ''}❌ ${result.message}`;
        addToHistory(message, text);
        return { text, source };
      }
      addToHistory(message, cleanText);
      return { text: cleanText, source };
    };

    if (provider === 'cloud' && geminiService.isConfigured) {
      try {
        const rawText = await geminiService.generateContent(fullContext);
        if (rawText && !rawText.startsWith('Lỗi Gemini:')) {
          return toResult(rawText, 'cloud');
        }
      } catch {
        // auto-fallback
      }
    }

    if (webLLM.isLoaded) {
      try {
        const rawText = await webLLM.generate(fullContext);
        return toResult(rawText, 'local');
      } catch {
        // fall through
      }
    } else if (!webLLM.isLoading) {
      void webLLM.load();
    }

    const fallback = '🤖 AI cloud không dùng được và model offline chưa sẵn sàng.\n\n• Đợi WebLLM tải xong, hoặc\n• Vào Cài đặt → nhập Gemini API key\n\nBạn vẫn thêm chi/thu bằng câu rõ (vd: `cà phê 25k`) hoặc đính kèm CSV.';
    addToHistory(message, fallback);
    return { text: fallback, source: 'local' };
  },

  /** Execute a chat action (e.g. create expense / revenue from AI command). */
  async executeAction(action: ChatAction): Promise<{ success: boolean; message: string }> {
    const today = new Date().toISOString().slice(0, 10);

    if (action.type === 'create_expense') {
      createExpense({
        date: today,
        category: action.category ?? 'other',
        amount: action.amount,
        description: action.description,
        status: 'pending' as ExpenseStatus,
        paymentMethod: 'cash' as PaymentMethod,
        tags: [],
      });
      return { success: true, message: `Đã thêm chi phí "${action.description}" — ${action.amount.toLocaleString('vi-VN')}₫` };
    }

    if (action.type === 'create_revenue') {
      // Auto-create customer if name provided
      let customerId = 'walk-in';
      if (action.customerName) {
        const { useCustomerStore } = await import('@/store/customerStore');
        const { generateId } = await import('@/utils/id');
        const customers = useCustomerStore.getState().customers;
        const existing = customers.find(c =>
          c.name.toLowerCase() === action.customerName!.toLowerCase()
        );
        if (existing) {
          customerId = existing.id;
        } else {
          customerId = generateId();
          useCustomerStore.getState().addCustomer({
            id: customerId,
            name: action.customerName!,
            phone: '',
            email: '',
            address: '',
            createdAt: new Date().toISOString(),
          });
        }
      }

      const { createRevenue } = await import('./revenueService');
      const { generateId } = await import('@/utils/id');
      const itemId = generateId();
      await createRevenue({
        date: today,
        customerId,
        items: [{
          id: itemId,
          name: action.description || 'Sản phẩm',
          quantity: 1,
          unitPrice: action.amount,
          total: action.amount,
        }],
        discount: 0,
        orderStatus: 'new',
        deliveryStatus: 'pending',
        paymentMethod: 'cash' as PaymentMethod,
        notes: action.customerName ? `Khách: ${action.customerName}` : undefined,
      });
      return { success: true, message: `Đã thêm doanh thu "${action.description}" — ${action.amount.toLocaleString('vi-VN')}₫` };
    }

    return { success: false, message: 'Không rõ hành động' };
  },

  async analyzeExpenses(data: unknown): Promise<string> {
    const prompt = `Phân tích dữ liệu chi phí sau, trả lời bằng tiếng Việt:\n${JSON.stringify(data, null, 2)}`;
    const { text } = await this.sendMessage(prompt);
    return text;
  },

  async ocrInvoice(imageBase64: string): Promise<{
    date: string;
    amount: number;
    category: string;
    description: string;
    supplier: string;
  } | null> {
    if (geminiService.isConfigured && navigator.onLine) {
      return geminiService.ocrInvoice(imageBase64);
    }
    console.warn('OCR: Gemini unavailable — use intakeService.intakeFromFile for Tesseract fallback');
    return null;
  },
};
