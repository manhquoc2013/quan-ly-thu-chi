/**
 * Parse cash-collected / opening-balance revenue paste:
 * doanh thu … đã thu được:   OR   doanh thu đến hiện tại (không chi tiết hàng)
 * Nội dung | Số tiền | Date
 */

import { extractTrailingMoney, parseMoney } from './amountParser';
import {
  newDraftId,
  todayIso,
  validateDraft,
  type DraftRecord,
  type DraftSource,
} from './draftTypes';
import { parseTsvRows } from './orderTableParser';

export interface RevenueCashTableResult {
  isTable: boolean;
  drafts: DraftRecord[];
  skipped: string[];
}

/** Cue for cash table / opening balance paste (not order lookup). */
const CUE =
  /doanh\s*thu[\s\S]{0,60}đã\s*thu(?:\s*được)?\b|đã\s*thu\s*được\b|^đã\s*thu\b|doanh\s*thu\s*đến\s*hiện\s*tại|tổng\s*đến\s*hiện\s*tại|đơn\s*gốc\s*không\s*có\s*hàng|không\s*có\s*hàng|ghi\s*nhận\s*vào/im;

function isSummaryLabel(name: string): boolean {
  return /^tổng\b/i.test(name.trim());
}

/** Pull DD/MM from "…, ghi nhận vào 31/07" or trailing date in amount cell. */
function extractDateFromCell(raw: string, now = new Date()): {
  text: string;
  date: string | null;
} {
  let text = raw.trim();
  const m =
    /(?:,\s*)?(?:ghi\s*nhận\s*vào\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*$/i.exec(
      text,
    );
  if (!m || m.index == null) return { text, date: null };
  const date = parseDayMonthDate(m[1]!, now);
  text = text.slice(0, m.index).replace(/[,\s]+$/g, '').trim();
  return { text, date };
}

function isHeaderRow(cells: string[]): boolean {
  const j = cells.map((c) => c.toLowerCase().trim()).join(' ');
  return /nội\s*dung|khách|tên/.test(j) && /số\s*tiền|thành\s*tiền|tiền/.test(j);
}

/** Parse DD/MM or DD/MM/YY(YY) → yyyy-MM-dd (current year if omitted). */
export function parseDayMonthDate(raw: string, now = new Date()): string | null {
  const t = raw.trim();
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(t);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] != null ? Number(m[3]) : now.getFullYear();
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const check = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(check.getTime())) return null;
  if (check.getMonth() + 1 !== month || check.getDate() !== day) return null;
  return iso;
}

function parseAmountCell(raw: string): number | null {
  const { text } = extractDateFromCell(raw);
  const cleaned = text.replace(/[₫đ]/g, 'đ').trim();
  if (!cleaned) return null;
  const direct = parseMoney(cleaned.replace(/\s*đ$/i, '').trim());
  if (direct && direct.amountVnd > 0) return direct.amountVnd;
  const trailing = extractTrailingMoney(cleaned);
  return trailing?.money.amountVnd ?? null;
}

export function looksLikeRevenueCashTable(message: string): boolean {
  if (!message.includes('\t')) return false;
  if (!CUE.test(message.trim())) return false;
  const rows = parseTsvRows(message);
  return rows.some((r) => r.length >= 2 && (isHeaderRow(r) || parseAmountCell(r[1] ?? '') != null));
}

function capitalize(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface ParsedCashRow {
  name: string;
  amount: number;
  date: string;
  summary: boolean;
}

export function parseRevenueCashTableDrafts(
  message: string,
  source: DraftSource = 'text',
): RevenueCashTableResult {
  if (!looksLikeRevenueCashTable(message)) {
    return { isTable: false, drafts: [], skipped: [] };
  }

  const paid =
    /đã\s*thu/i.test(message) ||
    /đến\s*hiện\s*tại/i.test(message) ||
    /không\s*có\s*hàng/i.test(message) ||
    /ghi\s*nhận\s*vào/i.test(message);
  const rows = parseTsvRows(message);
  const parsed: ParsedCashRow[] = [];
  const skipped: string[] = [];
  let sawHeader = false;

  for (const row of rows) {
    if (row.length === 1 && CUE.test(row[0]!.trim())) continue;
    if (row.length < 2) continue;
    if (isHeaderRow(row)) {
      sawHeader = true;
      continue;
    }

    const name = (row[0] ?? '').trim();
    const amountRaw = row[1] ?? '';
    const fromAmount = extractDateFromCell(amountRaw);
    const amount = parseAmountCell(amountRaw);
    const dateRaw = (row[2] ?? '').trim();
    const date =
      (dateRaw ? parseDayMonthDate(dateRaw) : null) ?? fromAmount.date;

    if (!name || name.length < 2) {
      skipped.push(`Thiếu nội dung (${row.join(' ').slice(0, 40)})`);
      continue;
    }
    if (amount == null || amount <= 0) {
      skipped.push(`${name}: thiếu số tiền`);
      continue;
    }

    parsed.push({
      name,
      amount,
      date: date ?? todayIso(),
      summary: isSummaryLabel(name),
    });
  }

  const details = parsed.filter((r) => !r.summary);
  const summaries = parsed.filter((r) => r.summary);
  const drafts: DraftRecord[] = [];

  if (details.length > 0) {
    // Full cash list: skip subtotal rows (avoid double-count)
    for (const s of summaries) {
      skipped.push(`Bỏ dòng tổng: ${s.name}`);
    }
    for (const row of details) {
      drafts.push(
        validateDraft({
          id: newDraftId(),
          kind: 'revenue',
          date: row.date,
          amount: row.amount,
          description: capitalize(row.name),
          customerName: capitalize(row.name),
          paymentStatus: paid ? 'paid' : 'unpaid',
          orderStatus: paid ? 'completed' : 'new',
          source,
          confidence: 0.93,
        }),
      );
    }
  } else if (summaries.length > 0) {
    // Opening balance / “đơn gốc không có hàng”: keep tổng as one paid revenue
    for (const row of summaries) {
      drafts.push(
        validateDraft({
          id: newDraftId(),
          kind: 'revenue',
          date: row.date,
          amount: row.amount,
          description: 'Doanh thu đến hiện tại',
          notes: 'Đơn gốc không có chi tiết hàng',
          paymentStatus: 'paid',
          orderStatus: 'completed',
          source,
          confidence: 0.92,
        }),
      );
    }
  }

  const isTable = (sawHeader || CUE.test(message)) && drafts.length + skipped.length >= 1;
  return { isTable, drafts, skipped };
}
