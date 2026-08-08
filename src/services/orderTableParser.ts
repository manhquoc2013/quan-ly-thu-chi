/**
 * Parse spreadsheet / TSV paste of orders:
 * Khách | Nền tảng | Nội dung | Số tiền | Trạng thái | NOTE
 */

import type { OrderStatus, PaymentStatus } from '@/models';
import { extractTrailingMoney, parseMoney } from './amountParser';
import {
  newDraftId,
  todayIso,
  validateDraft,
  type DraftOrderItem,
  type DraftRecord,
  type DraftSource,
} from './draftTypes';

export interface OrderTableParseResult {
  isTable: boolean;
  drafts: DraftRecord[];
  skipped: string[];
}

/** Tab-separated with quoted fields (may contain newlines). */
export function parseTsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/^\uFEFF/, '');

  while (i < s.length) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === '\t') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.map((c) => c.toLowerCase().trim()).join(' ');
  return (
    /tên\s*khách|khách\s*hàng/.test(joined) &&
    (/nền\s*tảng|kênh|platform/.test(joined) || /nội\s*dung|sản\s*phẩm/.test(joined))
  );
}

/** Column indices for order sheets (supports leading STT). */
interface OrderColMap {
  customer: number;
  platform: number;
  content: number;
  amount: number;
  status: number;
  note: number;
}

const DEFAULT_COLS: OrderColMap = {
  customer: 0,
  platform: 1,
  content: 2,
  amount: 3,
  status: 4,
  note: 5,
};

function colMapFromHeader(cells: string[]): OrderColMap {
  const lower = cells.map((c) => c.toLowerCase().trim());
  const idx = (...pats: RegExp[]) =>
    lower.findIndex((h) => pats.some((p) => p.test(h)));

  const customer = idx(/tên\s*khách|khách\s*hàng/);
  const platform = idx(/nền\s*tảng|kênh|platform/);
  const content = idx(/nội\s*dung|sản\s*phẩm|chi\s*tiết/);
  const amount = idx(/số\s*tiền|thành\s*tiền|tiền/);
  const status = idx(/trạng\s*thái/);
  const note = idx(/\bnote\b|ghi\s*chú/);

  if (customer >= 0 && content >= 0 && amount >= 0) {
    return {
      customer,
      platform: platform >= 0 ? platform : customer + 1,
      content,
      amount,
      status: status >= 0 ? status : amount + 1,
      note: note >= 0 ? note : amount + 2,
    };
  }

  // STT | Khách | Nền tảng | Nội dung | Số tiền | …
  if (/\bstt\b/.test(lower[0] ?? '') || customer === 1) {
    return {
      customer: customer >= 0 ? customer : 1,
      platform: platform >= 0 ? platform : 2,
      content: content >= 0 ? content : 3,
      amount: amount >= 0 ? amount : 4,
      status: status >= 0 ? status : 5,
      note: note >= 0 ? note : 6,
    };
  }

  return DEFAULT_COLS;
}

function cellAt(row: string[], index: number): string {
  return (row[index] ?? '').trim();
}

/** Heuristic when no header: leading numeric STT cell. */
function inferCols(row: string[]): OrderColMap {
  if (row.length >= 5 && /^\d{1,4}$/.test((row[0] ?? '').trim())) {
    return {
      customer: 1,
      platform: 2,
      content: 3,
      amount: 4,
      status: 5,
      note: 6,
    };
  }
  return DEFAULT_COLS;
}

