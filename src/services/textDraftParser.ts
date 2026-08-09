/**
 * Local command parser — broad Vietnamese patterns for instant text entry.
 * Text/voice: persist immediately (caller). File OCR/CSV: drafts for preview.
 */

import type { ExpenseCategory, ShippingPayer } from '@/models';
import {
  extractMoneyFromText,
  extractTrailingMoney,
  parseMoney,
  type ParsedMoney,
} from './amountParser';
import {
  newDraftId,
  todayIso,
  validateDraft,
  type DraftRecord,
  type DraftSource,
} from './draftTypes';
import { parseOrderTableDrafts } from './orderTableParser';
import {
  parseSalesProductTableDrafts,
  parseStockInTableDrafts,
} from './stockInTableParser';
import { parseRevenueCashTableDrafts } from './revenueCashTableParser';

const MONEY = String.raw`(\d[\d.,]*\s*(?:k|nghìn|ngàn|m|tr|triệu|trieu|usd|eur|jpy|cny|krw|sgd|aud|\$|đô(?:\s*la)?|₫|đ|vnd|đồng)?)`;

const BULK_HEADER =
  /^(?:thêm|tạo|ghi|hêm)\s+(?:chi\s*phí|khoản\s*chi|chi|doanh\s*thu|khoản\s*thu|thu|(?:các\s+)?(?:sản\s*phẩm|sp))\s*:?\s*$/i;
const EXPENSE_HEADER =
  /^(?:thêm|tạo|ghi|hêm)\s+(?:chi\s*phí|khoản\s*chi|chi)\s*:?\s*$|^chi\s*phí\s*:?\s*$/i;
const REVENUE_HEADER =
  /^(?:thêm|tạo|ghi|hêm)\s+(?:doanh\s*thu|khoản\s*thu|thu)\s*:?\s*$|^doanh\s*thu\s*:?\s*$/i;
const PRODUCT_HEADER =
  /^(?:thêm|tạo|ghi|hêm)\s+(?:các\s+)?(?:sản\s*phẩm|sp|hàng\s*hóa)\s*:?\s*$|^(?:danh\s*mục\s+)?(?:sản\s*phẩm|sp)\s*:?\s*$/i;
/** Column title row e.g. "STT Tên sản phẩm Đơn giá" */
const PRODUCT_COLUMN_HEADER = /^stt\b[\s\S]{0,40}đơn\s*giá/i;

/** Keywords that typically start a new create clause in a compound message */
const CLAUSE_START =
  String.raw`(?:bán\s+cho\b|bán\s+(?!cho\b)|mua\b|chi\b|thu\b|đổ\s*xăng\b|bơm\s*xăng\b|thêm\s+(?:chi|doanh|khoản)|tạo\s+(?:chi|doanh|khoản)|khách\s+\S+\s+(?:trả|đưa|chuyển)|doanh\s*thu\b|order\b|đơn\b)`;

/**
 * Split one message into multiple create clauses.
 * e.g. "bán cho Hoa … 40k bán cho Hà … 120k mua len 500k"
 */
export function splitCreateClauses(message: string): string[] {
  const normalized = message
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  const splitter = new RegExp(String.raw`\s+(?=${CLAUSE_START})`, 'gi');
  const parts = normalized
    .split(splitter)
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [normalized];
}

export function parseTextToDraft(
  message: string,
  source: DraftSource = 'text',
): DraftRecord | null {
  // Common mobile typos before matching
  const normalized = message.replace(/\bnết\b/gi, 'hết');
  const lower = normalized.toLowerCase().trim();
  if (!lower) return null;

  // Never treat pure analysis as create
  if (isAnalysisOnly(lower)) return null;

  const revenue = tryRevenue(lower, normalized, source);
  if (revenue) return validateDraft(revenue);

  const expense = tryExpense(lower, normalized, source);
  if (expense) return validateDraft(expense);

  return null;
}

/**
 * Parse spreadsheet-style paste: one "description + amount" per line.
 * Header lines like "thêm chi phí:" / "thêm sản phẩm:" set kind hint and are skipped.
 */
export function parseLineListDrafts(
  message: string,
  source: DraftSource = 'text',
): {
  drafts: DraftRecord[];
  skipped: string[];
  kindHint: 'expense' | 'revenue' | 'product' | null;
} {
  const rawLines = message
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let kindHint: 'expense' | 'revenue' | 'product' | null = null;
  const drafts: DraftRecord[] = [];
  const skipped: string[] = [];

  // Whole-message product / revenue cues (even if header is glued on first line)
  if (
    /(?:thêm|tạo|ghi|hêm)\s+(?:các\s+)?(?:sản\s*phẩm|sp)\b/i.test(message) ||
    /\bstt\b[\s\S]{0,40}đơn\s*giá/i.test(message)
  ) {
    kindHint = 'product';
  } else if (
    /doanh\s*thu\b/i.test(message) ||
    /đã\s*thu(?:\s*được)?\b/i.test(message)
  ) {
    kindHint = 'revenue';
  }
  const paidCue = /đã\s*thu(?:\s*được)?\b/i.test(message);

  for (const line of rawLines) {
    if (
      BULK_HEADER.test(line) ||
      EXPENSE_HEADER.test(line) ||
      REVENUE_HEADER.test(line) ||
      PRODUCT_HEADER.test(line) ||
      PRODUCT_COLUMN_HEADER.test(line) ||
      /^doanh\s*thu\b/i.test(line) ||
      /đã\s*thu(?:\s*được)?\b/i.test(line) ||
      /^nội\s*dung\b/i.test(line)
    ) {
      if (PRODUCT_HEADER.test(line) || PRODUCT_COLUMN_HEADER.test(line)) kindHint = 'product';
      else if (EXPENSE_HEADER.test(line)) kindHint = 'expense';
      else if (
        REVENUE_HEADER.test(line) ||
        /^doanh\s*thu\b/i.test(line) ||
        /đã\s*thu(?:\s*được)?\b/i.test(line)
      ) {
        kindHint = 'revenue';
      }
      continue;
    }

    const trailing = extractTrailingMoney(line);
    if (!trailing) {
      skipped.push(line);
      continue;
    }

    if (/^tổng\b/i.test(trailing.description.trim())) {
      skipped.push(`Bỏ dòng tổng: ${trailing.description}`);
      continue;
    }

    const kind: 'expense' | 'revenue' | 'product' =
      kindHint ??
      (/\b(bán|doanh\s*thu|khoản\s*thu)\b/i.test(trailing.description) ? 'revenue' : 'expense');

    // Only strip STT for product catalogs — keep "300 móc khóa" as expense qty wording
    const description = capitalize(
      kind === 'product' ? stripLeadingRowIndex(trailing.description) : trailing.description.trim(),
    );

    drafts.push(
      validateDraft(
        makeDraft({
          kind,
          amount: trailing.money.amountVnd,
          description,
          category: kind === 'expense' ? guessCategory(description) : undefined,
          customerName: kind === 'revenue' ? description : undefined,
          paymentStatus: kind === 'revenue' && paidCue ? 'paid' : undefined,
          orderStatus: kind === 'revenue' && paidCue ? 'completed' : undefined,
          source,
          rawFx: trailing.money.rawFx,
        }),
      ),
    );
  }

  return { drafts, skipped, kindHint };
}

