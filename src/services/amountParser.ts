/**
 * Amount + FX parsing for Vietnamese conversational entry.
 */

export const DEFAULT_FX_RATES: Record<string, number> = {
  USD: 25450,
  EUR: 27500,
  JPY: 170,
  CNY: 3500,
  KRW: 18.5,
  SGD: 19000,
  AUD: 16500,
};

const FX_ALIASES: Record<string, string> = {
  usd: 'USD', dollar: 'USD', đô: 'USD', 'đô la': 'USD',
  eur: 'EUR', euro: 'EUR',
  jpy: 'JPY', yen: 'JPY',
  cny: 'CNY', nhân: 'CNY', rmb: 'CNY',
  krw: 'KRW', won: 'KRW',
  sgd: 'SGD',
  aud: 'AUD',
};

export interface ParsedMoney {
  amountVnd: number;
  rawFx?: { currency: string; original: number; rate: number };
}

/** Parse amounts like 25k, 1.5tr, 1,500,000, 100 USD, 50$ */
export function parseMoney(raw: string, rates: Record<string, number> = DEFAULT_FX_RATES): ParsedMoney | null {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;

  // "$100" / "100$" / "100 USD" / "USD 100"
  const fxLeading = cleaned.match(/^(USD|EUR|JPY|CNY|KRW|SGD|AUD|\$)\s*([\d.,]+)$/i);
  const fxTrailing = cleaned.match(/^([\d.,]+)\s*(USD|EUR|JPY|CNY|KRW|SGD|AUD|\$|đô(?:\s*la)?|dollar|euro|yen|won)$/i);

  if (fxLeading || fxTrailing) {
    const numStr = fxLeading ? fxLeading[2]! : fxTrailing![1]!;
    const curRaw = fxLeading ? fxLeading[1]! : fxTrailing![2]!;
    const original = parseNumberToken(numStr);
    if (original == null || original <= 0) return null;

    const key = curRaw === '$' ? 'USD' : (FX_ALIASES[curRaw.toLowerCase()] ?? curRaw.toUpperCase());
    const rate = rates[key];
    if (!rate) return { amountVnd: Math.round(original) };
    return {
      amountVnd: Math.round(original * rate),
      rawFx: { currency: key, original, rate },
    };
  }

  // Vietnamese units: 25k, 1.5tr, 2triệu, 1m
  const unitMatch = cleaned.match(/^([\d.,]+)\s*(k|nghìn|ngàn|tr|triệu|m|trieu)?$/i);
  if (!unitMatch) return null;

  const base = parseNumberToken(unitMatch[1]!);
  if (base == null || base <= 0) return null;
  const unit = (unitMatch[2] ?? '').toLowerCase();

  let amountVnd = base;
  if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') amountVnd = base * 1_000;
  else if (unit === 'tr' || unit === 'triệu' || unit === 'trieu' || unit === 'm') {
    amountVnd = base * 1_000_000;
  }

  return { amountVnd: Math.round(amountVnd) };
}

/** Extract first money-like token from free text. */
export function extractMoneyFromText(text: string, rates?: Record<string, number>): ParsedMoney | null {
  const patterns = [
    /(\d[\d.,]*)\s*(USD|EUR|JPY|CNY|KRW|SGD|AUD|\$|đô(?:\s*la)?)/i,
    /(\d[\d.,]*)\s*(k|nghìn|ngàn|tr|triệu|m)\b/i,
    /(\d{1,3}(?:[.,]\d{3})+)/,
    /(\d+)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const token = m[0]!;
    const parsed = parseMoney(token, rates);
    if (parsed && parsed.amountVnd > 0) return parsed;
  }
  return null;
}

function parseNumberToken(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;

  // 1.500.000 or 1,500,000 → thousands separators
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) {
    s = s.replace(/[.,]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  // 1.5 or 1,5 → decimal
  if (/^\d+[.,]\d+$/.test(s)) {
    s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
