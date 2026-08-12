/**
 * AI Router — LLM-only chat routing (Kilo Free → Gemini → WebLLM).
 *
 * All natural-language chat (create / update / navigate / SKU / paste) goes through
 * LLM intent or bulk extract. No regex NL classifiers on the send path.
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
  isNewLedgerRequest,
  isZeroMoneyReply,
  mergeClarifyReply,
  mergeIntent,
  parseEntityPickIndex,
  draftToCreateIntent,
  fillMissingSlots,
} from './chatIntent';
import {
  extractChatIntent,
  extractMultiChatIntents,
  generateChatReply,
  mergeIntentWithLlm,
} from './llmIntentExtractor';
import { extractBulkDrafts } from './llmBulkDraftExtractor';
import {
  executeChatIntent,
  executeLegacyCreate,
} from './chatTools';
import { formatEntityPickMessage } from './entityResolve';
import { splitMultiTx } from './splitMultiTx';
import { sanitizeIntentAgainstMessage } from './intentSanitize';
import { notifyListInvalidated } from './listQuery';

export type ChatReplySource = 'local' | 'cloud' | 'kilo' | 'openrouter' | 'siliconflow' | 'groq' | 'gemini' | 'tesseract';

function isMultiLinePaste(message: string): boolean {
  return message.split(/\r?\n/).filter((line) => line.trim().length > 0).length >= 2;
}

function isCloudSource(source: string | undefined): boolean {
  return (
    source === 'cloud' ||
    source === 'kilo' ||
    source === 'openrouter' ||
    source === 'siliconflow' ||
    source === 'groq' ||
    source === 'gemini'
  );
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
  if (!mascotSay) return;
  const validEmotions = ['happy', 'sad', 'warning', 'celebrate', 'thinking', 'idle'] as const;
  type MascotEmotion = (typeof validEmotions)[number];
  const emotion: MascotEmotion = (validEmotions as readonly string[]).includes(mascotEmotion ?? '')
    ? (mascotEmotion as MascotEmotion)
    : 'happy';
  useMascotStore.getState().speak(mascotSay, emotion);
}

function plainChatText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/^✅\s*/gm, '')
    .replace(/^❌\s*/gm, '')
    .replace(/\n+/g, ' · ')
    .trim();
}

function invalidateListsForIntent(intent: ChatIntent): void {
  const i = intent.intent;
  if (i.includes('expense')) notifyListInvalidated('expenses');
  if (i.includes('revenue') || i === 'update_order_status') notifyListInvalidated('revenues');
  if (i.includes('product')) notifyListInvalidated('products');
  if (i.includes('customer')) notifyListInvalidated('customers');
  if (i.includes('platform')) notifyListInvalidated('platforms');
}