/** Strip "1 ", "1.", "1)" at start of a catalog line. */
function stripLeadingRowIndex(text: string): string {
  return text.replace(/^\d{1,4}[\.\)\-]?\s+/, '').trim();
}

/**
 * Policy A clear-gate: strong kind header/cue + ≥2 money lines all same kind.
 * Unlabeled multi-line lists are NOT clear (need LLM classify).
 */
export function isClearBulkPaste(
  message: string,
  parsed?: ReturnType<typeof parseLineListDrafts>,
): boolean {
  const { drafts, kindHint } = parsed ?? parseLineListDrafts(message, 'text');
  if (drafts.length < 2 || !kindHint) return false;
  return drafts.every((d) => d.kind === kindHint);
}

/** ≥2 non-header lines that look like they end with a money token. */
export function looksLikeBulkLineList(message: string): boolean {
  const lines = message
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter(
      (l) =>
        !BULK_HEADER.test(l) &&
        !EXPENSE_HEADER.test(l) &&
        !REVENUE_HEADER.test(l) &&
        !PRODUCT_HEADER.test(l) &&
        !PRODUCT_COLUMN_HEADER.test(l),
    );

  if (lines.length < 2) return false;

  let moneyLines = 0;
  for (const line of lines) {
    if (extractTrailingMoney(line)) moneyLines += 1;
    else if (/[\d.,]+\s*(?:k|tr|₫|đ|vnd|đồng)?\s*$/i.test(line) && /\d/.test(line)) {
      moneyLines += 1;
    }
  }
  return moneyLines >= 2;
}

/** Parse one or many create clauses from a single user message. */
export function parseTextToDrafts(
  message: string,
  source: DraftSource = 'text',
): DraftRecord[] {
  // Cash-collected revenue table (Nội dung | Số tiền | Date)
  const cashTable = parseRevenueCashTableDrafts(message, source);
  if (cashTable.isTable && cashTable.drafts.length >= 1) {
    return cashTable.drafts;
  }

  // Sales product spreadsheet ("đã bán được") — before stock-in / order table
  const salesTable = parseSalesProductTableDrafts(message, source);
  if (salesTable.isTable && salesTable.drafts.length >= 1) {
    return salesTable.drafts;
  }

  // Stock-in spreadsheet (STT | tên | giá | SL | thành tiền) — before order table
  const stockInTable = parseStockInTableDrafts(message, source);
  if (stockInTable.isTable && stockInTable.drafts.length >= 1) {
    return stockInTable.drafts;
  }

  // Order spreadsheet paste (khách | kênh | nội dung | tiền | …) — before expense lines
  const orderTable = parseOrderTableDrafts(message, source);
  if (orderTable.isTable && orderTable.drafts.length >= 1) {
    return orderTable.drafts;
  }

  const lineList = parseLineListDrafts(message, source);
  if (lineList.drafts.length >= 2) {
    // Policy A: unlabeled multi-line lists are ambiguous — defer to LLM / header
    if (!isClearBulkPaste(message, lineList)) return [];
    return lineList.drafts;
  }

  // Avoid collapsing a bulk paste into one junk expense
  if (looksLikeBulkLineList(message) && lineList.drafts.length < 2) {
    return [];
  }

  const clauses = splitCreateClauses(message);
  if (clauses.length <= 1) {
    const one = parseTextToDraft(message, source);
    return one ? [one] : [];
  }

  const drafts: DraftRecord[] = [];
  for (const clause of clauses) {
    const d = parseTextToDraft(clause, source);
    if (d) drafts.push(d);
  }

  // If compound split produced nothing useful, fall back to whole-message parse
  if (drafts.length === 0) {
    const one = parseTextToDraft(message, source);
    return one ? [one] : [];
  }
  return drafts;
}

function isAnalysisOnly(lower: string): boolean {
  return /^(phân tích|tổng quan|dự báo|so sánh|báo cáo|thống kê|tổng chi|tổng thu|lợi nhuận|xu hướng|tình hình|đơn nào|help|hướng dẫn|\?)/.test(
    lower,
  );
}

