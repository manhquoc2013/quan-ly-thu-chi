/**
 * AI Router — Hybrid AI: Kilo Free → Gemini → WebLLM.
 *
 * Chat messages go through LLM intent extract (cloud preferred).
 * Only structured paste (order table / multi-line bulk list) uses deterministic parsers.
 *
 * Usage:
 *   import { aiRouter } from '@/services/aiRouter';
 *   const { text, source, action } = await aiRouter.sendMessage('Phân tích chi phí');
 */

import { callLlmCascade } from './llmCall';
import { geminiService } from './geminiService';
import { kiloService } from './kiloService';
import { webLLM } from './webLLM';
import { useMascotStore } from '@/store/mascotStore';
import type { ExpenseCategory } from '@/models';
import {
  buildFinanceContext,
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
  extractMultiChatIntents,
  generateChatReply,
  mergeIntentWithLlm,
} from './llmIntentExtractor';
import { extractBulkDrafts } from './llmBulkDraftExtractor';
import {
  looksLikeBulkLineList,
  parseLineListDrafts,
  parseTextToDraft,
  isClearBulkPaste,
} from './textDraftParser';
import { parseOrderTableDrafts } from './orderTableParser';
import { executeChatIntent, executeLegacyCreate } from './chatTools';
import { formatEntityPickMessage } from './entityResolve';
import { splitMultiTx } from './splitMultiTx';
import { sanitizeIntentAgainstMessage } from './intentSanitize';

export type ChatReplySource = 'local' | 'cloud' | 'kilo' | 'groq' | 'gemini' | 'tesseract';

/** When LLM returns prose/chat, rebuild create intents from split segments via local parsers. */
function localCreateIntentsFromSegments(segments: string[]): ChatIntent[] {
  const intents: ChatIntent[] = [];
  for (const seg of segments) {
    const draft = parseTextToDraft(seg, 'text');
    if (!draft) continue;
    intents.push(sanitizeIntentAgainstMessage(seg, draftToCreateIntent(draft)));
  }
  return intents;
}

function isRunnableCreate(intent: ChatIntent): boolean {
  return (
    (intent.intent === 'create_expense' ||
      intent.intent === 'create_revenue' ||
      intent.intent === 'create_product' ||
      intent.intent === 'create_customer' ||
      intent.intent === 'create_platform') &&
    intent.missing.length === 0
  );
}

function isCloudSource(source: string | undefined): boolean {
  return source === 'cloud' || source === 'kilo' || source === 'gemini';
}

export interface ChatAction {
  type: 'create_expense' | 'create_revenue';
  amount: number;
  description: string;
  category?: ExpenseCategory;
  customerName?: string;
}

/**
 * Category mapping from Vietnamese (Mèo Lucky) expense categories to internal ExpenseCategory codes.
 */
function mapVnExpenseCategory(danhMuc: string): ExpenseCategory {
  const map: Record<string, ExpenseCategory> = {
    'Nhập hàng': 'supplies',
    'Tiền nhà/Điện nước': 'utilities',
    'Bao bì/Đóng gói': 'supplies',
    'Chi khác': 'other',
  };
  return map[danhMuc] ?? 'other';
}

/**
 * Parse AI response for embedded ```action JSON block.
 * Supports both old English format (type: create_expense/create_revenue)
 * and new Vietnamese Mèo Lucky format (action: BAN_HANG/CHI_PHI/XEM_BAO_CAO/TAN_GAU).
 * Also tries top-level JSON when no ```action block is found.
 */
