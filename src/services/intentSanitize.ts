/**
 * Post-process LLM intents against the source message to strip hallucinations
 * common with small local models (wrong kind, qty, platform, customer, payment).
 */

import { extractMoneyFromText, parseMoney } from './amountParser';
import { fillMissingSlots, type ChatIntent } from './chatIntent';
import { productQueryFromDescription } from './entityResolve';
import type { PaymentMethod, PaymentStatus } from '@/models';

const PLATFORM_ALIASES: Record<string, string[]> = {
  Shopee: ['shopee', 'shope', 'shoppe'],
  TikTok: ['tiktok', 'tik tok', 'tt shop'],
  Facebook: ['facebook', 'fb', 'messenger'],
  Zalo: ['zalo', 'zl'],
  Website: ['website', 'web', 'trang web'],
  'Trực tiếp': ['trực tiếp', 'offline', 'tại quán', 'tại shop'],
};

/** "{Tên} (đã) trả/chuyển/đưa N cho SP" = khách trả tiền hàng → revenue */
function looksLikeCustomerPaid(lower: string): boolean {
  // Avoid \b after Vietnamese letters (JS \w is ASCII-only → \b breaks on "trả")
  return (
    /(?:^|\s)(?:khách\s+)?[A-Za-zÀ-ỹ]{2,}(?:\s+[A-Za-zÀ-ỹ]{2,})?\s+(?:đã\s+)?(?:trả|chuyển|đưa|ck)(?:\s|$)/i.test(
      lower,
    ) && !/^(?:tôi|mình|em|shop)\b/i.test(lower.trim())
  );
}

function looksLikeExpenseOnly(lower: string): boolean {
  const expenseCue =
    /\b(uống|ăn\s|cafe|cà phê|đổ xăng|bơm xăng|grab|chi\s|tiêu\s|nhập\s|mua\s)/i.test(lower);
  const revenueCue =
    /\b(bán(\s+cho)?|thu\s+\d|doanh thu|khách\s+\S+\s+(mua|lấy|đặt))\b/i.test(lower) ||
    /\b[A-Za-zÀ-ỹ]{2,}\s+(mua|lấy|đặt|order)\b/i.test(lower) ||
    looksLikeCustomerPaid(lower);
  const shopBuy = /^(?:tôi|mình|em|shop)?\s*(?:vừa\s+)?(?:mua|nhập|chi)\b/i.test(lower);
  return (expenseCue && !revenueCue) || shopBuy;
}

function looksLikeRevenue(lower: string): boolean {
  return (
    /\b(bán(\s+cho)?|thu\s+\d|doanh thu)\b/i.test(lower) ||
    /\b[A-Za-zÀ-ỹ]{2,}\s+(mua|lấy|đặt|order)\b/i.test(lower) ||
    looksLikeCustomerPaid(lower)
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
  const withUnit = message.match(/(\d+)\s*(cái|chiếc|bộ|cặp|set|ly|chai|hộp)/i);
  if (withUnit) return Math.max(1, parseInt(withUnit[1]!, 10));
  // "6 kẹp tóc" / "3 thú len" — số + tên SP (không phải tiền 300k / 1tr)
  const withProduct = message.match(
    /(?:cho|mua|bán|lấy|đặt)\s+(\d+)\s+(?!k(?:\s|$)|m(?:\s|$)|nghìn|ngàn|tr(?:\s|$)|triệu)([A-Za-zÀ-ỹ]{2,})/i,
  );
  if (withProduct) return Math.max(1, parseInt(withProduct[1]!, 10));
  return undefined;
}

function platformMentioned(lower: string, platformName: string): boolean {
  const aliases = PLATFORM_ALIASES[platformName] ?? [platformName.toLowerCase()];
  return aliases.some((a) => lower.includes(a));
}

export function extractPaymentFromMessage(message: string): {
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
} {
  const lower = message.toLowerCase();
  let paymentStatus: PaymentStatus | undefined;
  if (/\b(chưa thanh toán|công nợ|ghi nợ|chưa trả)\b/i.test(lower)) {
    paymentStatus = 'unpaid';
  } else if (/\b(đã thanh toán|đã trả|paid|thanh toán rồi)\b/i.test(lower)) {
    paymentStatus = 'paid';
  }

  let paymentMethod: PaymentMethod | undefined;
  if (/\b(chuyển khoản|chuyen khoan|\bck\b|transfer|banking)\b/i.test(lower)) {
    paymentMethod = 'bank_transfer';
    paymentStatus ??= 'paid';
  } else if (/\b(tiền mặt|tien mat|cash)\b/i.test(lower)) {
    paymentMethod = 'cash';
  } else if (/\b(thẻ|the tin dung|credit card|visa|mastercard)\b/i.test(lower)) {
    paymentMethod = 'credit_card';
  } else if (/\b(momo|zalopay|ví điện tử|e-?wallet)\b/i.test(lower)) {
    paymentMethod = 'e_wallet';
  }

  return { paymentStatus, paymentMethod };
}

/**
 * Correct kind / amount / qty / entities / payment using only the user message.
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
    next = { ...next, quantity: 1 };
  }

  const amount = extractPrimaryAmountVnd(message);
  if (amount != null) {
    if (next.intent === 'create_revenue' && (next.quantity ?? 1) > 1) {
      next = {
        ...next,
        amount,
        unitPrice: Math.round(amount / (next.quantity ?? 1)),
      };
    } else {
      next = { ...next, amount };
    }
  }

  if (next.intent === 'create_revenue') {
    const pay = extractPaymentFromMessage(message);
    next = {
      ...next,
      paymentStatus: pay.paymentStatus ?? next.paymentStatus,
      paymentMethod: pay.paymentMethod ?? next.paymentMethod,
    };
    const rawDesc = next.description ?? message;
    const cleaned = productQueryFromDescription(rawDesc);
    if (cleaned.length >= 2) next = { ...next, description: cleaned };
  } else if (next.intent === 'create_expense') {
    const raw = next.description && next.description.length >= 2 ? next.description : message;
    let cleaned = productQueryFromDescription(raw).trim();
    if (cleaned.length < 2) {
      cleaned = message
        .replace(/\d[\d.,]*\s*[kKmM](?![a-zA-ZÀ-ỹ])/g, '')
        .replace(/\d[\d.,]*\s*(?:nghìn|ngàn|tr|triệu|hết|giá)?/gi, '')
        .replace(/\b(tôi|mình|em|vừa|lại|sau đó|rồi|đi|đã thanh toán|chuyển khoản)\b/gi, '')
        .trim();
    }
    const desc = cleaned.slice(0, 80);
    if (desc.length >= 2) next = { ...next, description: desc };
  }

  return fillMissingSlots(next);
}
