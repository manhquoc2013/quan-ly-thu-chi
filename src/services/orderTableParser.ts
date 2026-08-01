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

  const rawLines = text
    .split(/\n|,/)
    .map((l) => l.trim())
    .filter(Boolean);

  type PartialItem = { name: string; quantity: number; unitPrice?: number };
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

    // "1 kẹp hoa = 15" / "1. bó hoa -> đã móc"
    const priced = line.match(
      /^(\d+)\s*[.)]?\s*(.+?)\s*[=:]\s*(\d[\d.,]*)\s*(?:k|₫|đ)?\s*$/i,
    );
    if (priced) {
      const quantity = Math.max(1, parseInt(priced[1]!, 10) || 1);
      let name = priced[2]!.replace(/\s*->\s*.*$/i, '').trim();
      const money = parseMoney(priced[3]!);
      let unitPrice = money?.amountVnd ?? 0;
      unitPrice = parseBareThousands(priced[3]!, unitPrice);
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
      let name = qtyName[2]!.replace(/\s*->\s*.*$/i, '').replace(/\s*=\s*ok\s*$/i, '').trim();
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
    if (partials.length === 1) {
      const only = partials[0]!;
      items = [
        {
          name: only.name,
          quantity: only.quantity,
          unitPrice: Math.max(1, Math.round(goodsBudget / only.quantity)),
        },
      ];
    } else {
      const summary = partials.map((p) => `${p.quantity} × ${p.name}`).join('; ');
      items = [{ name: summary.slice(0, 200), quantity: 1, unitPrice: Math.max(1, goodsBudget) }];
    }
  } else {
    const remaining = Math.max(0, goodsBudget - pricedSum);
    items = priced.map((p) => ({
      name: p.name,
      quantity: p.quantity,
      unitPrice: Math.max(1, p.unitPrice ?? 1),
    }));
    if (remaining > 0) {
      const summary = unpriced.map((p) => `${p.quantity} × ${p.name}`).join('; ');
      items.push({ name: summary.slice(0, 160), quantity: 1, unitPrice: remaining });
    }
  }

  return { items, shippingFee };
}

export function looksLikeOrderTable(message: string): boolean {
  if (!message.includes('\t')) return false;
  const rows = parseTsvRows(message);
  if (rows.length < 1) return false;
  let dataRows = 0;
  let moneyRows = 0;
  for (const row of rows) {
    if (row.length < 3) continue;
    if (isHeaderRow(row)) continue;
    dataRows += 1;
    const amountCell = row[3] ?? row[row.length - 1] ?? '';
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

  const rows = parseTsvRows(message);
  const drafts: DraftRecord[] = [];
  const skipped: string[] = [];
  let sawHeader = false;
  let dataSeen = 0;

  for (const row of rows) {
    if (row.length < 3) continue;
    if (isHeaderRow(row)) {
      sawHeader = true;
      continue;
    }

    const customer = (row[0] ?? '').trim();
    const platformRaw = (row[1] ?? '').trim();
    const content = (row[2] ?? '').trim();
    const amountRaw = (row[3] ?? '').trim();
    const statusRaw = (row[4] ?? '').trim();
    const noteRaw = (row[5] ?? '').trim();

    if (!customer && !content && !amountRaw) continue;
    dataSeen += 1;

    const amount = parseAmountCell(amountRaw);
    if (amount == null || amount <= 0) {
      skipped.push(
        customer
          ? `${customer}: thiếu số tiền`
          : `Hàng thiếu số tiền (${content.slice(0, 40) || '…'})`,
      );
      continue;
    }

    const { items: orderItems, shippingFee } = parseOrderContentItems(
      content || customer || 'Đơn hàng',
      amount,
    );
    const goodsTarget = Math.max(0, amount - shippingFee);
    const itemsTotal = orderItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    // Fix rounding drift on last item vs goods (sheet total − ship)
    if (orderItems.length && itemsTotal !== goodsTarget && goodsTarget > 0) {
      const last = orderItems[orderItems.length - 1]!;
      const others = itemsTotal - last.quantity * last.unitPrice;
      last.unitPrice = Math.max(1, Math.round((goodsTarget - others) / last.quantity));
    }

    const description =
      orderItems.length === 1
        ? orderItems[0]!.quantity > 1
          ? `${orderItems[0]!.quantity} × ${orderItems[0]!.name}`
          : orderItems[0]!.name
        : orderItems.map((it) => `${it.quantity} × ${it.name}`).join('; ');

    const { paymentStatus, notes } = parsePaymentFromNote(noteRaw);
    const orderStatus = parseOrderStatus(statusRaw);
    const platformName = normalizePlatform(platformRaw);

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
        shippingFee: shippingFee > 0 ? shippingFee : undefined,
        shippingPayer: shippingFee > 0 ? 'customer' : undefined,
        quantity: orderItems.length === 1 ? orderItems[0]!.quantity : 1,
        unitPrice:
          orderItems.length === 1
            ? orderItems[0]!.unitPrice
            : undefined,
        orderStatus,
        paymentStatus: paymentStatus ?? 'unpaid',
        notes,
        source,
        confidence: 0.92,
      }),
    );
  }

  const isTable =
    (sawHeader && drafts.length + skipped.length >= 1) ||
    (dataSeen >= 1 && drafts.length >= 1 && rows.some((r) => r.length >= 4));

  return { isTable, drafts, skipped };
}
