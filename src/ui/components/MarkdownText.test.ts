import { describe, expect, it } from 'vitest';
import { prepareChatMarkdown } from '@/ui/components/MarkdownText';

describe('prepareChatMarkdown', () => {
  it('adds hard-break markers so single newlines render as lines', () => {
    const out = prepareChatMarkdown('✅ Đã thêm 2 sản phẩm\n💰 Tổng: 70.000₫\n\n1. ✅ A — 20.000₫');
    expect(out).toContain('sản phẩm  ');
    expect(out).toContain('70.000₫  ');
    expect(out.split('\n\n').length).toBeGreaterThanOrEqual(2);
  });
});
