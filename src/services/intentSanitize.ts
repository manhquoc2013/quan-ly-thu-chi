/**
 * Post-process LLM intents against the source message to strip hallucinations
 * common with small local models (wrong kind, qty, platform, customer).
 */

import { extractMoneyFromText, parseMoney } from './amountParser';
import { fillMissingSlots, type ChatIntent } from './chatIntent';
import { productQueryFromDescription } from './entityResolve';

const PLATFORM_ALIASES: Record<string, string[]> = {
  Shopee: ['shopee', 'shope', 'shoppe'],
  TikTok: ['tiktok', 'tik tok', 'tt shop'],
  Facebook: ['facebook', 'fb', 'messenger'],
  Zalo: ['zalo', 'zl'],
  Website: ['website', 'web', 'trang web'],
  'Trực tiếp': ['trực tiếp', 'offline', 'tại quán', 'tại shop'],
};

function looksLikeExpenseOnly(lower: string): boolean {
  const expenseCue =
    /\b(uống|ăn\s|cafe|cà phê|đổ xăng|bơm xăng|grab|chi\s|tiêu\s|nhập\s|mua\s)/i.test(lower);
  const revenueCue =
    /\b(bán(\s+cho)?|thu\s+\d|doanh thu|khách\s+\S+\s+(mua|lấy|đặt))\b/i.test(lower) ||
    /\b[A-Za-zÀ-ỹ]{2,}\s+(mua|lấy|đặt|order)\b/i.test(lower);
  // "mua len" at start = expense; "Hoa mua" = revenue (caught above)
  const shopBuy = /^(?:tôi|mình|em|shop)?\s*(?:vừa\s+)?(?:mua|nhập|chi)\b/i.test(lower);
  return (expenseCue && !revenueCue) || shopBuy;
}

function looksLikeRevenue(lower: string): boolean {
  return (
    /\b(bán(\s+cho)?|thu\s+\d|doanh thu)\b/i.test(lower) ||
    /\b[A-Za-zÀ-ỹ]{2,}\s+(mua|lấy|đặt|order)\b/i.test(lower)
  );
}

/** Prefer "giá/hết/tổng … 90k" over bare numbers like "3" in "3 cái". */
export function extractPrimaryAmountVnd(message: string): number | undefined {
  const labeled = message.match(
    /(?:giá(?:\s*mỗi\s*cái)?|hết|tổng|thành tiền|đơn giá)\s*:?\s*(\d[\d.,]*\s*(?:k|nghìn|ngàn|tr|triệu|m)?)/i,
  );
  if (labeled?.[1]) {
    const parsed = parseMoney(labeled[1].trim());
    if (parsed && parsed.amountVnd >= 1000) return parsed.amountVnd;
  }
  const withUnit = message.match(/(\d[\d.,]*)\s*(k|nghìn|ngàn|tr|triệu|m)\b/i);
  if (withUnit) {
    const parsed = parseMoney(withUnit[0]!);
    if (parsed && parsed.amountVnd >= 1000) return parsed.amountVnd;
  }
  const trailing = extractMoneyFromText(message);
  if (trailing && trailing.amountVnd >= 1000) return trailing.amountVnd;
  return undefined;
}

function extractQuantity(message: string): number | undefined {
  const m = message.match(/(\d+)\s*(cái|chiếc|bộ|cặp|set|ly|chai|hộp)/i);
  if (m) return Math.max(1, parseInt(m[1]!, 10));
  return undefined;
}

function platformMentioned(lower: string, platformName: string): boolean {
  const aliases = PLATFORM_ALIASES[platformName] ?? [platformName.toLowerCase()];
  return aliases.some((a) => lower.includes(a));
}

/**
 * Correct kind / amount / qty / entities using only the user message.
 */
export function sanitizeIntentAgainstMessage(message: string, intent: ChatIntent): ChatIntent {
  const lower = message.toLowerCase();
  let next: ChatIntent = { ...intent };

  if (
    (next.intent === 'create_revenue' || next.intent === 'chat') &&
    looksLikeExpenseOnly(lower) &&
    !looksLikeRevenue(lower)
  ) {
    next = {
      ...next,
      intent: 'create_expense',
      customerName: undefined,
      platformName: undefined,
      quantity: undefined,
      unitPrice: undefined,
    };
  } else if (next.intent === 'create_expense' && looksLikeRevenue(lower)) {
    next = { ...next, intent: 'create_revenue' };
  }

  if (next.intent === 'create_expense') {
    next = { ...next, customerName: undefined, platformName: undefined };
  }

  if (next.platformName && !platformMentioned(lower, next.platformName)) {
    next = { ...next, platformName: undefined };
  }

  if (next.customerName) {
    const cn = next.customerName.toLowerCase().trim();
    if (cn.length < 2 || !lower.includes(cn)) {
      next = { ...next, customerName: undefined };
    }
  }

  const qty = extractQuantity(message);
  if (qty != null) {
    next = { ...next, quantity: qty };
  } else if (next.quantity && next.quantity > 1) {
    // No qty word in message → drop hallucinated SL (e.g. SL 10)
    next = { ...next, quantity: 1 };
  }

  const amount = extractPrimaryAmountVnd(message);
  if (amount != null) {
    if (next.intent === 'create_revenue' && (next.quantity ?? 1) > 1) {
      // "3 cái giá 90k" → amount is TOTAL (90k), unitPrice = total/qty
      next = {
        ...next,
        amount,
        unitPrice: Math.round(amount / (next.quantity ?? 1)),
      };
    } else {
      next = { ...next, amount };
    }
  }

  // Description: clean product / expense text (drop multi-tx + price noise)
  if (next.intent === 'create_revenue') {
    const rawDesc = next.description ?? message;
    const cleaned = productQueryFromDescription(rawDesc);
    if (cleaned.length >= 2) next = { ...next, description: cleaned };
  } else if (next.intent === 'create_expense') {
    const raw = next.description && next.description.length >= 2 ? next.description : message;
    const cleaned = productQueryFromDescription(raw)
      .replace(/\b(uống|ăn)\b/gi, (m) => m)
      .trim();
    const fallback = message
      .replace(/\d[\d.,]*\s*(k|nghìn|ngàn|tr|triệu|m)?/gi, '')
      .replace(/\b(hết|giá|tôi|vừa|lại|sau đó|rồi)\b/gi, '')
      .trim();
    const desc = (cleaned.length >= 2 ? cleaned : fallback).slice(0, 80);
    if (desc.length >= 2) next = { ...next, description: desc };
  }

  return fillMissingSlots(next);
}
