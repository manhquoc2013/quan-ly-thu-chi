/**
 * Split a message into multiple transaction segments.
 * Detects commas / conjunctions + amount patterns; re-attaches payment/ship modifiers
 * that would otherwise be dropped (e.g. "…90k, và đã thanh toán CK sau đó uống nước 50k").
 */

/** Money token: 300k / 1.5tr / 100.000₫ / 50000 */
function hasAmountToken(text: string): boolean {
  return (
    /\d+[.,]?\d*\s*(?:k|K|m|M|tr|nghìn|ngàn|nghin|đồng|vnd|₫|đ)\b/.test(text) ||
    /\d+[kKmM]\b/.test(text) ||
    /\d{1,3}(?:[.,]\d{3})+(?:\s*(?:₫|đ|vnd|đồng))?/.test(text)
  );
}

/** True if fragment looks like its own create (amount or action verb). */
function looksLikeStandaloneTx(text: string): boolean {
  return hasAmountToken(text) || /\b(bán|mua|chi|thu|uống|ăn|đổ|nhập)\b/i.test(text);
}

/** Payment / debt / ship notes that belong to the previous sale, not a new tx. */
function isTxModifierOnly(text: string): boolean {
  const t = text.trim();
  if (!t || hasAmountToken(t)) return false;
  if (looksLikeStandaloneTx(t)) return false;
  return /\b(thanh toán|đã trả|chưa trả|công nợ|ghi nợ|chuyển khoản|\bck\b|tiền mặt|cash|paid|cọc|đặt cọc|phí ship|ship)\b/i.test(
    t,
  );
}

export function splitMultiTx(message: string): string[] {
  // Split on comma OR "sau đó" / "rồi" / "và" (comma alone used to miss "A 300k, tôi … 30k và …")
  const rough = message
    .split(/\s*(?:,\s*|(?:sau đó\s+(?:lại\s+)?|rồi\s+(?:lại\s+)?|và\s+))\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rough.length <= 1) return [message];

  // Glue amount-less fragments forward ("bán cho Hoa" + "3 cái giá 90k")
  // and fold payment modifiers into the previous segment.
  const merged: string[] = [];
  let pending = '';

  const take = (piece: string) => {
    if (merged.length > 0 && isTxModifierOnly(piece)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]!}, ${piece}`;
      return;
    }
    merged.push(piece);
  };

  for (const part of rough) {
    const combined = pending ? `${pending}, ${part}` : part;
    if (!hasAmountToken(combined)) {
      // Still incomplete — keep buffering (unless it's a pure modifier after a tx)
      if (!pending && merged.length > 0 && isTxModifierOnly(part)) {
        take(part);
        continue;
      }
      pending = combined;
      continue;
    }
    take(combined);
    pending = '';
  }

  if (pending) {
    if (merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]!}, ${pending}`;
    } else {
      merged.push(pending);
    }
  }

  const valid = merged.filter((p) => hasAmountToken(p) && looksLikeStandaloneTx(p));
  return valid.length >= 2 ? valid : [message];
}