function normalizePlatform(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (/tik\s*tok|tiktok/i.test(t)) return 'TikTok';
  if (/shopee|shope|shoppe/i.test(t)) return 'Shopee';
  if (/zalo|\bzl\b/i.test(t)) return 'Zalo';
  if (/facebook|\bfb\b/i.test(t)) return 'Facebook';
  if (/website|\bweb\b/i.test(t)) return 'Website';
  if (/trực\s*tiếp|offline/i.test(t)) return 'Trực tiếp';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function parseOrderStatus(raw: string): OrderStatus | undefined {
  const t = raw.toLowerCase().trim();
  if (!t) return undefined;
  if (/đã\s*xong|hoàn\s*thành|completed|done/.test(t)) return 'completed';
  if (/hủy|huỷ|cancel/.test(t)) return 'cancelled';
  if (/đang\s*xử\s*lý|processing/.test(t)) return 'processing';
  if (/xác\s*nhận|confirmed/.test(t)) return 'confirmed';
  if (/mới|new/.test(t)) return 'new';
  return undefined;
}

function parsePaymentFromNote(note: string): {
  paymentStatus?: PaymentStatus;
  notes?: string;
} {
  const t = note.trim();
  if (!t) return {};
  if (/đã\s*trả(\s*tiền)?|đã\s*thanh\s*toán|paid|rồi\s*trả/i.test(t)) {
    const rest = t
      .replace(/đã\s*trả(\s*tiền)?|đã\s*thanh\s*toán|paid/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { paymentStatus: 'paid', notes: rest || undefined };
  }
  return { notes: t };
}

function parseAmountCell(raw: string): number | null {
  const cleaned = raw.trim().replace(/[₫đ]/g, 'đ');
  if (!cleaned) return null;
  const direct = parseMoney(cleaned.replace(/\s*đ$/i, '').trim());
  if (direct && direct.amountVnd > 0) return direct.amountVnd;
  const trailing = extractTrailingMoney(cleaned);
  return trailing?.money.amountVnd ?? null;
}

function isShipName(name: string): boolean {
  return /^(ship|phí\s*ship|vận\s*chuyển|ship\s*cod)$/i.test(name.trim());
}

function parseBareThousands(raw: string, amount: number): number {
  if (amount > 0 && amount < 1000 && !/[ktr]/i.test(raw)) return amount * 1000;
  return amount;
}

export interface ParsedOrderContent {
  items: DraftOrderItem[];
  shippingFee: number;
}

type PartialItem = { name: string; quantity: number; unitPrice?: number };

/**
 * Split content into product lines.
 * Newlines always; commas only when the next token starts another qty ("1 a, 1 b").
 * Keeps "1, chó" as one line (comma after qty, not between items).
 */
function splitContentLines(text: string): string[] {
  const out: string[] = [];
  for (const block of text.split(/\n+/)) {
    const parts = block.split(/,\s*(?=\d+\s*[.)×x]?\s+\S)/);
    for (const part of parts) {
      const line = part
        .trim()
        .replace(/^(\d+)\s*,\s+(?=\S)/, '$1 ');
      if (line) out.push(line);
    }
  }
  return out;
}

/** Spread a VND budget across unpriced lines by quantity units (last line absorbs remainder). */
function allocateBudgetByQty(
  lines: PartialItem[],
  budget: number,
): DraftOrderItem[] {
  const totalQty = lines.reduce((s, p) => s + p.quantity, 0);
  if (totalQty <= 0) {
    return [{ name: 'Sản phẩm', quantity: 1, unitPrice: Math.max(1, budget) }];
  }
  let remaining = Math.max(0, budget);
  return lines.map((p, i) => {
    const isLast = i === lines.length - 1;
    const lineTotal = isLast
      ? remaining
      : Math.floor((budget * p.quantity) / totalQty);
    if (!isLast) remaining -= lineTotal;
    return {
      name: p.name,
      quantity: p.quantity,
      unitPrice: Math.max(1, Math.round(lineTotal / p.quantity)),
    };
  });
}

/** Parse content cell into line items + shipping fee (Ship=… extracted). */
export function parseOrderContentItems(
  content: string,
  totalAmount: number,
): ParsedOrderContent {
  const text = content.replace(/"/g, '').trim();
  if (!text) {
    return {
      items: [{ name: 'Sản phẩm', quantity: 1, unitPrice: totalAmount }],
      shippingFee: 0,
    };
  }

  const rawLines = splitContentLines(text);
  const partials: PartialItem[] = [];
  let shippingFee = 0;

  for (const line of rawLines) {
    // "Ship=11" / "Phí ship: 15"
    const feePriced = line.match(
      /^(ship|phí\s*ship|vận\s*chuyển|ship\s*cod)\s*[=:]\s*(\d[\d.,]*)\s*(?:k|₫|đ)?\s*$/i,
    );
    if (feePriced) {
      const money = parseMoney(feePriced[2]!);
      let fee = money?.amountVnd ?? 0;
      fee = parseBareThousands(feePriced[2]!, fee);
      if (fee > 0) shippingFee += fee;
      continue;
    }

    // "1 kẹp hoa = 15" / "1. bó hoa -> đã móc" / "1 chậu: 65k"
    const priced = line.match(
      /^(\d+)\s*[.)]?\s*(.+?)\s*[=:]\s*(\d[\d.,]*)\s*(k|₫|đ)?\s*$/i,
    );
    if (priced) {
      const quantity = Math.max(1, parseInt(priced[1]!, 10) || 1);
      let name = priced[2]!.replace(/\s*->\s*.*$/i, '').trim();
      const token = `${priced[3]!}${priced[4] ?? ''}`;
      const money = parseMoney(token);
      let unitPrice = money?.amountVnd ?? 0;
      unitPrice = parseBareThousands(token, unitPrice);
      if (isShipName(name) && unitPrice > 0) {
        shippingFee += unitPrice * quantity;
        continue;
      }
      if (name.length < 1) name = 'Sản phẩm';
      partials.push({ name, quantity, unitPrice: unitPrice > 0 ? unitPrice : undefined });
      continue;
    }

    const qtyName = line.match(/^(\d+)\s*[.)×x]?\s+(.+)$/i);
    if (qtyName) {
      let name = qtyName[2]!
        .replace(/\s*->\s*.*$/i, '')
        .replace(/\s*=\s*ok\s*$/i, '')
        .trim();
      if (name.length < 1) continue;
      if (isShipName(name)) continue;
      partials.push({
        name,
        quantity: Math.max(1, parseInt(qtyName[1]!, 10) || 1),
      });
      continue;
    }

    if (line.length >= 2) {
      const name = line.replace(/\s*->\s*.*$/i, '').trim();
      if (isShipName(name)) continue;
      partials.push({ name, quantity: 1 });
    }
  }

  const goodsBudget = Math.max(0, totalAmount - shippingFee);

  if (partials.length === 0) {
    return {
      items: [
        {
          name: text.slice(0, 120),
          quantity: 1,
          unitPrice: Math.max(1, goodsBudget || totalAmount),
        },
      ],
      shippingFee,
    };
  }

  const pricedSum = partials.reduce(
    (s, p) => s + (p.unitPrice != null ? p.unitPrice * p.quantity : 0),
    0,
  );
  const unpriced = partials.filter((p) => p.unitPrice == null);
  const priced = partials.filter((p) => p.unitPrice != null);

  let items: DraftOrderItem[];

  if (unpriced.length === 0) {
    if (pricedSum > 0 && Math.abs(pricedSum - goodsBudget) > 1 && goodsBudget > 0) {
      const factor = goodsBudget / pricedSum;
      items = priced.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        unitPrice: Math.max(1, Math.round((p.unitPrice ?? 0) * factor)),
      }));
    } else {
      items = priced.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        unitPrice: Math.max(1, p.unitPrice ?? 1),
      }));
    }
  } else if (priced.length === 0) {
    // Keep each product as its own line; split sheet total by quantity units.
    items = allocateBudgetByQty(partials, goodsBudget);
  } else {
    const remaining = Math.max(0, goodsBudget - pricedSum);
    items = priced.map((p) => ({
      name: p.name,
      quantity: p.quantity,
      unitPrice: Math.max(1, p.unitPrice ?? 1),
    }));
    if (remaining > 0 && unpriced.length > 0) {
      items.push(...allocateBudgetByQty(unpriced, remaining));
    }
  }

  return { items, shippingFee };
}

