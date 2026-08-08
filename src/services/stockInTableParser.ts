/**
 * Parse spreadsheet / TSV product line tables:
 * STT | Tên mẫu | giá | Số lượng | Thành tiền
 * — stock-in (nhập hàng) → expense drafts
 * — sales (đã bán được) → revenue drafts
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

export interface StockInTableParseResult {
  isTable: boolean;
  drafts: DraftRecord[];
  skipped: string[];
}

interface ColMap {
  name: number;
  unitPrice: number;
  qty: number;
  amount: number;
}

interface ParsedLine {
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

function parseAmountCell(raw: string): number | null {
  const cleaned = raw.trim().replace(/[₫đ]/g, 'đ');
  if (!cleaned) return null;
  const direct = parseMoney(cleaned.replace(/\s*đ$/i, '').trim());
  if (direct && direct.amountVnd > 0) return direct.amountVnd;
  const trailing = extractTrailingMoney(cleaned);
  return trailing?.money.amountVnd ?? null;
}

function parseQtyCell(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Math.round(Number(t));
  if (!Number.isFinite(n) || n < 1 || n > 100_000) return null;
  return n;
}

/** Header row for product line sheets (stock-in or sales). */
export function isStockInHeaderRow(cells: string[]): boolean {
  const joined = cells.map((c) => c.toLowerCase().trim()).join(' ');
  if (/tên\s*khách|khách\s*hàng/.test(joined)) return false;
  const hasName =
    /tên\s*mẫu|tên\s*sản\s*phẩm|tên\s*sp|\bsản\s*phẩm\b|\bmẫu\b/.test(joined) ||
    (/\bstt\b/.test(joined) && /\btên\b/.test(joined));
  const hasQty = /số\s*lượng|\bsl\b|\bqty\b/.test(joined);
  const hasMoney = /thành\s*tiền|đơn\s*giá|giá\s*1|\bgiá\b/.test(joined);
  return hasName && hasQty && hasMoney;
}

