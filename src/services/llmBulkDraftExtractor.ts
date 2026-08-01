/**
 * LLM bulk line-item extract — when regex line-list cannot parse a paste.
 */

import { geminiService } from './geminiService';
import { webLLM } from './webLLM';
import { useAuthStore } from '@/store/authStore';
import {
  newDraftId,
  todayIso,
  validateDraft,
  type DraftRecord,
  type DraftSource,
} from './draftTypes';
import { guessCategory } from './textDraftParser';

const BULK_PROMPT = `Bạn là bộ trích xuất danh sách thu/chi từ tin nhắn tiếng Việt (thường paste nhiều dòng).
CHỈ trả về 1 object JSON hợp lệ, KHÔNG markdown, KHÔNG giải thích.

Schema:
{
  "kind": "expense"|"revenue",
  "items": [ { "description": string, "amount": number } ]
}

Quy tắc:
- Mỗi dòng hàng + tiền → 1 item. amount luôn là VND số nguyên (798.000 → 798000, 25k → 25000).
- Bỏ header kiểu "thêm chi phí:", "thêm doanh thu:".
- kind=expense nếu ngữ cảnh chi phí / mua nguyên liệu; revenue nếu bán/thu.
- Bỏ dòng không có tiền hoặc không có mô tả.
- Không gộp nhiều dòng thành 1 item.`;

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

async function callLlm(prompt: string): Promise<{ text: string; source: 'cloud' | 'local' } | null> {
  const { geminiConfigured } = useAuthStore.getState();
  if (geminiConfigured && navigator.onLine && geminiService.isConfigured) {
    try {
      const text = await geminiService.generateContent(prompt);
      if (text && !text.startsWith('Lỗi Gemini:') && !text.startsWith('[Gemini chưa')) {
        return { text, source: 'cloud' };
      }
    } catch {
      /* fallback local */
    }
  }

  try {
    const text = await webLLM.generate(prompt, { mode: 'raw', maxTokens: 1024 });
    if (
      text &&
      !text.startsWith('⚠️') &&
      !text.startsWith('⏳') &&
      !text.startsWith('Lỗi sinh')
    ) {
      return { text, source: 'local' };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export interface BulkExtractRaw {
  kind?: string;
  items?: Array<{ description?: unknown; amount?: unknown }>;
}

/** Pure normalize — used by tests and after LLM. */
export function normalizeBulkExtract(
  raw: unknown,
  source: DraftSource = 'text',
): DraftRecord[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as BulkExtractRaw;
  const kind = o.kind === 'revenue' ? 'revenue' : 'expense';
  if (!Array.isArray(o.items)) return [];

  const drafts: DraftRecord[] = [];
  for (const item of o.items) {
    if (!item || typeof item !== 'object') continue;
    const description =
      typeof item.description === 'string' ? item.description.trim() : '';
    let amount =
      typeof item.amount === 'number' && Number.isFinite(item.amount)
        ? Math.round(item.amount)
        : typeof item.amount === 'string'
          ? Math.round(Number(String(item.amount).replace(/[^\d.]/g, '')))
          : 0;
    if (!(amount > 0) || description.length < 2) continue;

    drafts.push(
      validateDraft({
        id: newDraftId(),
        date: todayIso(),
        kind,
        amount,
        description: description.charAt(0).toUpperCase() + description.slice(1),
        category: kind === 'expense' ? guessCategory(description) : undefined,
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
): Promise<{ drafts: DraftRecord[]; llmSource: 'cloud' | 'local' } | null> {
  const prompt = `${BULK_PROMPT}\n\nTin nhắn:\n"""${message.slice(0, 6000)}"""\n\nJSON:`;
  const res = await callLlm(prompt);
  if (!res) return null;
  const drafts = normalizeBulkExtract(extractJsonObject(res.text), source);
  if (drafts.length < 2) return null;
  return { drafts, llmSource: res.source };
}