function tryRevenue(lower: string, original: string, source: DraftSource): DraftRecord | null {
  const { core, extras } = extractSaleExtras(lower);

  // "tạo đơn khách …" (multi-line batch / multi-item / "Thu 3, SP")
  const taoDon = parseTaoDonOrder(lower, source, extras);
  if (taoDon) return validateDraft(taoDon);

  // Specialized: bán cho {khách} [{SL}] {SP} [giá] {tiền}
  const banCho = parseBanCho(core, source, extras, lower);
  if (banCho) return validateDraft(banCho);

  // "{khách} mua/lấy/đặt [{SL}] {SP} [qua kênh] [giá] {tiền}" — revenue
  const customerSale = parseCustomerSale(core, source, extras, lower);
  if (customerSale) return validateDraft(customerSale);

  // "{Tên} (đã) trả/chuyển/đưa N cho/mua SP" — khách trả tiền hàng
  const paidFor = lower.match(
    new RegExp(
      `^(\\S+)\\s+(?:đã\\s+)?(?:trả|chuyển|đưa)\\s+${MONEY}\\s+(?:cho|mua)\\s+(.+)$`,
      'i',
    ),
  );
  if (paidFor) {
    const money = normalizeCasualMoney(parseMoney(paidFor[2]!), paidFor[2]!);
    if (money && money.amountVnd > 0) {
      let product = cleanDesc(paidFor[3]!);
      let quantity: number | undefined;
      const qm = product.match(/^(\d+)\s+(.+)$/);
      if (qm) {
        quantity = Math.max(1, parseInt(qm[1]!, 10));
        product = cleanDesc(qm[2]!);
      }
      if (product.length >= 2) {
        return makeDraft({
          kind: 'revenue',
          amount: money.amountVnd,
          description: capitalize(product),
          customerName: capitalize(cleanDesc(paidFor[1]!)),
          quantity,
          unitPrice:
            quantity && quantity > 1 ? Math.round(money.amountVnd / quantity) : undefined,
          paymentStatus: 'paid',
          source,
          rawFx: money.rawFx,
        });
      }
    }
  }

  const patterns: Array<{
    re: RegExp;
    pick: (m: RegExpMatchArray) => { money: string; desc: string; customer?: string };
  }> = [
    // Product then money then optional customer — NOT "bán cho …"
    {
      re: new RegExp(`^bán\\s+(?!cho\\b)(.+?)\\s+${MONEY}\\s*(?:cho\\s+(.+))?\\s*$`, 'i'),
      pick: (m) => ({ desc: m[1]!, money: m[2]!, customer: m[3] }),
    },
    {
      re: new RegExp(`^thu\\s+(?:được\\s+)?${MONEY}\\s*(?:từ\\s+(.+?))?(?:\\s+bán\\s+(.+))?\\s*$`, 'i'),
      pick: (m) => ({
        money: m[1]!,
        customer: m[2],
        desc: m[3] || (m[2] ? `Bán hàng cho ${m[2]}` : 'Doanh thu'),
      }),
    },
    {
      re: new RegExp(`^doanh\\s*thu\\s+${MONEY}\\s+(.+)`, 'i'),
      pick: (m) => ({ money: m[1]!, desc: m[2]! }),
    },
    {
      re: new RegExp(`^khách\\s+(.+?)\\s+(?:trả|đưa|chuyển)\\s+${MONEY}\\s*(?:(?:cho|mua)\\s+(.+))?\\s*$`, 'i'),
      pick: (m) => ({ customer: m[1]!, money: m[2]!, desc: m[3] || `Bán hàng cho ${m[1]}` }),
    },
    {
      re: new RegExp(`^(?:thêm|tạo|ghi)\\s+(?:doanh\\s*thu|khoản\\s*thu|thu)\\s+${MONEY}\\s+(.+)`, 'i'),
      pick: (m) => ({ money: m[1]!, desc: m[2]! }),
    },
    {
      re: new RegExp(`^(?:thêm|tạo|ghi)\\s+(?:doanh\\s*thu|khoản\\s*thu)\\s+(.+?)\\s+${MONEY}\\s*$`, 'i'),
      pick: (m) => ({ desc: m[1]!, money: m[2]! }),
    },
    {
      re: new RegExp(`^nhận\\s+${MONEY}\\s+(?:từ\\s+)?(.+)`, 'i'),
      pick: (m) => ({ money: m[1]!, desc: m[2]!, customer: m[2] }),
    },
    {
      re: new RegExp(`^order\\s+(.+?)\\s+${MONEY}\\s*(?:cho\\s+(.+))?\\s*$`, 'i'),
      pick: (m) => ({ desc: m[1]!, money: m[2]!, customer: m[3] }),
    },
    {
      re: new RegExp(`^đơn\\s+(.+?)\\s+${MONEY}\\s*(?:(?:của|cho)\\s+(.+))?\\s*$`, 'i'),
      pick: (m) => ({ desc: m[1]!, money: m[2]!, customer: m[3] }),
    },
    {
      re: new RegExp(`^(.+?)\\s+trả\\s+${MONEY}\\s*$`, 'i'),
      pick: (m) => ({ customer: m[1]!, money: m[2]!, desc: `Thu từ ${m[1]}` }),
    },
  ];

  for (const { re, pick } of patterns) {
    const match = lower.match(re);
    if (!match) continue;
    const p = pick(match);
    const money = normalizeCasualMoney(parseMoney(p.money), p.money);
    if (!money || money.amountVnd <= 0) continue;
    const desc = cleanDesc(p.desc);
    if (desc.length < 2) continue;
    return makeDraft({
      kind: 'revenue',
      amount: money.amountVnd,
      description: capitalize(desc),
      customerName: p.customer ? capitalize(cleanDesc(p.customer)) : undefined,
      source,
      rawFx: money.rawFx,
    });
  }

  // Soft revenue keywords + money anywhere
  if (
    /\b(doanh\s*thu|khoản\s*thu|bán hàng|bán\b|order\b|đơn hàng)\b/.test(lower) ||
    (/^\s*thu\b/.test(lower) && !/\bchi\b/.test(lower))
  ) {
    const money = extractMoneyFromText(original);
    if (money && money.amountVnd > 0) {
      let desc = cleanDesc(
        original
          .replace(/\d[\d.,]*\s*(k|nghìn|ngàn|m|tr|triệu|trieu|usd|eur|\$|đô(?:\s*la)?)?/gi, ' ')
          .replace(/\b(thêm|tạo|ghi|doanh thu|khoản thu|bán|thu được|thu|cho|từ)\b/gi, ' '),
      );
      if (desc.length < 2) desc = 'Doanh thu';
      return makeDraft({
        kind: 'revenue',
        amount: money.amountVnd,
        description: capitalize(desc),
        source,
        rawFx: money.rawFx,
      });
    }
  }

  return null;
}

const CUSTOMER_SALE_VERB = String.raw`(?:mua\s*hàng|đặt\s*hàng|mua|lấy|đặt|order|book)`;
/** Optional filler: "đã mua" / "có mua" / "khách Dung mua" */
const CUSTOMER_SALE_PREFIX = String.raw`(?:khách\s+)?(\S+)\s+(?:đã\s+|có\s+)?`;
/** Captures channel after money: "60k ở Zalo" / "60k bên Shopee" */
const PLATFORM_TRAILER = String.raw`(?:ở|qua|trên|tại|bên|kênh)\s+(\S+(?:\s+\S+)?)`;

