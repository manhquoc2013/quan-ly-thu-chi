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
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/models';
import {
  buildFinanceContext,
  intakeFromText,
  persistConfirmed,
  shouldAttachFinanceContext,
} from './intakeService';
import type { DraftRecord } from './draftTypes';
import {
  type ChatIntent,
  type PendingChatState,
  clarifyQuestion,
  isCancelMessage,
  isConfirmMessage,
  mergeClarifyReply,
  mergeIntent,
  parseEntityPickIndex,
  draftToCreateIntent,
} from './chatIntent';
import {
  extractChatIntent,
  generateChatReply,
  mergeIntentWithLlm,
} from './llmIntentExtractor';
import { extractBulkDrafts } from './llmBulkDraftExtractor';
import {
  isHighConfidenceDraft,
  looksLikeBulkLineList,
  looksLikeCustomerSale,
  parseLineListDrafts,
  parseTextToDraft,
  shouldDeferCreateToLlm,
} from './textDraftParser';
import { parseOrderTableDrafts } from './orderTableParser';
import { executeChatIntent, executeLegacyCreate } from './chatTools';
import { formatEntityPickMessage } from './entityResolve';

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
 * Prefer shared textDraftParser so "{khách} mua/lấy …" is never misclassified.
 */
function parseLocalCommand(message: string): ChatAction | null {
  const draft = parseTextToDraft(message);
  if (draft?.kind === 'revenue' && draft.amount > 0 && draft.description) {
    return {
      type: 'create_revenue',
      amount: draft.amount,
      description: draft.description,
      customerName: draft.customerName,
    };
  }
  if (draft?.kind === 'expense' && draft.amount > 0 && draft.description) {
    return {
      type: 'create_expense',
      amount: draft.amount,
      description: draft.description,
      category: draft.category ?? guessCategory(draft.description),
    };
  }

  const lower = message.toLowerCase().trim();
  // Legacy catch-all below must not eat customer-sale phrases
  if (looksLikeCustomerSale(lower)) return null;

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

/** Pending multi-turn slot-fill / delete confirm per thread */
const pendingByThread = new Map<string, PendingChatState>();

function getPending(): PendingChatState | undefined {
  if (!activeThreadId) return undefined;
  return pendingByThread.get(activeThreadId);
}

function setPending(state: PendingChatState | null): void {
  if (!activeThreadId) {
    activeThreadId = crypto.randomUUID();
  }
  if (!state) {
    pendingByThread.delete(activeThreadId);
    return;
  }
  pendingByThread.set(activeThreadId, { ...state, updatedAt: Date.now() });
}

function looksLikeToolIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /\b(thêm|tạo|ghi|chi|thu|bán|mua|lấy|đặt|nhập|order|sửa|cập nhật|xóa|xoá|đổi|hủy đơn|huỷ đơn|tra|tìm|liệt kê|tổng quan|phân tích|bao nhiêu|zalo|shopee)\b/i.test(
      lower,
    ) || shouldDeferCreateToLlm(lower)
  );
}

