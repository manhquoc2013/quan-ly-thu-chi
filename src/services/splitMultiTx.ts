/**
 * Split a message into multiple transaction segments.
 * Detects conjunctions + amount patterns; re-attaches payment/ship modifiers
 * that would otherwise be dropped (e.g. "…90k, và đã thanh toán CK sau đó uống nước 50k").
 */

/** True if fragment looks like its own create (amount or action verb). */
function looksLikeStandaloneTx(text: string): boolean {
  return /\d+[kKmM]|\b(bán|mua|chi|thu|uống|ăn|đổ|nhập)\b/i.test(text);
}

/** Payment / debt / ship notes that belong to the previous sale, not a new tx. */
function isTxModifierOnly(text: string): boolean {
  const t = text.trim();
  if (!t || looksLikeStandaloneTx(t)) return false;
  return /\b(thanh toán|đã trả|chưa trả|công nợ|ghi nợ|chuyển khoản|\bck\b|tiền mặt|cash|paid|cọc|đặt cọc|phí ship|ship)\b/i.test(
    t,
  );
}

export function splitMultiTx(message: string): string[] {
  const parts = message
    .split(/\s*(?:,\s*)?(?:sau đó\s+(?:lại\s+)?|rồi\s+(?:lại\s+)?|và\s+)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) return [message];

  // Fold "đã thanh toán bằng chuyển khoản" into the previous segment
  const merged: string[] = [];
  for (const part of parts) {
    if (merged.length > 0 && isTxModifierOnly(part)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]!}, ${part}`;
      continue;
    }
    merged.push(part);
  }

  const valid = merged.filter((p) => looksLikeStandaloneTx(p));
  return valid.length >= 2 ? valid : [message];
}