export interface SaleExtras {
  depositAmount?: number;
  shippingFee?: number;
  shippingPayer?: ShippingPayer;
  platformName?: string;
}

/**
 * Strip cọc / phí ship / ai chịu ship; leftover is core sale clause.
 * "đã cọc 30k ở Zalo" → deposit + platform Zalo.
 */
export function extractSaleExtras(lower: string): { core: string; extras: SaleExtras } {
  let core = lower.replace(/\s+/g, ' ').trim();
  const extras: SaleExtras = {};

  // Shop/khách chịu phí ship 11k | phí ship 11k (khách chịu)
  const shipPayerRe = new RegExp(
    String.raw`(?:,\s*)?(?:(?:khách|shop|bên\s*(?:mình|shop)|cửa\s*hàng)\s*chịu\s+)?(?:phí\s*)?(?:ship|shipping|vận\s*chuyển)\s*${MONEY}`,
    'gi',
  );
  core = core.replace(shipPayerRe, (full, moneyTok: string) => {
    const money = normalizeCasualMoney(parseMoney(moneyTok), moneyTok);
    if (money && money.amountVnd > 0) {
      extras.shippingFee = (extras.shippingFee ?? 0) + money.amountVnd;
      if (/shop|bên\s*(?:mình|shop)|cửa\s*hàng/i.test(full) && !/khách/i.test(full)) {
        extras.shippingPayer = 'shop';
      } else {
        extras.shippingPayer = extras.shippingPayer ?? 'customer';
      }
    }
    return ' ';
  });

  // đã cọc / đặt cọc 30k [ở Zalo]
  const depositRe = new RegExp(
    String.raw`(?:,\s*)?(?:đã\s+)?(?:đặt\s+)?cọc(?:\s*tiền)?\s+${MONEY}(?:\s+(?:ở|qua|trên|tại|bên|kênh)\s+(\S+))?`,
    'gi',
  );
  core = core.replace(depositRe, (_full, moneyTok: string, plat?: string) => {
    const money = normalizeCasualMoney(parseMoney(moneyTok), moneyTok);
    if (money && money.amountVnd > 0) {
      extras.depositAmount = (extras.depositAmount ?? 0) + money.amountVnd;
    }
    if (plat) {
      extras.platformName = detectPlatformName(plat) ?? extras.platformName;
    }
    return ' ';
  });

  // Trailing ", khách chịu" without amount already consumed
  core = core.replace(/(?:,\s*)?(?:khách|shop)\s*chịu\s*$/i, ' ');

  core = core.replace(/\s+/g, ' ').replace(/\s*,\s*$/g, '').trim();
  return { core, extras };
}

/** Prefix before money when stating unit price (not package total). */
const UNIT_PRICE_PREFIX = String.raw`(?:đơn\s*giá|giá\s*mỗi\s*(?:cái|chiếc|bộ|cặp|set)|giá\s*(?:một|1)\s*(?:cái|chiếc)|giá)`;

/**
 * Spoken order commands:
 * - tạo đơn khách Út Chi mua 1 A giá 55k và 1 B giá 55k đặt ở tiktok
 * - tạo đơn khách Thu 3, chó đeo mắt kính giá 70k ở tiktok
 * - tạo đơn khách T, chó đeo mắt kính giá 70k ở tiktok
 */