function announceChatSuccess(intent: ChatIntent, message: string, quiet?: boolean): void {
  if (quiet) return;
  const plain = plainChatText(message).slice(0, 140);
  if (!plain) return;
  if (intent.mascotSay) {
    triggerMascot(intent.mascotSay, intent.mascotEmotion);
    return;
  }
  const emotion =
    intent.intent.startsWith('create_')
      ? 'celebrate'
      : intent.intent.startsWith('delete_')
        ? 'sad'
        : 'happy';
  useMascotStore.getState().speak(plain, emotion);
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
  opts?: { deleteConfirmed?: boolean; quietMascot?: boolean },
): Promise<{
  text: string;
  source: ChatReplySource;
  createdRecord?: { kind: 'expense' | 'revenue' | 'product'; id: string };
  navigateTo?: string;
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
  invalidateListsForIntent(intent);
  const text = `✅ ${result.message}`.replace(/^✅ ✅/, '✅');
  announceChatSuccess(intent, text, opts?.quietMascot);
  return {
    text,
    source: 'local',
    createdRecord: result.createdRecord,
    navigateTo: result.navigateTo,
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
    navigateTo?: string;
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

      // New "tạo đơn…" while stuck on chi phí slot-fill → drop pending, re-route below.
      if (isNewLedgerRequest(trimmed)) {
        setPending(null);
      } else {
        let merged =
          (await mergeIntentWithLlm(pending.intent, trimmed, financeCtx)) ??
          mergeClarifyReply(pending.intent, trimmed);
        // Local zero-money reply beats LLM that keeps inventing expense amount slots.
        if (
          isZeroMoneyReply(trimmed) &&
          pending.intent.missing.includes('amount')
        ) {
          merged = mergeClarifyReply(pending.intent, trimmed);
        }
        merged = mergeIntent(pending.intent, merged);

        if (
          merged.intent === 'create_revenue' &&
          typeof merged.amount === 'number' &&
          merged.amount === 0 &&
          (!merged.description || merged.description.length < 2)
        ) {
          const label =
            merged.customerName?.trim() ||
            /tin\s*tin/i.exec(
              `${pending.intent.summaryVi ?? ''} ${trimmed}`,
            )?.[0];
          if (label) {
            merged = fillMissingSlots({
              ...merged,
              customerName: merged.customerName ?? label,
              description: `Đơn ${merged.customerName ?? label}`,
            });
          }
        }

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
    }

    // ── 1. Multi-line paste → LLM bulk ───────────────────────────────────
    if (isMultiLinePaste(trimmed)) {
      const llmBulk = await extractBulkDrafts(trimmed, 'text');
      if (llmBulk?.drafts.length) {
        try {
          const persisted = await persistBulkDrafts(llmBulk.drafts, []);
          addToHistory(trimmed, persisted.text);
          return {
            text: persisted.text,
            source: llmBulk.llmSource,
            createdRecord: persisted.lastCreated,
          };
        } catch (err) {
          const errText = `❌ Lỗi lưu: ${err instanceof Error ? err.message : 'Unknown'}`;
          addToHistory(trimmed, errText);
          return { text: errText, source: 'local' };
        }
      }
    }

    // ── 2. LLM intent → tools ────────────────────────────────────────────
    const segments = splitMultiTx(trimmed);
    if (segments.length > 1) {
      const multi = await extractMultiChatIntents(segments, financeCtx || undefined);
      const intents = (multi?.intents ?? []).filter((i) => i.intent !== 'chat');
      const multiResults: string[] = [];
      let source: ChatReplySource = multi?.source ?? 'local';
      let lastCreated: { kind: 'expense' | 'revenue' | 'product'; id: string } | undefined;
      let okCount = 0;

      for (const intent of intents) {
        if (intent.missing.length > 0) {
          setPending({ intent, updatedAt: Date.now() });
          multiResults.push(clarifyQuestion(intent));
          break;
        }
        const out = await runIntentTool(intent, { quietMascot: true });
        multiResults.push(out.text);
        if (out.createdRecord) lastCreated = out.createdRecord;
        if (out.text.startsWith('✅')) okCount += 1;
        if (multi?.source) source = multi.source;
        else source = 'local';
        if (getPending()?.awaitingEntityPick) break;
      }

      if (multiResults.length > 0) {
        const text = multiResults.join('\n\n');
        if (okCount > 0) {
          const say =
            okCount === 1
              ? plainChatText(multiResults.find((l) => l.startsWith('✅')) ?? text).slice(0, 140)
              : `Đã xử lý ${okCount} đơn/khoản từ chat! 🎉`;
          useMascotStore.getState().speak(say || `Đã xử lý ${okCount} mục! 🎉`, 'celebrate');
        }
        addToHistory(trimmed, text);
        return { text, source, createdRecord: lastCreated };
      }
    }

    const extracted = await extractChatIntent(trimmed, financeCtx || undefined);
    if (extracted && extracted.intent.intent !== 'chat') {
      const intent = sanitizeIntentAgainstMessage(trimmed, extracted.intent);

      if (intent.missing.length > 0) {
        setPending({ intent, updatedAt: Date.now() });
        const text = clarifyQuestion(intent);
        if (intent.mascotSay) triggerMascot(intent.mascotSay, intent.mascotEmotion ?? 'thinking');
        addToHistory(trimmed, text);
        return { text, source: extracted.source };
      }

      if (
        intent.intent === 'lookup' ||
        intent.intent === 'navigate' ||
        intent.intent.startsWith('create_') ||
        intent.intent.startsWith('update_') ||
        intent.intent.startsWith('delete_')
      ) {
        const out = await runIntentTool(intent);
        const lower = trimmed.toLowerCase();
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
