import { describe, expect, it } from 'vitest';
import {
  parseNumericSku,
  nextSeqSku,
  looksLikeGenerateSkuMessage,
} from './productService';

describe('parseNumericSku', () => {
  it('parses padded numbers', () => {
    expect(parseNumericSku('0001')).toBe(1);
    expect(parseNumericSku('42')).toBe(42);
    expect(parseNumericSku('THU-MINI')).toBeNull();
  });
});

describe('nextSeqSku', () => {
  it('starts at 0001 when empty', () => {
    expect(nextSeqSku(new Set())).toBe('0001');
  });

  it('continues after max numeric sku', () => {
    const used = new Set(['0001', '0003', 'custom']);
    expect(nextSeqSku(used)).toBe('0004');
  });

  it('skips collision with padded form', () => {
    const used = new Set(['1', '2', '0003']);
    expect(nextSeqSku(used)).toBe('0004');
  });
});

describe('looksLikeGenerateSkuMessage', () => {
  it('detects bulk sku requests', () => {
    expect(looksLikeGenerateSkuMessage('tạo mã SKU cho tất cả sản phẩm')).toBe(true);
    expect(looksLikeGenerateSkuMessage('gán sku tự động')).toBe(true);
    expect(looksLikeGenerateSkuMessage('đổi giá Hello Kitty')).toBe(false);
  });
});