export function parseTaoDonOrder(
  lower: string,
  source: DraftSource,
  extras: SaleExtras = {},
): DraftRecord | null {
  let text = lower.trim();
  if (!/^(?:tạo|thêm)\s+đơn\b/i.test(text) && !/^khách\s+\S+/i.test(text)) {
    return null;
  }
  text = text.replace(/^(?:tạo|thêm)\s+đơn\s+/i, '').trim();
  if (!/^khách\s+/i.test(text)) return null;

  const platformName =
    extras.platformName ??
    detectPlatformName(text) ??
    undefined;

  // Strip trailing platform phrase from body for item parsing
  let body = text
    .replace(
      /\s*(?:đặt\s+)?(?:ở|qua|trên|tại|bên|kênh)\s+(?:shopee|shope|shoppe|tik\s*tok|tiktok|facebook|\bfb\b|messenger|zalo|\bzl\b|website|web|trực\s*tiếp)\s*$/i,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  // "khách Thu 3, chó đeo mắt kính giá 70k"
  const qtyComma = body.match(
    new RegExp(
      `^khách\\s+(.+?)\\s+(\\d{1,4})\\s*,\\s*(.+?)\\s+${UNIT_PRICE_PREFIX}\\s+${MONEY}\\s*$`,
      'i',
    ),
  );
  if (qtyComma) {
    const customerName = capitalizeWords(cleanDesc(qtyComma[1]!));
    const quantity = Math.max(1, parseInt(qtyComma[2]!, 10) || 1);
    const product = capitalizeWords(cleanDesc(qtyComma[3]!));
    const money = normalizeCasualMoney(parseMoney(qtyComma[4]!), qtyComma[4]!);
    if (customerName.length >= 1 && product.length >= 2 && money && money.amountVnd > 0) {
      // "giá 70k" after SL → unit price (common for catalog items)
      const unitPrice = money.amountVnd;
      const amount = unitPrice * quantity;
      return makeDraft({
        kind: 'revenue',
        amount,
        unitPrice,
        quantity,
        description: quantity > 1 ? `${quantity} × ${product}` : product,
        customerName,
        platformName,
        paymentStatus: 'unpaid',
        source,
        confidence: 0.94,
        rawFx: money.rawFx,
        depositAmount: extras.depositAmount,
        depositedAt: extras.depositAmount ? todayIso() : undefined,
        shippingFee: extras.shippingFee,
        shippingPayer: extras.shippingFee ? extras.shippingPayer ?? 'customer' : undefined,
      });
    }
  }

  // "khách T, chó đeo mắt kính giá 70k"
  const nameComma = body.match(
    new RegExp(
      `^khách\\s+([^,]+?)\\s*,\\s*(.+?)\\s+${UNIT_PRICE_PREFIX}\\s+${MONEY}\\s*$`,
      'i',
    ),
  );
  if (nameComma) {
    const customerName = capitalizeWords(cleanDesc(nameComma[1]!));
    const product = capitalizeWords(cleanDesc(nameComma[2]!));
    const money = normalizeCasualMoney(parseMoney(nameComma[3]!), nameComma[3]!);
    if (customerName.length >= 1 && product.length >= 2 && money && money.amountVnd > 0) {
      return makeDraft({
        kind: 'revenue',
        amount: money.amountVnd,
        unitPrice: money.amountVnd,
        quantity: 1,
        description: product,
        customerName,
        platformName,
        paymentStatus: 'unpaid',
        source,
        confidence: 0.94,
        rawFx: money.rawFx,
        depositAmount: extras.depositAmount,
        depositedAt: extras.depositAmount ? todayIso() : undefined,
        shippingFee: extras.shippingFee,
        shippingPayer: extras.shippingFee ? extras.shippingPayer ?? 'customer' : undefined,
      });
    }
  }

  // "khách Út Chi mua 1 A giá 55k và 1 B giá 55k"
  const muaIdx = body.search(/\s+mua\s+/i);
  if (muaIdx < 0) return null;
  const customerName = capitalizeWords(cleanDesc(body.slice(0, muaIdx).replace(/^khách\s+/i, '')));
  if (customerName.length < 1) return null;

  const itemRe = new RegExp(
    String.raw`(\d{1,4})\s+(.+?)\s+${UNIT_PRICE_PREFIX}\s+${MONEY}`,
    'gi',
  );
  const orderItems: { name: string; quantity: number; unitPrice: number }[] = [];
  let m: RegExpExecArray | null;
  const itemsBlob = body.slice(muaIdx).replace(/^\s*mua\s+/i, '').trim();
  while ((m = itemRe.exec(itemsBlob)) !== null) {
    const quantity = Math.max(1, parseInt(m[1]!, 10) || 1);
    const name = capitalizeWords(cleanDesc(m[2]!));
    const money = normalizeCasualMoney(parseMoney(m[3]!), m[3]!);
    if (name.length < 2 || !money || money.amountVnd <= 0) continue;
    orderItems.push({ name, quantity, unitPrice: money.amountVnd });
  }

  if (orderItems.length >= 2) {
    const amount = orderItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const description = orderItems
      .map((it) => (it.quantity > 1 ? `${it.quantity} × ${it.name}` : it.name))
      .join('; ');
    return makeDraft({
      kind: 'revenue',
      amount,
      unitPrice: orderItems[0]!.unitPrice,
      quantity: 1,
      description,
      customerName,
      platformName,
      orderItems,
      paymentStatus: 'unpaid',
      source,
      confidence: 0.95,
      depositAmount: extras.depositAmount,
      depositedAt: extras.depositAmount ? todayIso() : undefined,
      shippingFee: extras.shippingFee,
      shippingPayer: extras.shippingFee ? extras.shippingPayer ?? 'customer' : undefined,
    });
  }

  if (orderItems.length === 1) {
    const it = orderItems[0]!;
    return makeDraft({
      kind: 'revenue',
      amount: it.quantity * it.unitPrice,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      description: it.quantity > 1 ? `${it.quantity} × ${it.name}` : it.name,
      customerName,
      platformName,
      paymentStatus: 'unpaid',
      source,
      confidence: 0.94,
      depositAmount: extras.depositAmount,
      depositedAt: extras.depositAmount ? todayIso() : undefined,
      shippingFee: extras.shippingFee,
      shippingPayer: extras.shippingFee ? extras.shippingPayer ?? 'customer' : undefined,
    });
  }

  return null;
}

/**
 * Parse "bán cho Hoa 3 kẹp tóc giá 90k" / "bán cho Hùng thú nhồi bông 25k"
 * - `giá X` → X is goods TOTAL; unit = total / qty
 * - `đơn giá X` / `giá mỗi cái X` → unit price; total = qty × X
 * - bare money at end → total
 */
function parseBanCho(
  lower: string,
  source: DraftSource,
  extras: SaleExtras = {},
  originalLower?: string,
): DraftRecord | null {
  const re = new RegExp(
    `^bán\\s+cho\\s+(\\S+)\\s+(?:(\\d{1,4})\\s+(?:cái|chiếc|bộ|cặp|set)?\\s*)?(.+?)\\s+(?:${UNIT_PRICE_PREFIX}\\s+)?${MONEY}(?:\\s+${PLATFORM_TRAILER})?\\s*$`,
    'i',
  );
  const m = lower.match(re);
  if (!m) return null;
  const full = originalLower ?? lower;
  return buildCustomerSaleDraft({
    customerRaw: m[1]!,
    qtyRaw: m[2],
    productRaw: m[3]!,
    isUnitPrice: isExplicitUnitPrice(full),
    moneyToken: m[4]!,
    platformTrailer: m[5],
    fullLower: full,
    source,
    extras,
  });
}

/** Chỉ đơn giá / giá mỗi cái /cái — không phải "giá" trần (tổng gói). */
function isExplicitUnitPrice(text: string): boolean {
  return (
    /đơn\s*giá/i.test(text) ||
    /giá\s*mỗi\s*(?:cái|chiếc|bộ|cặp|set)/i.test(text) ||
    /giá\s*(?:một|1)\s*(?:cái|chiếc)/i.test(text) ||
    /\/\s*cái\b/i.test(text)
  );
}

/** True for "{khách} mua/lấy/đặt … tiền" (not leading "mua …" shop purchase). */
export function looksLikeCustomerSale(message: string): boolean {
  const lower = message.toLowerCase().trim();
  // Strip leading time chatter: "hôm nay ", "hom nay "
  const stripped = lower.replace(/^(?:hôm\s*nay|hom\s*nay|nay|hôm\s*qua)\s+/i, '');
  const re = new RegExp(
    `^${CUSTOMER_SALE_PREFIX}${CUSTOMER_SALE_VERB}\\s+.+$`,
    'i',
  );
  const m = stripped.match(re);
  if (!m) return false;
  return !isSelfPurchaseSubject(m[1]!);
}

/** "Dung mua 3 kẹp tóc qua Zalo giá 60k" / "… giá 60k ở Zalo" / "Dung đã mua …" */
function parseCustomerSale(
  lower: string,
  source: DraftSource,
  extras: SaleExtras = {},
  originalLower?: string,
): DraftRecord | null {
  const stripped = lower.replace(/^(?:hôm\s*nay|hom\s*nay|nay|hôm\s*qua)\s+/i, '');
  const re = new RegExp(
    `^${CUSTOMER_SALE_PREFIX}${CUSTOMER_SALE_VERB}\\s+(?:(\\d{1,4})\\s+(?:cái|chiếc|bộ|cặp|set)?\\s*)?(.+?)\\s+(?:${UNIT_PRICE_PREFIX}\\s+)?${MONEY}(?:\\s+${PLATFORM_TRAILER})?\\s*$`,
    'i',
  );
  const m = stripped.match(re);
  if (!m) return null;

  const customerRaw = m[1]!;
  // Shop self-purchase stays expense: "mua len 500k" / "tôi mua …"
  if (isSelfPurchaseSubject(customerRaw)) return null;

  const full = originalLower ?? lower;
  return buildCustomerSaleDraft({
    customerRaw,
    qtyRaw: m[2],
    productRaw: m[3]!,
    isUnitPrice: isExplicitUnitPrice(full),
    moneyToken: m[4]!,
    platformTrailer: m[5],
    fullLower: full,
    source,
    extras,
  });
}

const SELF_PURCHASE_SUBJECT =
  /^(tôi|mình|ta|em|anh|chị|shop|cửa\s*hàng|chúng\s*ta|chúng\s*mình)$/i;

function isSelfPurchaseSubject(name: string): boolean {
  return SELF_PURCHASE_SUBJECT.test(name.trim());
}

function buildCustomerSaleDraft(opts: {
  customerRaw: string;
  qtyRaw: string | undefined;
  productRaw: string;
  isUnitPrice: boolean;
  moneyToken: string;
  platformTrailer?: string;
  fullLower: string;
  source: DraftSource;
  extras?: SaleExtras;
}): DraftRecord | null {
  const money = normalizeCasualMoney(parseMoney(opts.moneyToken), opts.moneyToken);
  if (!money || money.amountVnd <= 0) return null;

  const quantity = opts.qtyRaw ? Math.max(1, parseInt(opts.qtyRaw, 10) || 1) : 1;
  let product = cleanDesc(opts.productRaw)
    .replace(/^\d{1,4}\s+/, '')
    .replace(/^(?:cái|chiếc|bộ)\s+/i, '')
    .replace(
      /\s*(?:đơn\s*giá|giá\s*mỗi\s*(?:cái|chiếc|bộ|cặp|set)|giá\s*(?:một|1)\s*(?:cái|chiếc))\s*$/i,
      '',
    )
    .trim();

  const stripped = stripPlatformFromProduct(product, opts.fullLower);
  product = stripped.product;
  if (product.length < 2) return null;

  let unitPrice: number;
  let amount: number;
  if (opts.isUnitPrice) {
    unitPrice = money.amountVnd;
    amount = unitPrice * quantity;
  } else {
    amount = money.amountVnd;
    unitPrice = Math.round(amount / quantity);
  }

  const description =
    quantity > 1 ? `${quantity} × ${capitalize(product)}` : capitalize(product);

  const ex = opts.extras ?? {};
  const platformName =
    ex.platformName ??
    stripped.platformName ??
    (opts.platformTrailer ? detectPlatformName(opts.platformTrailer) : undefined) ??
    detectPlatformName(opts.fullLower);

  const hasExtras = !!(ex.depositAmount || ex.shippingFee);

  return makeDraft({
    kind: 'revenue',
    amount,
    unitPrice,
    quantity,
    description,
    customerName: capitalize(cleanDesc(opts.customerRaw)),
    platformName,
    depositAmount: ex.depositAmount,
    depositedAt: ex.depositAmount ? todayIso() : undefined,
    shippingFee: ex.shippingFee,
    shippingPayer: ex.shippingFee ? ex.shippingPayer ?? 'customer' : undefined,
    paymentStatus: 'unpaid',
    source: opts.source,
    confidence: hasExtras ? 0.93 : 0.9,
    rawFx: money.rawFx,
  });
}

function tryExpense(lower: string, original: string, source: DraftSource): DraftRecord | null {
  // Never treat "{khách} mua/lấy/đặt …" as shop expense
  if (looksLikeCustomerSale(lower)) return null;

  const patterns: Array<{
    re: RegExp;
    amountFirst: boolean;
  }> = [
    { re: new RegExp(`^(?:thêm|tạo|ghi|thêm mới)\\s+(?:chi\\s*phí|khoản\\s*chi|chi)\\s+${MONEY}\\s*(?:do|cho|vì|để|là|:)?\\s*(.+)`, 'i'), amountFirst: true },
    { re: new RegExp(`^(?:thêm|tạo|ghi)\\s+(?:chi\\s*phí|khoản\\s*chi)\\s+(.+?)\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
    { re: new RegExp(`^(?:thêm|tạo|ghi)\\s+(.+?)\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
    { re: new RegExp(`^(?:chi|trả|thanh toán|đóng|tiêu|spend)\\s+${MONEY}\\s+(?:cho\\s+|vào\\s+|để\\s+)?(.+)`, 'i'), amountFirst: true },
    { re: new RegExp(`^(?:chi|trả|thanh toán|đóng|tiêu)\\s+(.+?)\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
    { re: new RegExp(`^mua\\s+(.+?)\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
    { re: new RegExp(`^mua\\s+${MONEY}\\s+(.+)`, 'i'), amountFirst: true },
    // Nhập hàng / nhập kho → chi phí
    { re: new RegExp(`^nhập\\s+(?:hàng\\s+)?(.+?)\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
    { re: new RegExp(`^nhập\\s+${MONEY}\\s+(.+)`, 'i'), amountFirst: true },
    { re: new RegExp(`^(?:đổ|bơm)\\s*xăng\\s+(?:hết\\s+)?${MONEY}\\s*$`, 'i'), amountFirst: true },
    { re: new RegExp(`^xăng\\s+(?:hết\\s+)?${MONEY}\\s*$`, 'i'), amountFirst: true },
    { re: new RegExp(`^(.+?)\\s+hết\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
    { re: new RegExp(`^(.+?)\\s+(?:giá|phí|cước)\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
    { re: new RegExp(`^${MONEY}\\s+(?:cho|mua|chi|trả)?\\s*(.+)`, 'i'), amountFirst: true },
    { re: new RegExp(`^(.+?)\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
  ];

  const fixedDescByIndex: Record<number, string> = {
    9: 'Đổ xăng', // (?:đổ|bơm)\s*xăng
    10: 'Đổ xăng', // xăng MONEY
  };

  for (let i = 0; i < patterns.length; i++) {
    const { re, amountFirst } = patterns[i]!;
    const match = lower.match(re);
    if (!match) continue;

    const moneyToken = amountFirst ? match[1]! : match[2]!;
    let desc = fixedDescByIndex[i] ?? (amountFirst ? match[2]! : match[1]!);

    let money = normalizeCasualMoney(parseMoney(moneyToken), moneyToken);
    if (!money || money.amountVnd <= 0) continue;

    desc = cleanDesc(desc);
    if (desc.length < 2) continue;

    // Catch-all short phrases only (avoid analysis sentences)
    const isCatchAll = i >= patterns.length - 2;
    if (isCatchAll && desc.split(/\s+/).length > 8) continue;
    // Skip if looks like revenue that slipped through
    if (/^(bán|doanh thu|khách)\b/.test(desc)) continue;
    // Ambiguous (kênh / khách mua giữa câu) → để LLM, đừng soft-nuốt thành chi phí
    if (isCatchAll && shouldDeferCreateToLlm(original)) continue;

    const isNhap = i === 7 || i === 8 || /^nhập\b/i.test(desc);
    const qtyMatch = desc.match(
      /^(\d{1,5})\s*(?:×|x|cái|con|chiếc|bộ|cặp|set|hộp)?\s+(.+)$/i,
    );
    const quantity = qtyMatch ? Math.max(1, parseInt(qtyMatch[1]!, 10) || 1) : undefined;
    let productDesc = qtyMatch ? qtyMatch[2]!.trim() : desc;
    productDesc = productDesc.replace(/^(?:hàng\s+)/i, '').trim();
    const category = isNhap ? 'supplies' : guessCategory(desc);
    const description = isNhap
      ? quantity && quantity > 1
        ? `Nhập ${quantity} × ${capitalize(productDesc)}`
        : `Nhập ${capitalize(productDesc)}`
      : capitalize(desc);
    const unitPrice =
      quantity && quantity > 1 ? Math.round(money.amountVnd / quantity) : undefined;

    return makeDraft({
      kind: 'expense',
      amount: money.amountVnd,
      description,
      category,
      quantity,
      unitPrice,
      source,
      confidence: isCatchAll ? 0.55 : 0.9,
      rawFx: money.rawFx,
    });
  }

  // Soft expense: CHỈ khi câu BẮT ĐẦU bằng động từ chi/mua/nhập… (shop mua hàng)
  // Không match "… mua …" giữa câu — tránh nuốt doanh thu.
  if (/^(chi|mua|nhập|trả|tiêu|đóng|thanh toán|đổ\s*xăng)\b/.test(lower)) {
    if (shouldDeferCreateToLlm(original)) return null;
    const money = extractMoneyFromText(original);
    if (money && money.amountVnd > 0) {
      const isNhap = /^nhập\b/.test(lower);
      let desc = cleanDesc(
        original.replace(/\d[\d.,]*\s*(k|nghìn|ngàn|m|tr|triệu|usd|eur|\$)?/gi, ' '),
      );
      if (desc.length < 2) desc = 'Chi phí';
      const qtyMatch = lower.match(
        /^nhập\s+(?:hàng\s+)?(\d{1,5})\s*(?:×|x|cái|con|chiếc|bộ|cặp|set|hộp)?\s+/,
      );
      const quantity = qtyMatch ? Math.max(1, parseInt(qtyMatch[1]!, 10) || 1) : undefined;
      return makeDraft({
        kind: 'expense',
        amount: money.amountVnd,
        description: capitalize(desc),
        category: isNhap ? 'supplies' : guessCategory(desc),
        quantity,
        unitPrice:
          quantity && quantity > 1 ? Math.round(money.amountVnd / quantity) : undefined,
        source,
        confidence: 0.55,
        rawFx: money.rawFx,
      });
    }
  }

  return null;
}

/** Local không chắc → nên gọi LLM (Gemini/WebLLM) thay vì persist soft-expense. */
export function shouldDeferCreateToLlm(message: string): boolean {
  const lower = message.toLowerCase().trim();
  if (!lower) return false;
  if (looksLikeCustomerSale(lower)) return true;
  // Có tên kênh nhưng chưa parse được sale chuẩn
  if (/\b(qua|trên|kênh)\s+(shopee|zalo|tik\s*tok|facebook|\bfb\b|website)\b/i.test(lower)) {
    return true;
  }
  if (/\b(shopee|zalo|tiktok|tik\s*tok)\b/i.test(lower) && /\b(mua|lấy|đặt|bán|order)\b/i.test(lower)) {
    return true;
  }
  // "{tên} … mua/lấy/đặt …" không khớp ^Name mua (thừa từ)
  if (/\S+\s+(?:đã\s+)?(?:mua|lấy|đặt)\s+.+/i.test(lower) && !/^mua\b/i.test(lower)) {
    return true;
  }
  return false;
}

/** Local draft đủ chắc để lưu ngay (không cần LLM xác nhận). */
export function isHighConfidenceDraft(draft: DraftRecord): boolean {
  return (draft.confidence ?? 0.9) >= 0.75;
}

/** "xăng 30" → 30000 when bare 1–3 digit amount without unit */
function normalizeCasualMoney(money: ParsedMoney | null, token: string): ParsedMoney | null {
  if (!money) return null;
  if (money.rawFx) return money;
  const bare = token.trim();
  if (/^\d{1,3}$/.test(bare) && money.amountVnd > 0 && money.amountVnd < 1000) {
    return { amountVnd: money.amountVnd * 1000 };
  }
  return money;
}

const PLATFORM_HINTS: Array<{ re: RegExp; name: string }> = [
  { re: /shopee|shope\b|shoppe/i, name: 'Shopee' },
  { re: /tik\s*tok|tiktok/i, name: 'TikTok' },
  { re: /facebook|\bfb\b|messenger/i, name: 'Facebook' },
  { re: /zalo|\bzl\b/i, name: 'Zalo' },
  { re: /website|\bweb\b/i, name: 'Website' },
  { re: /trực\s*tiếp|offline|tại\s*quán|tại\s*shop/i, name: 'Trực tiếp' },
];

function detectPlatformName(text: string): string | undefined {
  for (const { re, name } of PLATFORM_HINTS) {
    if (re.test(text)) return name;
  }
  return undefined;
}

/** Pull "qua Zalo" / "ở Shopee" / "trên TikTok" out of product text into platformName. */
function stripPlatformFromProduct(
  product: string,
  fullLower: string,
): { product: string; platformName?: string } {
  let platformName = detectPlatformName(product) ?? detectPlatformName(fullLower);
  let cleaned = product
    .replace(
      /\s*(?:qua|trên|ở|tại|bên|qua\s+kênh|kênh)\s+(?:shopee|shope|shoppe|tik\s*tok|tiktok|facebook|fb|messenger|zalo|\bzl\b|website|web)\b/gi,
      ' ',
    )
    .replace(
      /\s+(?:shopee|shope|shoppe|tik\s*tok|tiktok|facebook|\bfb\b|zalo|\bzl\b|website)\s*$/i,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (!platformName) platformName = detectPlatformName(product);
  return { product: cleaned, platformName };
}

function makeDraft(partial: Omit<DraftRecord, 'id' | 'date'> & { date?: string }): DraftRecord {
  return {
    id: newDraftId(),
    date: partial.date ?? todayIso(),
    kind: partial.kind,
    amount: partial.amount,
    description: partial.description,
    category: partial.category,
    customerName: partial.customerName,
    customerId: partial.customerId,
    productId: partial.productId,
    platformId: partial.platformId,
    platformName: partial.platformName,
    quantity: partial.quantity,
    unitPrice: partial.unitPrice,
    orderItems: partial.orderItems,
    depositAmount: partial.depositAmount,
    depositedAt: partial.depositedAt,
    shippingFee: partial.shippingFee,
    shippingPayer: partial.shippingPayer,
    paymentStatus: partial.paymentStatus,
    paymentMethod: partial.paymentMethod,
    orderStatus: partial.orderStatus,
    notes: partial.notes,
    source: partial.source,
    confidence: partial.confidence ?? 0.9,
    rawFx: partial.rawFx,
  };
}

function cleanDesc(s: string): string {
  return s
    .replace(/\b(thêm|tạo|ghi|thêm mới|chi phí|khoản chi|doanh thu|khoản thu|hết|giá|phí)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function capitalizeWords(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => capitalize(w))
    .join(' ');
}

export function guessCategory(desc: string): ExpenseCategory {
  const catMap: [string, ExpenseCategory][] = [
    ['văn phòng', 'office'], ['bút', 'office'], ['giấy', 'office'], ['cà phê', 'office'],
    ['cafe', 'office'], ['càfe', 'office'], ['ăn ', 'office'], ['cơm', 'office'],
    ['trà', 'office'], ['nước', 'office'], ['tiếp khách', 'office'], ['sinh nhật', 'office'],
    ['thuê', 'rent'], ['mặt bằng', 'rent'], ['nhà xưởng', 'rent'],
    ['điện', 'utilities'], ['internet', 'utilities'], ['wifi', 'utilities'], ['mạng', 'utilities'],
    ['nước máy', 'utilities'], ['gas', 'utilities'],
    ['lương', 'salary'], ['thưởng', 'salary'], ['bhxh', 'salary'],
    ['quảng cáo', 'marketing'], ['marketing', 'marketing'], ['ads', 'marketing'], ['facebook', 'marketing'],
    ['nguyên liệu', 'supplies'], ['vật liệu', 'supplies'], ['vật tư', 'supplies'], ['hàng hóa', 'supplies'],
    ['len', 'supplies'], ['bông', 'supplies'], ['nhung', 'supplies'], ['yarn', 'supplies'],
    ['sợi', 'supplies'], ['móc khóa', 'supplies'], ['kẽm', 'supplies'], ['túi', 'supplies'],
    ['tem', 'supplies'], ['nhãn', 'supplies'], ['hộp giấy', 'supplies'],
    ['xăng', 'transportation'], ['ship', 'transportation'], ['grab', 'transportation'],
    ['taxi', 'transportation'], ['gửi hàng', 'transportation'], ['vận chuyển', 'transportation'],
    ['sửa', 'maintenance'], ['bảo trì', 'maintenance'], ['bảo dưỡng', 'maintenance'],
    ['thuế', 'tax'], ['phí ngân hàng', 'tax'], ['lệ phí', 'tax'],
  ];
  const lower = desc.toLowerCase();
  for (const [kw, cat] of catMap) {
    if (lower.includes(kw)) return cat;
  }
  return 'other';
}

export function looksLikeCreateIntent(message: string): boolean {
  const lower = message.toLowerCase();
  if (isAnalysisOnly(lower)) return false;
  return (
    /\b(thêm|tạo|ghi|chi|thu|bán|mua|trả|đóng|tiêu|doanh thu|order|đơn)\b/.test(lower) ||
    /\d+\s*(k|tr|triệu|usd|\$)/i.test(lower) ||
    /^.+\s+\d{1,3}$/.test(lower)
  );
}

export function looksLikeAnalysisIntent(message: string): boolean {
  const lower = message.toLowerCase();
  if (parseTextToDraft(message)) return false;
  return [
    'tổng quan', 'phân tích', 'báo cáo', 'thống kê', 'dự báo', 'so sánh', 'xu hướng',
    'tổng hợp', 'chi tiêu', 'lợi nhuận', 'tổng chi', 'tổng thu',
    'đơn nào', 'đang chờ', 'tình hình',
  ].some((k) => lower.includes(k));
}
