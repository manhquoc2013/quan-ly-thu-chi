/**
 * Local command parser — broad Vietnamese patterns for instant text entry.
 * Text/voice: persist immediately (caller). File OCR/CSV: drafts for preview.
 */

import type { ExpenseCategory } from '@/models';
import { extractMoneyFromText, parseMoney, type ParsedMoney } from './amountParser';
import {
  newDraftId,
  todayIso,
  validateDraft,
  type DraftRecord,
  type DraftSource,
} from './draftTypes';

const MONEY = String.raw`(\d[\d.,]*\s*(?:k|nghìn|ngàn|m|tr|triệu|trieu|usd|eur|jpy|cny|krw|sgd|aud|\$|đô(?:\s*la)?)?)`;

export function parseTextToDraft(
  message: string,
  source: DraftSource = 'text',
): DraftRecord | null {
  const lower = message.toLowerCase().trim();
  if (!lower) return null;

  // Never treat pure analysis as create
  if (isAnalysisOnly(lower)) return null;

  const revenue = tryRevenue(lower, message, source);
  if (revenue) return validateDraft(revenue);

  const expense = tryExpense(lower, message, source);
  if (expense) return validateDraft(expense);

  return null;
}

function isAnalysisOnly(lower: string): boolean {
  return /^(phân tích|tổng quan|dự báo|so sánh|báo cáo|thống kê|tổng chi|tổng thu|lợi nhuận|xu hướng|tình hình|đơn nào|help|hướng dẫn|\?)/.test(
    lower,
  );
}

function tryRevenue(lower: string, original: string, source: DraftSource): DraftRecord | null {
  const patterns: Array<{
    re: RegExp;
    pick: (m: RegExpMatchArray) => { money: string; desc: string; customer?: string };
  }> = [
    {
      re: new RegExp(`^bán\\s+(.+?)\\s+${MONEY}\\s*(?:cho\\s+(.+))?\\s*$`, 'i'),
      pick: (m) => ({ desc: m[1]!, money: m[2]!, customer: m[3] }),
    },
    {
      re: new RegExp(`^bán\\s+cho\\s+(.+?)\\s+(.+?)\\s+${MONEY}\\s*$`, 'i'),
      pick: (m) => ({ customer: m[1]!, desc: m[2]!, money: m[3]! }),
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

function tryExpense(lower: string, original: string, source: DraftSource): DraftRecord | null {
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
    { re: new RegExp(`^(?:đổ|bơm)\\s*xăng\\s+${MONEY}\\s*$`, 'i'), amountFirst: true },
    { re: new RegExp(`^xăng\\s+${MONEY}\\s*$`, 'i'), amountFirst: true },
    { re: new RegExp(`^(.+?)\\s+hết\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
    { re: new RegExp(`^(.+?)\\s+(?:giá|phí|cước)\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
    { re: new RegExp(`^${MONEY}\\s+(?:cho|mua|chi|trả)?\\s*(.+)`, 'i'), amountFirst: true },
    { re: new RegExp(`^(.+?)\\s+${MONEY}\\s*$`, 'i'), amountFirst: false },
  ];

  const fixedDescByIndex: Record<number, string> = {
    7: 'Đổ xăng', // (?:đổ|bơm)\s*xăng
    8: 'Đổ xăng', // xăng MONEY
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
    if (i >= patterns.length - 2 && desc.split(/\s+/).length > 8) continue;
    // Skip if looks like revenue that slipped through
    if (/^(bán|doanh thu|khách)\b/.test(desc)) continue;

    return makeDraft({
      kind: 'expense',
      amount: money.amountVnd,
      description: capitalize(desc),
      category: guessCategory(desc),
      source,
      rawFx: money.rawFx,
    });
  }

  // Soft expense: has money + expense-ish verb, or short "noun + money"
  if (/\b(chi|mua|trả|tiêu|đóng|thanh toán|đổ xăng)\b/.test(lower)) {
    const money = extractMoneyFromText(original);
    if (money && money.amountVnd > 0) {
      let desc = cleanDesc(
        original.replace(/\d[\d.,]*\s*(k|nghìn|ngàn|m|tr|triệu|usd|eur|\$)?/gi, ' '),
      );
      if (desc.length < 2) desc = 'Chi phí';
      return makeDraft({
        kind: 'expense',
        amount: money.amountVnd,
        description: capitalize(desc),
        category: guessCategory(desc),
        source,
        rawFx: money.rawFx,
      });
    }
  }

  return null;
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

function makeDraft(partial: Omit<DraftRecord, 'id' | 'date'> & { date?: string }): DraftRecord {
  return {
    id: newDraftId(),
    date: partial.date ?? todayIso(),
    kind: partial.kind,
    amount: partial.amount,
    description: partial.description,
    category: partial.category,
    customerName: partial.customerName,
    source: partial.source,
    confidence: 0.9,
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
