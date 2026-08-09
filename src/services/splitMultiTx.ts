/**
 * Split a message into multiple transaction segments.
 * Detects commas / conjunctions + amount patterns; re-attaches payment/ship modifiers
 * that would otherwise be dropped (e.g. "…90k, và đã thanh toán CK sau đó uống nước 50k").
 *
 * Important: multi-line "tạo đơn …" / sale lines must NOT be shredded by "và" / commas
 * inside the same order (line items, "Thu 3, chó …").
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

/** One spoken/typed order or sale line (keep whole — do not split on và/comma). */
function looksLikeOrderLine(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^(?:tạo|thêm)\s+đơn\b/i.test(t)) return true;
  if (/^bán\s+cho\b/i.test(t)) return true;
  if (/^khách\s+\S+/i.test(t) && /\b(?:mua|lấy|đặt|order)\b/i.test(t)) return true;
  if (/^khách\s+\S+/i.test(t) && hasAmountToken(t)) return true;
  return false;
}

/**
 * Right side of "và" is another product line in the same order
 * e.g. "1 bó hoa màu đỏ giá 55k đặt ở tiktok"
 */
function isSameOrderLineItemContinuation(text: string): boolean {
  const t = text.trim();
  if (!t || !hasAmountToken(t)) return false;
  // New expense / shop buy — real second tx
  if (/^(?:tôi|mình|em|shop)\b/i.test(t)) return false;
  if (/\b(?:uống|ăn\s|đổ\s*xăng|bơm\s*xăng|chi\s|nhập\s|tiêu\s)\b/i.test(t)) return false;
  if (looksLikeOrderLine(t)) return false;
  // "1 SP … giá 55k" / "bó hoa … giá 55k"
  if (/^\d{1,4}\s+\S+/i.test(t) && /\bgiá\b/i.test(t)) return true;
  if (/\bgiá\s+\d/i.test(t) && !/\b(?:bán|thu|chi)\b/i.test(t)) return true;
  return false;
}

/** Conjunction split for a single line (sale + expense compounds). */
function splitConjunctionTx(message: string): string[] {
  const rough = message
    .split(/\s*(?:,\s*|(?:sau đó\s+(?:lại\s+)?|rồi\s+(?:lại\s+)?|và\s+))\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rough.length <= 1) return [message];

  // Re-glue "và" product line-items back onto the previous order fragment
  const rejoined: string[] = [];
  for (const part of rough) {
    if (
      rejoined.length > 0 &&
      isSameOrderLineItemContinuation(part) &&
      /(?:bán|mua|đặt|đơn|khách)\b/i.test(rejoined[rejoined.length - 1]!)
    ) {
      rejoined[rejoined.length - 1] = `${rejoined[rejoined.length - 1]!} và ${part}`;
      continue;
    }
    rejoined.push(part);
  }

  const merged: string[] = [];
  let pending = '';

  const take = (piece: string) => {
    if (merged.length > 0 && isTxModifierOnly(piece)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]!}, ${piece}`;
      return;
    }
    merged.push(piece);
  };

  for (const part of rejoined) {
    const combined = pending ? `${pending}, ${part}` : part;
    if (!hasAmountToken(combined)) {
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

function splitOneLine(line: string): string[] {
  const t = line.trim();
  if (!t) return [];
  // Spoken "tạo đơn …" / "thêm đơn …" is always one order (may contain "và" line items)
  if (/^(?:tạo|thêm)\s+đơn\b/i.test(t)) return [t];
  if (looksLikeOrderLine(t) && hasAmountToken(t)) return [t];
  return splitConjunctionTx(t);
}

export function splitMultiTx(message: string): string[] {
  const lines = message
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Multi-line batch of orders: one segment per line
  if (lines.length >= 2) {
    const orderLines = lines.filter((l) => looksLikeOrderLine(l) && hasAmountToken(l));
    if (orderLines.length >= 2 && orderLines.length === lines.length) {
      return orderLines;
    }
    // Mixed: keep order lines whole, conjunction-split the rest
    if (orderLines.length >= 2) {
      const parts = lines.flatMap((l) => splitOneLine(l));
      const valid = parts.filter((p) => hasAmountToken(p) && looksLikeStandaloneTx(p));
      if (valid.length >= 2) return valid;
    }
  }

  if (lines.length === 1) return splitOneLine(lines[0]!);

  // Fallback: conjunction split on whole message (legacy single-line compounds)
  return splitConjunctionTx(message.replace(/\s*\n+\s*/g, ' ').trim());
}
