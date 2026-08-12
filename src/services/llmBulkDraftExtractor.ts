/**
 * LLM bulk extract — paste nhiều dòng / bảng (chi · thu · SP · đơn).
 */

import { callLlmCascade } from './llmCall';
import {
  newDraftId,
  todayIso,
  validateDraft,
  type DraftOrderItem,
  type DraftRecord,
  type DraftSource,
} from './draftTypes';
import { guessCategory } from './categoryGuess';

const BULK_PROMPT = `Bạn là "Mèo Lucky" — Trợ lý thu ngân, trích xuất DANH SÁCH từ paste nhiều dòng / bảng.
CHỈ trả về 1 object JSON hợp lệ, KHÔNG markdown, KHÔNG giải thích.

Schema:
{
  "kind": "expense"|"revenue"|"product"|"mixed",
  "items": [
    {
      "kind": "expense"|"revenue"|"product",
      "description": string,
      "amount": number,
      "customerName": string|null,
      "quantity": number|null,
      "unitPrice": number|null,
      "platformName": string|null,
      "priority": boolean|null,
      "orderItems": [ { "name": string, "quantity": number, "unitPrice": number } ]|null
    }
  ],
  "mascot_say": "1 câu ngắn Lucky nhận xét tổng quan danh sách",
  "mascot_emotion": "happy"|"thinking"|"warning"|"celebrate"
}

Quy tắc:
- Mỗi dòng hàng + tiền → 1 item. amount luôn VND số nguyên (798.000 → 798000, 25k → 25000, 0 được phép nếu đơn chưa báo giá).
- Bỏ header kiểu "thêm chi phí:", "thêm doanh thu:", "thêm các sản phẩm:", "STT Tên Đơn giá", "tạo đơn".
- kind=product nếu danh mục SP / bảng giá / đơn giá niêm yết / "sản phẩm" / STT+Đơn giá.
- kind=expense nếu ngữ cảnh chi phí / nhập hàng chi tiền.
- kind=revenue nếu bán/thu/đơn hàng / "tạo đơn" / "khách …" theo dòng. "tạo đơn hàng khách X" = revenue, KHÔNG phải expense.
- Bảng đơn (cột khách + SP + giá) → kind=revenue; điền customerName; nhiều món cùng khách → 1 item + orderItems.
- kind top-level = mixed nếu danh sách lẫn loại; mỗi item PHẢI có kind riêng.
- Bỏ dòng không có mô tả.
- Không chắc expense vs product: ưu tiên product nếu là tên đồ bán lẻ + đơn giá; expense nếu "nhập/mua/chi".`;

function extractJsonObject(text: string): unknown | null {
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]!);
    } catch {
      return null;
    }
  }
}

async function callLlm(prompt: string): Promise<{ text: string; source: 'cloud' | 'local' | 'kilo' | 'groq' | 'gemini' | 'openrouter' | 'siliconflow' } | null> {
  return callLlmCascade(prompt, 'raw', 'extract');
}

export interface BulkExtractItemRaw {
  kind?: string;
  description?: unknown;
  amount?: unknown;
  customerName?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  platformName?: unknown;
  priority?: unknown;
  orderItems?: unknown;
}

export interface BulkExtractRaw {
  kind?: string;
  items?: BulkExtractItemRaw[];
}

function parseAmount(value: unknown, allowZero = false): number | undefined {
  const n =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value)
      : typeof value === 'string'
        ? Math.round(Number(String(value).replace(/[^\d.]/g, '')))
        : NaN;
  if (!Number.isFinite(n)) return undefined;
  if (allowZero ? n < 0 : n <= 0) return undefined;
  return n;
}

function parseOrderItems(raw: unknown): DraftOrderItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: DraftOrderItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const quantity = parseAmount(o.quantity) ?? 1;
    const unitPrice = parseAmount(o.unitPrice, true);
    if (name.length < 1 || unitPrice == null) continue;
    items.push({ name, quantity: Math.max(1, quantity), unitPrice });
  }
  return items.length ? items : undefined;
}

function itemKind(
  item: BulkExtractItemRaw,
  topKind: DraftRecord['kind'] | 'mixed',
): DraftRecord['kind'] {
  if (item.kind === 'revenue' || item.kind === 'product' || item.kind === 'expense') {
    return item.kind;
  }
  if (topKind === 'revenue' || topKind === 'product' || topKind === 'expense') return topKind;
  return 'expense';
}

/** Pure normalize — used by tests and after LLM. */
export function normalizeBulkExtract(
  raw: unknown,
  source: DraftSource = 'text',
): DraftRecord[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as BulkExtractRaw;
  const topKind: DraftRecord['kind'] | 'mixed' =
    o.kind === 'revenue' || o.kind === 'product' || o.kind === 'expense' || o.kind === 'mixed'
      ? o.kind
      : 'expense';
  if (!Array.isArray(o.items)) return [];

  const drafts: DraftRecord[] = [];
  for (const item of o.items) {
    if (!item || typeof item !== 'object') continue;
    const description =
      typeof item.description === 'string' ? item.description.trim() : '';
    const orderItems = parseOrderItems(item.orderItems);
    const kind = itemKind(item, topKind);
    const amount = parseAmount(item.amount, kind === 'revenue')
      ?? (orderItems
        ? orderItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
        : undefined);
    if (amount == null || description.length < 2) continue;

    const customerName =
      typeof item.customerName === 'string' && item.customerName.trim().length
        ? item.customerName.trim()
        : undefined;
    const quantity = parseAmount(item.quantity);
    const unitPrice = parseAmount(item.unitPrice, true);
    const platformName =
      typeof item.platformName === 'string' && item.platformName.trim().length
        ? item.platformName.trim()
        : undefined;
    const priority = typeof item.priority === 'boolean' ? item.priority : undefined;

    drafts.push(
      validateDraft({
        id: newDraftId(),
        date: todayIso(),
        kind,
        amount,
        description: description.charAt(0).toUpperCase() + description.slice(1),
        category: kind === 'expense' ? guessCategory(description) : undefined,
        customerName,
        quantity,
        unitPrice,
        platformName,
        priority,
        orderItems,
        source,
        confidence: 0.75,
      }),
    );
  }
  return drafts;
}

export async function extractBulkDrafts(
  message: string,
  source: DraftSource = 'text',
): Promise<{ drafts: DraftRecord[]; llmSource: 'cloud' | 'local' | 'kilo' | 'groq' | 'gemini' | 'openrouter' | 'siliconflow' } | null> {
  const prompt = `${BULK_PROMPT}\n\nTin nhắn:\n"""${message.slice(0, 6000)}"""\n\nJSON:`;
  const res = await callLlm(prompt);
  if (!res) return null;
  const drafts = normalizeBulkExtract(extractJsonObject(res.text), source);
  const hasOrder = drafts.some((d) => (d.orderItems?.length ?? 0) > 0);
  if (drafts.length < 2 && !hasOrder) return null;
  return { drafts, llmSource: res.source };
}

export { BULK_PROMPT };