function parseAiAction(text: string): { cleanText: string; action?: ChatAction } {
  // ── Try ```action block ──────────────────────────────────────
  const actionMatch = text.match(/```action\n([\s\S]*?)\n```/);
  const jsonStr = actionMatch?.[1]?.trim();
  const cleanBase = actionMatch
    ? text.replace(/```action\n[\s\S]*?\n```/, '').trim()
    : text;

  if (jsonStr) {
    const parsed = tryParseVnAction(jsonStr);
    if (parsed) return parsed;

    const legacy = tryParseLegacyAction(jsonStr);
    if (legacy) return { cleanText: cleanBase, action: legacy };
  }

  // ── Try top-level JSON (no ```action wrapping) ───────────────
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const parsed = tryParseVnAction(trimmed);
    if (parsed) return parsed;

    const legacy = tryParseLegacyAction(trimmed);
    if (legacy?.type === 'create_expense' || legacy?.type === 'create_revenue') {
      return { cleanText: '', action: legacy };
    }
  }

  return { cleanText: cleanBase };
}

/** Try old English format: { type: "create_expense"|"create_revenue", amount, description, ... } */
function tryParseLegacyAction(jsonStr: string): ChatAction | null {
  try {
    const a = JSON.parse(jsonStr);
    if (a.type === 'create_expense' && a.amount > 0 && a.description) {
      triggerMascot(a.mascot_say, a.mascot_emotion);
      return {
        type: 'create_expense',
        amount: a.amount,
        description: a.description,
        category: a.category || 'other',
      };
    }
    if (a.type === 'create_revenue' && a.amount > 0 && a.description) {
      triggerMascot(a.mascot_say, a.mascot_emotion);
      return {
        type: 'create_revenue',
        amount: a.amount,
        description: a.description,
        customerName: a.customerName,
      };
    }
  } catch { /* ignore */ }
  return null;
}

/** Try new Vietnamese Mèo Lucky format: { action: "BAN_HANG"|"CHI_PHI"|"XEM_BAO_CAO"|"TAN_GAU", data, mascot_say, mascot_emotion } */
function tryParseVnAction(jsonStr: string): { cleanText: string; action?: ChatAction } | null {
  try {
    const a = JSON.parse(jsonStr);
    if (!a.action || typeof a.action !== 'string') return null;

    triggerMascot(a.mascot_say, a.mascot_emotion);

    // BAN_HANG → create_revenue
    if (a.action === 'BAN_HANG' && a.data) {
      const d = a.data;
      const customerName: string | undefined = d.khach_hang || undefined;
      const donHang: Array<{ ten_hang?: string; so_luong?: number; gia_ban?: number }> =
        Array.isArray(d.don_hang) ? d.don_hang : [];
      const totalAmount = donHang.reduce(
        (sum: number, item: { ten_hang?: string; so_luong?: number; gia_ban?: number }) =>
          sum + (item.gia_ban ?? 0) * (item.so_luong ?? 1),
        0,
      );
      const description = donHang
        .map((item: { ten_hang?: string }) => item.ten_hang ?? '')
        .filter(Boolean)
        .join(', ') || (d.don_hang?.length ? 'Đơn hàng' : '');

      if (totalAmount > 0 && description) {
        return {
          cleanText: '',
          action: {
            type: 'create_revenue',
            amount: totalAmount,
            description,
            customerName,
          },
        };
      }
      return null;
    }

    // CHI_PHI → create_expense
    if (a.action === 'CHI_PHI' && a.data?.chi_tiet_chi) {
      const chi = a.data.chi_tiet_chi;
      const amount = Number(chi.so_tien) || 0;
      const description: string = chi.ghi_chu || '';
      if (amount > 0 && description) {
        return {
          cleanText: '',
          action: {
            type: 'create_expense',
            amount,
            description,
            category: mapVnExpenseCategory(chi.danh_muc),
          },
        };
      }
      return null;
    }

    // XEM_BAO_CAO → lookup (no immediate action, handled by intent extractor)
    // TAN_GAU → chat (no action)
    return { cleanText: '', action: undefined };
  } catch {
    return null;
  }
}