/** Inventory / product-line paste (STT | tên | giá | SL | thành tiền) — not khách|kênh order sheet. */
function isInventorySpreadsheet(message: string): boolean {
  if (!message.includes('\t')) return false;
  // Product-line / cash-receipt sheets — not khách|kênh order table.
  if (
    /đã\s*bán(?:\s*được)?\b|^bán\s*được\b|doanh\s*thu[\s\S]{0,60}đã\s*thu|đã\s*thu\s*được\b|doanh\s*thu\s*đến\s*hiện\s*tại|đơn\s*gốc\s*không\s*có\s*hàng|^nhập\s*hàng\b/im.test(
      message.trim(),
    )
  ) {
    return true;
  }
  if (/^nhập\s*hàng\b/im.test(message.trim())) return true;
  const rows = parseTsvRows(message);
  return rows.some((row) => {
    const joined = row.map((c) => c.toLowerCase().trim()).join(' ');
    if (/tên\s*khách|khách\s*hàng/.test(joined)) return false;
    const hasName =
      /tên\s*mẫu|tên\s*sản\s*phẩm|tên\s*sp/.test(joined) ||
      (/\bstt\b/.test(joined) && /\btên\b/.test(joined) && /giá|thành\s*tiền/.test(joined));
    return hasName && /số\s*lượng|\bsl\b|\bqty\b/.test(joined);
  });
}

export function looksLikeOrderTable(message: string): boolean {
  if (!message.includes('\t')) return false;
  if (isInventorySpreadsheet(message)) return false;
  const rows = parseTsvRows(message);
  if (rows.length < 1) return false;
  let cols = DEFAULT_COLS;
  let dataRows = 0;
  let moneyRows = 0;
  for (const row of rows) {
    if (row.length < 3) continue;
    if (isHeaderRow(row)) {
      cols = colMapFromHeader(row);
      continue;
    }
    dataRows += 1;
    const map = cols === DEFAULT_COLS ? inferCols(row) : cols;
    const amountCell = cellAt(row, map.amount);
    if (parseAmountCell(amountCell) != null || extractTrailingMoney(amountCell)) {
      moneyRows += 1;
    }
  }
  // ≥1 data row with tab columns + money, or ≥2 tab rows looking like orders
  return moneyRows >= 1 && dataRows >= 1 && rows.some((r) => r.length >= 4);
}