async function persistBulkDrafts(
  drafts: DraftRecord[],
  skipped: string[],
): Promise<{
  text: string;
  lastCreated?: { kind: 'expense' | 'revenue'; id: string };
}> {
  const expenseDrafts = drafts.filter((d) => d.kind === 'expense');
  const revenueDrafts = drafts.filter((d) => d.kind === 'revenue');
  const lines: string[] = [];
  let lastCreated: { kind: 'expense' | 'revenue'; id: string } | undefined;
  let okCount = 0;
  let totalAmount = 0;

  if (expenseDrafts.length) {
    const { created, failed } = await persistConfirmed(expenseDrafts);
    okCount += created.length;
    totalAmount += created.reduce((s, c) => s + c.amount, 0);
    if (created[0]) lastCreated = { kind: created[0].kind, id: created[0].id };
    if (failed[0] && created.length === 0) lines.push(`❌ ${failed[0]}`);
  }

  const tableRevenues = revenueDrafts.filter((d) => (d.orderItems?.length ?? 0) > 0);
  const simpleRevenues = revenueDrafts.filter((d) => !(d.orderItems?.length ?? 0));

  if (tableRevenues.length) {
    const { created, failed } = await persistConfirmed(tableRevenues);
    okCount += created.length;
    totalAmount += created.reduce((s, c) => s + c.amount, 0);
    if (created[0]) lastCreated = { kind: created[0].kind, id: created[0].id };
    created.forEach((c) => {
      lines.push(
        `✅ đơn **${c.customerName ?? c.description}** — ${c.amount.toLocaleString('vi-VN')}₫`,
      );
    });
    if (failed[0] && created.length === 0) lines.push(`❌ ${failed[0]}`);
  }

  for (const rd of simpleRevenues) {
    const out = await runIntentTool(draftToCreateIntent(rd));
    if (out.createdRecord) {
      okCount += 1;
      totalAmount += rd.amount;
      lastCreated = out.createdRecord;
      lines.push(out.text);
    } else {
      lines.push(out.text);
    }
    if (getPending()?.awaitingEntityPick) break;
  }

  const kindLabel =
    expenseDrafts.length && !revenueDrafts.length
      ? 'chi phí'
      : revenueDrafts.length && !expenseDrafts.length
        ? 'doanh thu'
        : 'giao dịch';

  const summary =
    okCount > 0
      ? `✅ Đã thêm **${okCount}** ${kindLabel} (tổng ${totalAmount.toLocaleString('vi-VN')}₫)`
      : '⚠️ Không lưu được khoản nào.';

  for (const s of skipped.slice(0, 5)) {
    lines.push(`⚠️ Bỏ qua: ${s}`);
  }
  if (skipped.length > 5) lines.push(`⚠️ … và ${skipped.length - 5} dòng khác`);

  return {
    text: [summary, ...lines].filter(Boolean).join('\n'),
    lastCreated,
  };
}

