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
    if (action.type === 'create_expense' && action.amount > 0 && action.description) {
      const cleanText = text.replace(/```action\n[\s\S]*?\n```/, '').trim();
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
  } catch { /* ignore malformed JSON */ }

  // Remove the block even if unparseable
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
      if (Array.isArray(parsed)) threads = parsed.slice(-MAX_THREADS);
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
    threads.unshift({
      id: activeThreadId,
      title: userMsg.slice(0, 60),
      createdAt: new Date().toISOString(),
      messages: [],
    });
  }
  const t = threads.find(th => th.id === activeThreadId);
  if (t) {
    t.messages.push({ role: 'user', content: userMsg });
    t.messages.push({ role: 'assistant', content: aiMsg });
    t.messages = compactMessages(t.messages);
    saveThreads();
  }
}

export const aiRouter = {
  get isConfigured(): boolean {
    return geminiService.isConfigured || webLLM.isLoaded;
  },

  // ── Thread management ─────────────────────────────────────────────────

  /** Start a new chat thread */
  newThread(): string {
    activeThreadId = crypto.randomUUID();
    threads.unshift({
      id: activeThreadId,
      title: 'Cuộc trò chuyện mới',
      createdAt: new Date().toISOString(),
      messages: [],
    });
    saveThreads();
    return activeThreadId;
  },

  /** Switch to an existing thread */
  switchThread(id: string): HistoryEntry[] {
    activeThreadId = id;
    return currentMessages();
  },

  /** Get all threads (for history list) */
  getThreads(): ChatThread[] {
    return [...threads];
  },

  /** Delete a thread */
  deleteThread(id: string): void {
    threads = threads.filter(t => t.id !== id);
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
  ): Promise<{ text: string; source: 'local' | 'cloud'; action?: ChatAction }> {
    // 1. Try local command parsing first (instant, no AI needed)
    const localAction = parseLocalCommand(message);
    if (localAction) {
      addToHistory(message, `Đã thêm chi phí: ${localAction.description} — ${localAction.amount.toLocaleString('vi-VN')}₫`);
      return {
        text: `✅ Đã thêm chi phí: **${localAction.description}** — ${localAction.amount.toLocaleString('vi-VN')}₫`,
        source: 'local',
        action: localAction,
      };
    }

    // 1b. Help command — give usage guide
    const lower = message.toLowerCase().trim();
    if (lower === 'help' || lower === 'hướng dẫn' || lower === '?' || lower === 'cách dùng' || lower === 'giúp đỡ') {
      const helpText = `📋 **Hướng dẫn sử dụng AI Chat:**

**Thêm chi phí** — gõ tự nhiên:
• \`cà phê 25k\` • \`đổ xăng 30k\` • \`uống nước 10000\`
• \`chi 50k ăn trưa\` • \`mua bút 15k\` • \`ăn sáng hết 30k\`

**Phân tích dữ liệu:**
• "Tổng quan tháng" — xem tổng thu chi
• "Phân tích chi phí" — phân tích theo danh mục
• "Dự báo" — dự đoán xu hướng

**Hỏi đáp tự do** về tài chính, quản lý chi tiêu.

💡 Chat tự động nhớ lịch sử và tự tóm tắt khi dài.`;
      addToHistory(message, helpText);
      return { text: helpText, source: 'local' };
    }

    // 2. Build prompt with history + data context
    const history = buildHistoryContext();
    const parts: string[] = [];
    if (context) parts.push(context);
    if (history) parts.push(`Lịch sử chat:\n${history}`);
    parts.push(`Người dùng: ${message}`);
    const fullContext = parts.join('\n\n');
    const type = classifyRequest(message);
    const provider = await getProvider(type);

    if (provider === 'cloud' && geminiService.isConfigured) {
      const rawText = await geminiService.generateContent(fullContext);
      const { cleanText, action } = parseAiAction(rawText);
      addToHistory(message, cleanText);
      return { text: cleanText, source: 'cloud', action };
    }

    if (provider === 'local' && webLLM.isLoaded) {
      const rawText = await webLLM.generate(fullContext);
      const { cleanText, action } = parseAiAction(rawText);
      addToHistory(message, cleanText);
      return { text: cleanText, source: 'local', action };
    }

    const fallback = '🤖 Cả hai AI provider đều chưa sẵn sàng.\n\n• Để dùng AI offline: đợi model tải xong\n• Để dùng AI online: vào Cài đặt → nhập Gemini API key';
    addToHistory(message, fallback);
    return { text: fallback, source: 'local' };
  },

  /** Execute a chat action (e.g. create expense from AI command). */
  executeAction(action: ChatAction): { success: boolean; message: string } {
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
      const itemId = crypto.randomUUID();
      import('./revenueService').then(({ createRevenue }) => {
        createRevenue({
          date: today,
          customerId: 'walk-in',
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
    if (!geminiService.isConfigured) {
      console.warn('OCR requires Gemini API key');
      return null;
    }
    return geminiService.ocrInvoice(imageBase64);
  },
};