export function parseOrderTableDrafts(
  message: string,
  source: DraftSource = 'text',
): OrderTableParseResult {
  if (!message.includes('\t')) {
    return { isTable: false, drafts: [], skipped: [] };
  }
  if (isInventorySpreadsheet(message)) {
    return { isTable: false, drafts: [], skipped: [] };
  }

  const rows = parseTsvRows(message);
  const drafts: DraftRecord[] = [];
  const skipped: string[] = [];
  let sawHeader = false;
  let dataSeen = 0;
  let cols = DEFAULT_COLS;

  for (const row of rows) {
    if (row.length < 3) continue;
    if (isHeaderRow(row)) {
      sawHeader = true;
      cols = colMapFromHeader(row);
      continue;
    }

    const map = sawHeader ? cols : inferCols(row);
    const customer = cellAt(row, map.customer);
    const platformRaw = cellAt(row, map.platform);
    const content = cellAt(row, map.content);
    const amountRaw = cellAt(row, map.amount);
    const statusRaw = cellAt(row, map.status);
    const noteRaw = cellAt(row, map.note);

    if (!customer && !content && !amountRaw) continue;
    dataSeen += 1;

    const parsedAmount = parseAmountCell(amountRaw);
    const amountMissing = parsedAmount == null || parsedAmount <= 0;

    // No money on sheet: still create unpaid order if we have customer and/or product lines.
    if (amountMissing && !content.trim() && !customer.trim()) {
      skipped.push('Hàng trống (thiếu khách và nội dung)');
      continue;
    }
    if (amountMissing && !content.trim()) {
      skipped.push(
        customer
          ? `${customer}: thiếu nội dung sản phẩm (và chưa có số tiền)`
          : 'Hàng thiếu nội dung và số tiền',
      );
      continue;
    }

    const seedAmount = amountMissing ? 0 : parsedAmount!;
    const { items: orderItems, shippingFee } = parseOrderContentItems(
      content || customer || 'Đơn hàng',
      seedAmount,
    );

    if (amountMissing) {
      for (const it of orderItems) it.unitPrice = 0;
    }

    let amount = amountMissing
      ? 0
      : parsedAmount!;

    if (!amountMissing) {
      const goodsTarget = Math.max(0, amount - shippingFee);
      const itemsTotal = orderItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      if (orderItems.length && itemsTotal !== goodsTarget && goodsTarget > 0) {
        const last = orderItems[orderItems.length - 1]!;
        const others = itemsTotal - last.quantity * last.unitPrice;
        last.unitPrice = Math.max(1, Math.round((goodsTarget - others) / last.quantity));
      }
    }

    if (orderItems.length < 1) {
      skipped.push(
        customer
          ? `${customer}: không tạo được dòng hàng`
          : 'Không tạo được dòng hàng',
      );
      continue;
    }

    const description =
      orderItems.length === 1
        ? orderItems[0]!.quantity > 1
          ? `${orderItems[0]!.quantity} × ${orderItems[0]!.name}`
          : orderItems[0]!.name
        : orderItems.map((it) => `${it.quantity} × ${it.name}`).join('; ');

    const { paymentStatus, notes: noteFromSheet } = parsePaymentFromNote(noteRaw);
    const orderStatus = parseOrderStatus(statusRaw);
    const platformName = normalizePlatform(platformRaw);
    const noteBits = [
      noteFromSheet,
      amountMissing ? 'Đơn 0đ — chưa có số tiền trên bảng' : undefined,
    ].filter(Boolean);

    drafts.push(
      validateDraft({
        id: newDraftId(),
        kind: 'revenue',
        date: todayIso(),
        amount,
        description: description.slice(0, 500),
        customerName: customer || undefined,
        platformName,
        orderItems,
        shippingFee: !amountMissing && shippingFee > 0 ? shippingFee : undefined,
        shippingPayer: !amountMissing && shippingFee > 0 ? 'customer' : undefined,
        quantity: orderItems.length === 1 ? orderItems[0]!.quantity : 1,
        unitPrice:
          orderItems.length === 1
            ? orderItems[0]!.unitPrice
            : undefined,
        orderStatus,
        paymentStatus: amountMissing ? 'unpaid' : paymentStatus ?? 'unpaid',
        notes: noteBits.join(' · ') || undefined,
        source,
        confidence: amountMissing ? 0.85 : 0.92,
      }),
    );
  }

  const isTable =
    (sawHeader && drafts.length + skipped.length >= 1) ||
    (dataSeen >= 1 && drafts.length >= 1 && rows.some((r) => r.length >= 4));

  return { isTable, drafts, skipped };
}