async function runIntentTool(
  intent: ChatIntent,
  opts?: { deleteConfirmed?: boolean },
): Promise<{
  text: string;
  source: 'local' | 'cloud';
  createdRecord?: { kind: 'expense' | 'revenue'; id: string };
}> {
  const result = await executeChatIntent(intent, opts);
  if (result.needDeleteConfirm) {
    setPending({ intent, awaitingDeleteConfirm: true, updatedAt: Date.now() });
    return { text: `⚠️ ${result.message}`, source: 'local', createdRecord: result.createdRecord };
  }
  if (result.needEntityPick) {
    setPending({
      intent,
      awaitingEntityPick: result.needEntityPick,
      updatedAt: Date.now(),
    });
    return { text: result.message, source: 'local' };
  }
  if (!result.ok) {
    if (result.matchedMultiple?.length) {
      setPending({ intent, updatedAt: Date.now() });
    }
    return { text: `❌ ${result.message}`, source: 'local' };
  }
  setPending(null);
  return {
    text: `✅ ${result.message}`,
    source: 'local',
    createdRecord: result.createdRecord,
  };
}

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

    if (activeThreadId) pendingByThread.delete(activeThreadId);
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
    pendingByThread.delete(id);
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
    const trimmed = message.trim();
    if (!trimmed) {
      return { text: 'Bạn chưa nhập gì.', source: 'local' };
    }

    const financeCtx = context ?? (shouldAttachFinanceContext(trimmed) ? buildFinanceContext() : buildFinanceContext());
    const history = buildHistoryContext();

    // ── 0. Pending multi-turn (slot-fill / delete confirm) ───────────────
    const pending = getPending();
    if (pending) {
      if (isCancelMessage(trimmed)) {
        setPending(null);
        const text = 'Đã hủy thao tác đang chờ.';
        addToHistory(trimmed, text);
        return { text, source: 'local' };
      }

      if (pending.awaitingDeleteConfirm) {
        if (isConfirmMessage(trimmed)) {
          const out = await runIntentTool(pending.intent, { deleteConfirmed: true });
          addToHistory(trimmed, out.text);
          return out;
        }
        const text = 'Gõ **xác nhận** để xóa, hoặc **hủy** để bỏ.';
        addToHistory(trimmed, text);
        return { text, source: 'local' };
      }

      if (pending.awaitingEntityPick) {
        const idx = parseEntityPickIndex(trimmed);
        const { kind, query, options } = pending.awaitingEntityPick;
        if (idx === null || idx < 0 || idx > options.length) {
          const text = formatEntityPickMessage(kind, query, options);
          addToHistory(trimmed, text);
          return { text, source: 'local' };
        }
        const nextIntent: ChatIntent = { ...pending.intent };
        if (kind === 'customer') {
          if (idx === 0) {
            nextIntent.forceNewCustomer = true;
            nextIntent.customerId = undefined;
          } else {
            nextIntent.customerId = options[idx - 1]!.id;
            nextIntent.forceNewCustomer = false;
          }
        } else if (kind === 'product') {
          if (idx === 0) {
            nextIntent.forceNewProduct = true;
            nextIntent.productId = undefined;
          } else {
            nextIntent.productId = options[idx - 1]!.id;
            nextIntent.forceNewProduct = false;
          }
        } else if (idx === 0) {
          nextIntent.forceNewPlatform = true;
          nextIntent.platformId = undefined;
        } else {
          nextIntent.platformId = options[idx - 1]!.id;
          nextIntent.forceNewPlatform = false;
        }
        const out = await runIntentTool(nextIntent);
        addToHistory(trimmed, out.text);
        return out;
      }

      let merged =
        (await mergeIntentWithLlm(pending.intent, trimmed, financeCtx)) ??
        mergeClarifyReply(pending.intent, trimmed);
      merged = mergeIntent(pending.intent, merged);

      if (merged.missing.length > 0) {
        setPending({ intent: merged, updatedAt: Date.now() });
        const text = clarifyQuestion(merged);
        addToHistory(trimmed, text);
        return { text, source: 'local' };
      }

      const out = await runIntentTool(merged);
      addToHistory(trimmed, out.text);
      return out;
    }

    // ── 1. Regex fast-path create (supports multi-clause + line-list) ───
    const localIntake = intakeFromText(trimmed, 'text');
    let bulkDrafts = localIntake?.drafts?.length ? localIntake.drafts : null;
    let bulkSkipped: string[] = [];

    // Soft/catch-all (confidence thấp) hoặc câu mơ hồ bị parse thành expense → LLM
    if (bulkDrafts?.length === 1) {
      const only = bulkDrafts[0]!;
      if (!isHighConfidenceDraft(only)) {
        bulkDrafts = null;
      } else if (only.kind === 'expense' && shouldDeferCreateToLlm(trimmed)) {
        bulkDrafts = null;
      }
    }

    // Order table paste: attach skipped rows (thiếu tiền)
    const orderTableMeta = parseOrderTableDrafts(trimmed, 'text');
    if (orderTableMeta.isTable && orderTableMeta.drafts.length) {
      bulkDrafts = orderTableMeta.drafts;
      bulkSkipped = orderTableMeta.skipped;
    }

    if (!bulkDrafts && looksLikeBulkLineList(trimmed)) {
      const lineAttempt = parseLineListDrafts(trimmed, 'text');
      if (lineAttempt.drafts.length >= 2) {
        bulkDrafts = lineAttempt.drafts;
        bulkSkipped = lineAttempt.skipped;
      } else {
        const llmBulk = await extractBulkDrafts(trimmed, 'text');
        if (llmBulk?.drafts.length) {
          bulkDrafts = llmBulk.drafts;
          const persisted = await persistBulkDrafts(bulkDrafts, []);
          addToHistory(trimmed, persisted.text);
          return {
            text: persisted.text,
            source: llmBulk.llmSource,
            createdRecord: persisted.lastCreated,
          };
        }
        const failText =
          '⚠️ Không nhận diện được danh sách nhiều dòng. Thử định dạng: `Tên hàng 798.000₫` mỗi dòng.';
        addToHistory(trimmed, failText);
        return { text: failText, source: 'local' };
      }
    }

    if (bulkDrafts?.length) {
      const isOrderTablePaste = orderTableMeta.isTable && orderTableMeta.drafts.length > 0;
      if (bulkDrafts.length >= 2 && !isOrderTablePaste) {
        const lineMeta = parseLineListDrafts(trimmed, 'text');
        if (lineMeta.drafts.length >= 2) bulkSkipped = lineMeta.skipped;
      }
      try {
        // Order table (kể cả 1 dòng) hoặc nhiều draft → persist giữ orderItems
        if (
          isOrderTablePaste ||
          bulkDrafts.length >= 2 ||
          (bulkDrafts[0]?.orderItems?.length ?? 0) > 0
        ) {
          const persisted = await persistBulkDrafts(bulkDrafts, bulkSkipped);
          addToHistory(trimmed, persisted.text);
          return {
            text: persisted.text,
            source: 'local',
            createdRecord: persisted.lastCreated,
          };
        }

        if (bulkDrafts.length === 1 && bulkDrafts[0]!.kind === 'revenue') {
          const only = bulkDrafts[0]!;
          // Giữ cọc / ship / orderItems — không qua draftToCreateIntent rút gọn
          if (
            (only.shippingFee ?? 0) > 0 ||
            (only.depositAmount ?? 0) > 0 ||
            (only.orderItems?.length ?? 0) > 0
          ) {
            const persisted = await persistBulkDrafts([only], bulkSkipped);
            addToHistory(trimmed, persisted.text);
            return {
              text: persisted.text,
              source: 'local',
              createdRecord: persisted.lastCreated,
            };
          }
          const out = await runIntentTool(draftToCreateIntent(only));
          addToHistory(trimmed, out.text);
          return out;
        }

        const expenseDrafts = bulkDrafts.filter((d) => d.kind === 'expense');
        const revenueDrafts = bulkDrafts.filter((d) => d.kind === 'revenue');
        const lines: string[] = [];
        let lastCreated: { kind: 'expense' | 'revenue'; id: string } | undefined;

        if (expenseDrafts.length) {
          const { created, failed } = await persistConfirmed(expenseDrafts);
          expenseDrafts.forEach((draft, i) => {
            const mark = created[i] ? '✅' : '⚠️';
            lines.push(
              `${mark} chi phí: **${draft.description}** — ${draft.amount.toLocaleString('vi-VN')}₫`,
            );
          });
          if (failed[0] && created.length === 0) lines.push(`❌ ${failed[0]}`);
          if (created[0]) lastCreated = { kind: created[0].kind, id: created[0].id };
        }

        for (const rd of revenueDrafts) {
          const out = await runIntentTool(draftToCreateIntent(rd));
          lines.push(out.text);
          if (out.createdRecord) lastCreated = out.createdRecord;
          if (getPending()?.awaitingEntityPick) {
            const text = lines.join('\n');
            addToHistory(trimmed, text);
            return { text, source: 'local', createdRecord: lastCreated };
          }
        }

        const text = lines.join('\n') || 'Không lưu được.';
        addToHistory(trimmed, text);
        return { text, source: 'local', createdRecord: lastCreated };
      } catch (err) {
        const errText = `❌ Lỗi lưu: ${err instanceof Error ? err.message : 'Unknown'}`;
        addToHistory(trimmed, errText);
        return { text: errText, source: 'local' };
      }
    }

    const localAction = parseLocalCommand(trimmed);
    if (localAction) {
      const result = await this.executeAction(localAction);
      const text = result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
      addToHistory(trimmed, text);
      return { text, source: 'local' };
    }

    // ── 1b. Help ──────────────────────────────────────────────────────────
    const lower = trimmed.toLowerCase();
    if (lower === 'help' || lower === 'hướng dẫn' || lower === '?' || lower === 'cách dùng' || lower === 'giúp đỡ') {
      const helpText = `📋 **Trợ lý Tài Chính — hướng dẫn**

**Thêm nhanh** (regex, lưu ngay — có thể nhiều lệnh một tin):
• \`cà phê 25k\` · \`bán cho Hoa 3 cái kẹp tóc giá 40k\`
• Nhiều dòng / paste Excel: \`thêm chi phí:\\nLen SS5 798.000₫\\nBông 98.000₫\`
• Nhiều lệnh một dòng: \`bán cho Hoa … 40k bán cho Hà … 120k mua len 500k\`

**Thông minh (Gemini/WebLLM):**
• Câu tự nhiên: *"chi tiền tiếp khách hôm nay khoảng 200 nghìn"*
• Sửa/xóa: *"xóa chi phí nhậu"*, *"đổi đơn DH-… sang hoàn thành"*
• Tra cứu: *"tổng quan"*, *"đơn đang chờ"*, *"chi phí tháng này"*
• Thiếu thông tin → bot hỏi lại; xóa cần gõ **xác nhận**

**File:** ảnh/PDF/CSV/XLS → preview → Xác nhận.`;
      addToHistory(trimmed, helpText);
      return { text: helpText, source: 'local' };
    }

    // ── 2. LLM intent → tools ─────────────────────────────────────────────
    if (looksLikeToolIntent(trimmed)) {
      const extracted = await extractChatIntent(trimmed, financeCtx);
      if (extracted && extracted.intent.intent !== 'chat') {
        const intent = extracted.intent;

        if (intent.missing.length > 0) {
          setPending({ intent, updatedAt: Date.now() });
          const text = clarifyQuestion(intent);
          addToHistory(trimmed, text);
          return { text, source: extracted.source };
        }

        if (
          intent.intent === 'lookup' ||
          intent.intent.startsWith('create_') ||
          intent.intent.startsWith('update_') ||
          intent.intent.startsWith('delete_')
        ) {
          const out = await runIntentTool(intent);
          if (intent.intent === 'lookup' && /phân tích|so sánh|xu hướng|bất thường/.test(lower)) {
            const aiExtra = await generateChatReply(trimmed, financeCtx, history);
            if (aiExtra?.text) {
              const text = `${out.text}\n\n${aiExtra.text}`;
              addToHistory(trimmed, text);
              return { text, source: aiExtra.source };
            }
          }
          addToHistory(trimmed, out.text);
          return { ...out, source: extracted.source === 'cloud' ? 'cloud' : out.source };
        }
      }
    }

    // ── 3. Free chat / analysis ───────────────────────────────────────────
    const ai = await generateChatReply(trimmed, financeCtx, history);
    if (ai?.text) {
      const { cleanText, action } = parseAiAction(ai.text);
      if (action) {
        const result = await this.executeAction(action);
        const text = result.success
          ? `${cleanText ? `${cleanText}\n\n` : ''}✅ ${result.message}`
          : `${cleanText ? `${cleanText}\n\n` : ''}❌ ${result.message}`;
        addToHistory(trimmed, text);
        return { text, source: ai.source };
      }
      addToHistory(trimmed, cleanText);
      return { text: cleanText, source: ai.source };
    }

    // Legacy provider path as last resort
    const type = classifyRequest(trimmed);
    const provider = await getProvider(type);
    const parts: string[] = [];
    if (financeCtx) parts.push(financeCtx);
    if (history) parts.push(`Lịch sử chat:\n${history}`);
    parts.push(`Người dùng: ${trimmed}`);
    const fullContext = parts.join('\n\n');

    if (provider === 'cloud' && geminiService.isConfigured) {
      try {
        const rawText = await geminiService.generateContent(fullContext);
        if (rawText && !rawText.startsWith('Lỗi Gemini:')) {
          const { cleanText, action } = parseAiAction(rawText);
          if (action) {
            const result = await this.executeAction(action);
            const text = result.success
              ? `${cleanText ? `${cleanText}\n\n` : ''}✅ ${result.message}`
              : `${cleanText ? `${cleanText}\n\n` : ''}❌ ${result.message}`;
            addToHistory(trimmed, text);
            return { text, source: 'cloud' };
          }
          addToHistory(trimmed, cleanText);
          return { text: cleanText, source: 'cloud' };
        }
      } catch {
        /* fallback */
      }
    }

    if (webLLM.isLoaded) {
      try {
        const rawText = await webLLM.generate(fullContext, { mode: 'chat', maxTokens: 1024 });
        const { cleanText, action } = parseAiAction(rawText);
        if (action) {
          const result = await this.executeAction(action);
          const text = result.success
            ? `${cleanText ? `${cleanText}\n\n` : ''}✅ ${result.message}`
            : `${cleanText ? `${cleanText}\n\n` : ''}❌ ${result.message}`;
          addToHistory(trimmed, text);
          return { text, source: 'local' };
        }
        addToHistory(trimmed, cleanText);
        return { text: cleanText, source: 'local' };
      } catch {
        /* fall through */
      }
    } else if (!webLLM.isLoading) {
      void webLLM.load();
    }

    const fallback =
      '🤖 Chưa gọi được AI (Gemini/WebLLM).\n\n• Cấu hình Gemini ở Cài đặt, hoặc đợi WebLLM tải\n• Vẫn thêm nhanh: `cà phê 25k` / `bán cho Hoa 3 kẹp tóc giá 15k`';
    addToHistory(trimmed, fallback);
    return { text: fallback, source: 'local' };
  },

  /** Execute a chat action (e.g. create expense / revenue from AI command). */
  async executeAction(action: ChatAction): Promise<{ success: boolean; message: string }> {
    const result = await executeLegacyCreate(action);
    return { success: result.ok, message: result.message.replace(/^Đã thêm/, 'Đã thêm').replace(/^\*\*/, '') };
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
