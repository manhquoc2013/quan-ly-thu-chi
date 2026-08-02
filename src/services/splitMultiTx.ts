/**
 * Split a message into multiple transaction segments.
 * Detects conjunctions + amount patterns to avoid regex false positives.
 */
export function splitMultiTx(message: string): string[] {
  const parts = message.split(/\s*(?:,\s*)?(?:sau đó\s+(?:lại\s+)?|rồi\s+(?:lại\s+)?|và\s+)\s*/i);
  if (parts.length <= 1) return [message];
  const valid = parts.filter((p) =>
    /\d+[kKmM]|\b(bán|mua|chi|thu|uống|ăn|đổ|trả)\b/i.test(p),
  );
  return valid.length >= 2 ? valid : [message];
}