function mapColumns(header: string[]): ColMap | null {
  const idxs = {
    name: -1,
    unitPrice: -1,
    qty: -1,
    amount: -1,
  };
  header.forEach((cell, i) => {
    const t = cell.toLowerCase().trim();
    if (!t || /^stt$|^#$|^tt$/.test(t)) return;
    if (idxs.amount < 0 && /thành\s*tiền|tổng\s*tiền|thành\s*tiên/.test(t)) {
      idxs.amount = i;
      return;
    }
    if (idxs.qty < 0 && /số\s*lượng|^sl$|^qty$/.test(t)) {
      idxs.qty = i;
      return;
    }
    if (idxs.unitPrice < 0 && /đơn\s*giá|giá\s*1|giá/.test(t)) {
      idxs.unitPrice = i;
      return;
    }
    if (
      idxs.name < 0 &&
      (/tên|mẫu|sản\s*phẩm|^sp$|hàng\s*hóa/.test(t) || t.includes('tên'))
    ) {
      idxs.name = i;
    }
  });
  if (idxs.name < 0 || idxs.qty < 0) return null;
  if (idxs.amount < 0) idxs.amount = idxs.unitPrice;
  if (idxs.amount < 0) return null;
  if (idxs.unitPrice < 0) idxs.unitPrice = idxs.amount;
  return idxs as ColMap;
}

function defaultColMap(width: number): ColMap | null {
  if (width >= 5) return { name: 1, unitPrice: 2, qty: 3, amount: 4 };
  if (width === 4) return { name: 0, unitPrice: 1, qty: 2, amount: 3 };
  return null;
}

export function hasNhapHangCue(message: string): boolean {
  return /^nhập\s*hàng\b/im.test(message.trim());
}

/** Sales paste cue — product line sheet (STT|tên|giá|SL|tt), not cash “đã thu” table. */
export function hasSalesProductCue(message: string): boolean {
  return /đã\s*bán(?:\s*được)?\b|^bán\s*được\b/im.test(message.trim());
}

function hasProductLineHeader(message: string): boolean {
  return parseTsvRows(message).some((r) => r.length >= 4 && isStockInHeaderRow(r));
}

export function looksLikeStockInTable(message: string): boolean {
  if (!message.includes('\t')) return false;
  if (hasSalesProductCue(message)) return false;
  if (hasNhapHangCue(message)) {
    return parseTsvRows(message).some((r) => r.length >= 4);
  }
  return hasProductLineHeader(message);
}

export function looksLikeSalesProductTable(message: string): boolean {
  if (!message.includes('\t')) return false;
  if (!hasSalesProductCue(message)) return false;
  return (
    hasProductLineHeader(message) ||
    parseTsvRows(message).some((r) => r.length >= 4)
  );
}

function capitalize(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function parseProductLines(message: string): {
  lines: ParsedLine[];
  skipped: string[];
  sawHeader: boolean;
} {
  const rows = parseTsvRows(message);
  let cols: ColMap | null = null;
  const lines: ParsedLine[] = [];
  const skipped: string[] = [];
  let sawHeader = false;

  for (const row of rows) {
    if (row.length === 1) {
      const only = row[0]!.trim();
      if (
        /^nhập\s*hàng\b/i.test(only) ||
        /đã\s*bán(?:\s*được)?\b|^bán\s*được\b|^doanh\s*thu\b/i.test(only)
      ) {
        continue;
      }
    }
    if (row.length < 3) continue;
    if (isStockInHeaderRow(row)) {
      cols = mapColumns(row) ?? defaultColMap(row.length);
      sawHeader = true;
      continue;
    }

    if (!cols) cols = defaultColMap(row.length);
    if (!cols) {
      skipped.push(row.join(' ').slice(0, 60));
      continue;
    }

    const name = (row[cols.name] ?? '').trim();
    const qty = parseQtyCell(row[cols.qty] ?? '');
    const unitPrice = parseAmountCell(row[cols.unitPrice] ?? '');
    let amount = parseAmountCell(row[cols.amount] ?? '');

    if (!name || name.length < 2) {
      skipped.push(`Thiếu tên mẫu (${row.join(' ').slice(0, 40)})`);
      continue;
    }
    if (qty == null) {
      skipped.push(`${name}: thiếu số lượng`);
      continue;
    }
    if (amount == null || amount <= 0) {
      if (unitPrice != null && unitPrice > 0) amount = unitPrice * qty;
      else {
        skipped.push(`${name}: thiếu thành tiền`);
        continue;
      }
    }

    const resolvedUnit =
      unitPrice != null && unitPrice > 0 ? unitPrice : Math.max(1, Math.round(amount / qty));

    lines.push({
      name: capitalize(name),
      qty,
      unitPrice: resolvedUnit,
      amount,
    });
  }

  return { lines, skipped, sawHeader };
}

export function parseStockInTableDrafts(
  message: string,
  source: DraftSource = 'text',
): StockInTableParseResult {
  if (!looksLikeStockInTable(message)) {
    return { isTable: false, drafts: [], skipped: [] };
  }

  const { lines, skipped, sawHeader } = parseProductLines(message);
  const drafts = lines.map((line) =>
    validateDraft({
      id: newDraftId(),
      kind: 'expense',
      date: todayIso(),
      amount: line.amount,
      description: line.name,
      category: 'supplies',
      quantity: line.qty,
      unitPrice: line.unitPrice,
      source,
      confidence: 0.94,
    }),
  );

  const isTable =
    (sawHeader || hasNhapHangCue(message)) && drafts.length + skipped.length >= 1;
  return { isTable, drafts, skipped };
}

/** "đã bán được" + product line TSV → revenue drafts (paid walk-in lines). */
export function parseSalesProductTableDrafts(
  message: string,
  source: DraftSource = 'text',
): StockInTableParseResult {
  if (!looksLikeSalesProductTable(message)) {
    return { isTable: false, drafts: [], skipped: [] };
  }

  const { lines, skipped, sawHeader } = parseProductLines(message);
  const drafts = lines.map((line) => {
    const description =
      line.qty > 1 ? `${line.qty} × ${line.name}` : line.name;
    return validateDraft({
      id: newDraftId(),
      kind: 'revenue',
      date: todayIso(),
      amount: line.amount,
      description,
      quantity: line.qty,
      unitPrice: line.unitPrice,
      orderItems: [
        {
          name: line.name,
          quantity: line.qty,
          unitPrice: line.unitPrice,
        },
      ],
      paymentStatus: 'paid',
      orderStatus: 'completed',
      source,
      confidence: 0.94,
    });
  });

  const isTable =
    (sawHeader || hasSalesProductCue(message)) && drafts.length + skipped.length >= 1;
  return { isTable, drafts, skipped };
}