/** Trigger mascot overlay if mascot_say and mascot_emotion are present in the parsed JSON. */
function triggerMascot(mascotSay?: string, mascotEmotion?: string): void {
  if (mascotSay && mascotEmotion) {
    const validEmotions = ['happy', 'sad', 'warning', 'celebrate', 'thinking', 'idle'] as const;
    type MascotEmotion = (typeof validEmotions)[number];
    const emotion: MascotEmotion = (validEmotions as readonly string[]).includes(mascotEmotion)
      ? (mascotEmotion as MascotEmotion)
      : 'happy';
    useMascotStore.getState().speak(mascotSay, emotion);
  }
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

async function persistBulkDrafts(
  drafts: DraftRecord[],
  skipped: string[],
): Promise<{
  text: string;
  lastCreated?: { kind: 'expense' | 'revenue' | 'product'; id: string };
}> {
  const expenseDrafts = drafts.filter((d) => d.kind === 'expense');
  const revenueDrafts = drafts.filter((d) => d.kind === 'revenue');
  const productDrafts = drafts.filter((d) => d.kind === 'product');
  const lines: string[] = [];
  let lastCreated: { kind: 'expense' | 'revenue' | 'product'; id: string } | undefined;
  let okCount = 0;
  let totalAmount = 0;

  if (productDrafts.length) {
    const { created, failed } = await persistConfirmed(productDrafts);
    okCount += created.length;
    totalAmount += created.reduce((s, c) => s + c.amount, 0);
    if (created[0]) lastCreated = { kind: 'product', id: created[0].id };
    if (created.length) {
      lines.push('🏷️ **Chi tiết sản phẩm:**');
      created.forEach((c, i) => {
        lines.push(
          `${i + 1}. ✅ **${c.description}** — ${c.amount.toLocaleString('vi-VN')}₫`,
        );
      });
    }
    failed.forEach((f) => lines.push(`❌ ${f}`));
  }

  if (expenseDrafts.length) {
    const { created, failed } = await persistConfirmed(expenseDrafts);
    okCount += created.length;
    totalAmount += created.reduce((s, c) => s + c.amount, 0);
    if (created[0]) lastCreated = { kind: created[0].kind, id: created[0].id };
    if (created.length) {
      lines.push('💸 **Chi tiết chi phí:**');
      created.forEach((c, i) => {
        lines.push(
          `${i + 1}. ✅ **${c.description}** — ${c.amount.toLocaleString('vi-VN')}₫`,
        );
      });
    }
    failed.forEach((f) => lines.push(`❌ ${f}`));
  }

  const tableRevenues = revenueDrafts.filter((d) => (d.orderItems?.length ?? 0) > 0);
  const simpleRevenues = revenueDrafts.filter((d) => !(d.orderItems?.length ?? 0));

  if (tableRevenues.length) {
    const { created, failed } = await persistConfirmed(tableRevenues);
    okCount += created.length;
    totalAmount += created.reduce((s, c) => s + c.amount, 0);
    if (created[0]) lastCreated = { kind: created[0].kind, id: created[0].id };
    if (created.length) {
      lines.push('🧾 **Chi tiết đơn:**');
      created.forEach((c, i) => {
        lines.push(
          `${i + 1}. ✅ **${c.customerName ?? c.description}** — ${c.amount.toLocaleString('vi-VN')}₫`,
        );
      });
    }
    failed.forEach((f) => lines.push(`❌ ${f}`));
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
    productDrafts.length && !expenseDrafts.length && !revenueDrafts.length
      ? 'sản phẩm'
      : expenseDrafts.length && !revenueDrafts.length && !productDrafts.length
        ? 'chi phí'
        : revenueDrafts.length && !expenseDrafts.length && !productDrafts.length
          ? 'doanh thu'
          : 'mục';

  const summary =
    okCount > 0
      ? productDrafts.length && !expenseDrafts.length && !revenueDrafts.length
        ? `✅ Đã thêm **${okCount}** sản phẩm\n💰 Tổng giá niêm yết: **${totalAmount.toLocaleString('vi-VN')}₫**`
        : `✅ Đã thêm **${okCount}** ${kindLabel}\n💰 Tổng: **${totalAmount.toLocaleString('vi-VN')}₫**`
      : '⚠️ Không lưu được khoản nào.';

  const skipBlock: string[] = [];
  for (const s of skipped.slice(0, 5)) {
    skipBlock.push(`⚠️ Bỏ qua: ${s}`);
  }
  if (skipped.length > 5) skipBlock.push(`⚠️ … và ${skipped.length - 5} dòng khác`);

  return {
    text: [summary, ...lines, ...skipBlock].filter(Boolean).join('\n\n'),
    lastCreated,
  };
}

async function runIntentTool(
  intent: ChatIntent,
  opts?: { deleteConfirmed?: boolean },
): Promise<{
  text: string;
  source: ChatReplySource;
  createdRecord?: { kind: 'expense' | 'revenue' | 'product'; id: string };
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
    return (
      (typeof navigator !== 'undefined' &&
        navigator.onLine &&
        kiloService.isEnabled) ||
      geminiService.isConfigured ||
      webLLM.isLoaded
    );
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
    source: ChatReplySource;
    action?: ChatAction;
    drafts?: DraftRecord[];
    createdRecord?: { kind: 'expense' | 'revenue' | 'product'; id: string };
  }> {
    const trimmed = message.trim();
    if (!trimmed) {
      return { text: 'Bạn chưa nhập gì.', source: 'local' };
    }

    const financeCtx =
      context ?? (shouldAttachFinanceContext(trimmed) ? buildFinanceContext() : '');
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
        const createNew =
          idx === 0 || /^(tạo(\s+mới)?|moi|new)$/i.test(trimmed);
        if (!createNew && (idx === null || idx < 0 || idx > options.length)) {
          const text = [
            `⚠️ Số không hợp lệ — chỉ nhận **0** (tạo mới) hoặc **1–${options.length}**.`,
            formatEntityPickMessage(kind, query, options),
          ].join('\n');
          addToHistory(trimmed, text);
          return { text, source: 'local' };
        }
        const nextIntent: ChatIntent = { ...pending.intent };
        if (kind === 'customer') {
          if (createNew) {
            nextIntent.forceNewCustomer = true;
            nextIntent.customerId = undefined;
          } else {
            nextIntent.customerId = options[idx! - 1]!.id;
            nextIntent.forceNewCustomer = false;
          }
        } else if (kind === 'product') {
          if (createNew) {
            nextIntent.forceNewProduct = true;
            nextIntent.productId = undefined;
            // Ensure create uses clean short name, not polluted description
            if (query.length >= 2) nextIntent.description = query;
          } else {
            nextIntent.productId = options[idx! - 1]!.id;
            nextIntent.forceNewProduct = false;
          }
        } else if (createNew) {
          nextIntent.forceNewPlatform = true;
          nextIntent.platformId = undefined;
        } else {
          nextIntent.platformId = options[idx! - 1]!.id;
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

    // ── 1. Structured paste only (order table / multi-line bulk list) ────
    // Single-line chat always continues to LLM below.
    const orderTableMeta = parseOrderTableDrafts(trimmed, 'text');
    let bulkDrafts =
      orderTableMeta.isTable && orderTableMeta.drafts.length ? orderTableMeta.drafts : null;
    let bulkSkipped: string[] = orderTableMeta.isTable ? orderTableMeta.skipped : [];

    if (!bulkDrafts && looksLikeBulkLineList(trimmed)) {
      const lineAttempt = parseLineListDrafts(trimmed, 'text');
      // Policy A: only trust local parse when kind header/cue is explicit
      if (lineAttempt.drafts.length >= 2 && isClearBulkPaste(trimmed, lineAttempt)) {
        bulkDrafts = lineAttempt.drafts;
        bulkSkipped = lineAttempt.skipped;
      } else {
        const llmBulk = await extractBulkDrafts(trimmed, 'text');
        if (llmBulk?.drafts.length) {
          const persisted = await persistBulkDrafts(llmBulk.drafts, lineAttempt.skipped);
          addToHistory(trimmed, persisted.text);
          return {
            text: persisted.text,
            source: llmBulk.llmSource,
            createdRecord: persisted.lastCreated,
          };
        }
        // Ambiguous unlabeled list + no LLM → do NOT guess expense
        if (lineAttempt.drafts.length >= 2 && !lineAttempt.kindHint) {
          const failAmbiguous =
            '⚠️ Danh sách nhiều dòng chưa rõ loại (chi phí / doanh thu / sản phẩm). Thêm header ví dụ `thêm các sản phẩm:` hoặc `thêm chi phí:`, rồi gửi lại.';
          addToHistory(trimmed, failAmbiguous);
          return { text: failAmbiguous, source: 'local' };
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
        const productDrafts = bulkDrafts.filter((d) => d.kind === 'product');
        const lines: string[] = [];
        let lastCreated: { kind: 'expense' | 'revenue' | 'product'; id: string } | undefined;

        if (productDrafts.length) {
          const { created, failed } = await persistConfirmed(productDrafts);
          productDrafts.forEach((draft, i) => {
            const mark = created[i] ? '✅' : '⚠️';
            lines.push(
              `${mark} sản phẩm: **${draft.description}** — ${draft.amount.toLocaleString('vi-VN')}₫`,
            );
          });
          if (failed[0] && created.length === 0) lines.push(`❌ ${failed[0]}`);
          if (created[0]) lastCreated = { kind: 'product', id: created[0].id };
        }

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
            const text = lines.join('\n\n');
            addToHistory(trimmed, text);
            return { text, source: 'local', createdRecord: lastCreated };
          }
        }

        const text = lines.join('\n\n') || 'Không lưu được.';
        addToHistory(trimmed, text);
        return { text, source: 'local', createdRecord: lastCreated };
      } catch (err) {
        const errText = `❌ Lỗi lưu: ${err instanceof Error ? err.message : 'Unknown'}`;
        addToHistory(trimmed, errText);
        return { text: errText, source: 'local' };
      }
    }

    // ── 1b. Help ──────────────────────────────────────────────────────────
    const lower = trimmed.toLowerCase();
    if (
      lower === 'help' ||
      lower === 'hướng dẫn' ||
      lower === '?' ||
      lower === 'cách dùng' ||
      lower === 'giúp đỡ'
    ) {
      const helpText = `📋 **Trợ lý Tài Chính — hướng dẫn**

**Ghi sổ qua AI** (Gemini/WebLLM — mọi câu chat đều đi qua LLM):
• \`cà phê 25k\` · \`bán cho Hoa 3 cái kẹp tóc giá 40k\`
• Câu tự nhiên: *"chi tiền tiếp khách hôm nay khoảng 200 nghìn"*
• Nhiều dòng / paste Excel: \`thêm chi phí:\\nLen SS5 798.000₫\\nBông 98.000₫\`
• Danh mục SP: \`thêm các sản phẩm:\\nSTT Tên Đơn giá\\n1 Móc khóa 20.000đ\`
• Master data: \`thêm khách Hoa\` · \`đổi giá Hello Kitty 55k\` · \`danh sách sản phẩm\`

**Sửa / xóa / tra cứu:**
• *"xóa chi phí nhậu"*, *"đổi đơn DH-… sang hoàn thành"*
• *"tổng quan"*, *"đơn đang chờ"*, *"chi phí tháng này"*
• Thiếu thông tin → bot hỏi lại; xóa cần gõ **xác nhận**

**File:** ảnh/PDF/CSV/XLS → preview → Xác nhận.`;
      addToHistory(trimmed, helpText);
      return { text: helpText, source: 'local' };
    }

    // ── 2. LLM intent → tools (all normal chat messages) ─────────────────
    const segments = splitMultiTx(trimmed);
    if (segments.length > 1) {
      // One LLM call for all segments (parallel WebLLM freezes the machine)
      const multi = await extractMultiChatIntents(segments, financeCtx || undefined);
      let intents = (multi?.intents ?? []).filter((i) => i.intent !== 'chat');
      // Free models / Gemini often reply with a prose summary instead of JSON —
      // fall back to local parsers so creates still persist.
      if (!intents.some(isRunnableCreate)) {
        const local = localCreateIntentsFromSegments(segments);
        if (local.length) intents = local;
      }
      const multiResults: string[] = [];
      let source: ChatReplySource = multi?.source ?? 'local';
      let lastCreated: { kind: 'expense' | 'revenue' | 'product'; id: string } | undefined;

      for (const intent of intents) {
        if (intent.mascotSay) {
          triggerMascot(intent.mascotSay, intent.mascotEmotion);
        }
        if (intent.missing.length > 0) {
          setPending({ intent, updatedAt: Date.now() });
          multiResults.push(clarifyQuestion(intent));
          break;
        }
        const out = await runIntentTool(intent);
        multiResults.push(out.text);
        if (out.createdRecord) lastCreated = out.createdRecord;
        if (multi?.source) source = multi.source;
        else source = 'local';
        if (getPending()?.awaitingEntityPick) break;
      }

      if (multiResults.length > 0) {
        const text = multiResults.join('\n\n');
        addToHistory(trimmed, text);
        return { text, source, createdRecord: lastCreated };
      }
    }

    const extracted = await extractChatIntent(trimmed, financeCtx || undefined);
    if (extracted && extracted.intent.intent !== 'chat') {
      const intent = sanitizeIntentAgainstMessage(trimmed, extracted.intent);
      if (intent.mascotSay) {
        triggerMascot(intent.mascotSay, intent.mascotEmotion);
      }

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
        return { ...out, source: isCloudSource(extracted.source) ? extracted.source : out.source };
      }
    }

    // Single-segment create that LLM classified as chat — try local draft once
    if (segments.length === 1) {
      const localOne = localCreateIntentsFromSegments([trimmed]);
      if (localOne.some(isRunnableCreate)) {
        const lines: string[] = [];
        let lastCreated: { kind: 'expense' | 'revenue' | 'product'; id: string } | undefined;
        for (const intent of localOne) {
          if (!isRunnableCreate(intent)) continue;
          const out = await runIntentTool(intent);
          lines.push(out.text);
          if (out.createdRecord) lastCreated = out.createdRecord;
        }
        if (lines.length) {
          const text = lines.join('\n\n');
          addToHistory(trimmed, text);
          return { text, source: 'local', createdRecord: lastCreated };
        }
      }
    }

    // ── 3. Free chat / analysis ───────────────────────────────────────────
    // Do not summarize multi-tx bookkeeping as chat — already tried creates above.
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
    const parts: string[] = [];
    if (financeCtx) parts.push(financeCtx);
    if (history) parts.push(`Lịch sử chat:\n${history}`);
    parts.push(`Người dùng: ${trimmed}`);
    const fullContext = parts.join('\n\n');

    const cascaded = await callLlmCascade(fullContext, 'chat');
    if (cascaded?.text) {
      const { cleanText, action } = parseAiAction(cascaded.text);
      if (action) {
        const result = await this.executeAction(action);
        const text = result.success
          ? `${cleanText ? `${cleanText}\n\n` : ''}✅ ${result.message}`
          : `${cleanText ? `${cleanText}\n\n` : ''}❌ ${result.message}`;
        addToHistory(trimmed, text);
        return { text, source: cascaded.source };
      }
      addToHistory(trimmed, cleanText);
      return { text: cleanText, source: cascaded.source };
    }

    if (!webLLM.isDisabled && !webLLM.isLoaded && !webLLM.isLoading) {
      void webLLM.load();
    }

    const fallback =
      '🤖 Chưa gọi được AI (Kilo Free / Gemini / WebLLM).\n\n• Online: bật Kilo Free ở Cài đặt (không cần key)\n• Hoặc cấu hình Gemini; offline thì đợi WebLLM tải\n• Gửi lại: `cà phê 25k` / `bán cho Hoa 3 kẹp tóc giá 15k`';
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
