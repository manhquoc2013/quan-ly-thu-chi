import { describe, expect, it } from 'vitest';
import { emptyIntent, type ChatIntent } from './chatIntent';
import {
  extractPaymentFromMessage,
  extractPrimaryAmountVnd,
  sanitizeIntentAgainstMessage,
} from './intentSanitize';
import { splitMultiTx } from './splitMultiTx';
import { parseTextToDraft } from './textDraftParser';

describe('splitMultiTx', () => {
  it('splits bán … sau đó lại uống …', () => {
    const parts = splitMultiTx(
      'tôi vừa bán cho hoa 3 cái kẹp tóc giá 90k sau đó lại uống nước hết 50k',
    );
    expect(parts).toEqual([
      'tôi vừa bán cho hoa 3 cái kẹp tóc giá 90k',
      'uống nước hết 50k',
    ]);
  });

  it('keeps payment clause on the sale segment', () => {
    const parts = splitMultiTx(
      'tôi vừa bán cho hoa 3 cái kẹp tóc giá 90k, và đã thanh toán bằng chuyển khoản sau đó lại uống nước hết 50k',
    );
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/bán cho hoa.*90k/i);
    expect(parts[0]).toMatch(/thanh toán.*chuyển khoản/i);
    expect(parts[1]).toBe('uống nước hết 50k');
  });

  it('splits comma + và into 3 txs (revenue + 2 expenses)', () => {
    const parts = splitMultiTx(
      'Hoa đã trả 300k cho 6 kẹp tóc, tôi đi uống nước nết 30k và đổ xăng hết 100k',
    );
    expect(parts).toEqual([
      'Hoa đã trả 300k cho 6 kẹp tóc',
      'tôi đi uống nước nết 30k',
      'đổ xăng hết 100k',
    ]);
  });

  it('does not split "bán cho X, N cái giá Yk" into orphan name', () => {
    const parts = splitMultiTx('bán cho Hoa, 3 cái kẹp tóc giá 90k');
    expect(parts).toEqual(['bán cho Hoa, 3 cái kẹp tóc giá 90k']);
  });

  it('keeps multi-line tạo đơn as 3 intact orders', () => {
    const msg = `tạo đơn khách Út Chi mua 1 Sửa trắng xanh hồng giá 55k và 1 bó hoa màu đỏ giá 55k đặt ở tiktok
tạo đơn khách Thu 3, chó đeo mắt kính giá 70k ở tiktok
tạo đơn khách T, chó đeo mắt kính giá 70k ở tiktok`;
    const parts = splitMultiTx(msg);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/Út Chi.*hoa màu đỏ.*tiktok/i);
    expect(parts[1]).toMatch(/Thu 3.*chó đeo mắt kính.*tiktok/i);
    expect(parts[2]).toMatch(/khách T,.*chó đeo mắt kính.*tiktok/i);
  });

  it('does not split và line-items inside one tạo đơn', () => {
    const parts = splitMultiTx(
      'tạo đơn khách Út Chi mua 1 Sửa trắng xanh hồng giá 55k và 1 bó hoa màu đỏ giá 55k đặt ở tiktok',
    );
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatch(/và 1 bó hoa/i);
  });
});

describe('parseTaoDonOrder', () => {
  it('parses multi-item order with TikTok', async () => {
    const { parseTextToDraft } = await import('./textDraftParser');
    const d = parseTextToDraft(
      'tạo đơn khách Út Chi mua 1 Sửa trắng xanh hồng giá 55k và 1 bó hoa màu đỏ giá 55k đặt ở tiktok',
    );
    expect(d?.kind).toBe('revenue');
    expect(d?.customerName).toMatch(/Út Chi/i);
    expect(d?.platformName).toBe('TikTok');
    expect(d?.orderItems).toHaveLength(2);
    expect(d?.amount).toBe(110000);
    expect(d?.orderItems?.[0]?.name).toMatch(/Sửa trắng xanh hồng/i);
    expect(d?.orderItems?.[1]?.name).toMatch(/hoa màu đỏ/i);
  });

  it('parses Thu 3, product as qty 3 unit price', async () => {
    const { parseTextToDraft } = await import('./textDraftParser');
    const d = parseTextToDraft(
      'tạo đơn khách Thu 3, chó đeo mắt kính giá 70k ở tiktok',
    );
    expect(d?.kind).toBe('revenue');
    expect(d?.customerName).toBe('Thu');
    expect(d?.quantity).toBe(3);
    expect(d?.unitPrice).toBe(70000);
    expect(d?.amount).toBe(210000);
    expect(d?.platformName).toBe('TikTok');
    expect(d?.description).toMatch(/chó đeo mắt kính/i);
  });

  it('parses 1-letter customer T', async () => {
    const { parseTextToDraft } = await import('./textDraftParser');
    const d = parseTextToDraft(
      'tạo đơn khách T, chó đeo mắt kính giá 70k ở tiktok',
    );
    expect(d?.kind).toBe('revenue');
    expect(d?.customerName).toBe('T');
    expect(d?.amount).toBe(70000);
    expect(d?.platformName).toBe('TikTok');
  });
});

describe('local drafts for multi-tx utterance', () => {
  it('parses customer paid + typo nết + đổ xăng hết as 3 drafts', () => {
    const msg =
      'oa đã trả 300k cho 6 kẹp tóc, tôi đi uống nước nết 30k và đổ xăng hết 100k';
    const segs = splitMultiTx(msg);
    expect(segs).toHaveLength(3);
    const drafts = segs.map((s) => parseTextToDraft(s));
    expect(drafts[0]?.kind).toBe('revenue');
    expect(drafts[0]?.amount).toBe(300000);
    expect(drafts[0]?.quantity).toBe(6);
    expect(drafts[1]?.kind).toBe('expense');
    expect(drafts[1]?.amount).toBe(30000);
    expect(drafts[2]?.kind).toBe('expense');
    expect(drafts[2]?.amount).toBe(100000);
  });
});

describe('sanitize customer paid → revenue', () => {
  it('flips expense to revenue for "Hoa đã trả 300k cho 6 kẹp tóc"', () => {
    const bad: ChatIntent = {
      ...emptyIntent('create_expense'),
      amount: 300000,
      description: 'kẹp tóc',
    };
    const out = sanitizeIntentAgainstMessage('Hoa đã trả 300k cho 6 kẹp tóc', bad);
    expect(out.intent).toBe('create_revenue');
    expect(out.amount).toBe(300000);
    expect(out.quantity).toBe(6);
  });

  it('cleans revenue description to product name only', () => {
    const bad: ChatIntent = {
      ...emptyIntent('create_revenue'),
      amount: 300000,
      quantity: 6,
      description: 'Hoa đã trả 300k cho 6 kẹp tóc',
      customerName: 'Hoa',
    };
    const out = sanitizeIntentAgainstMessage('Hoa đã trả 300k cho 6 kẹp tóc', bad);
    expect(out.description?.toLowerCase()).toBe('kẹp tóc');
  });
});

describe('extractPaymentFromMessage', () => {
  it('detects paid + bank transfer', () => {
    const pay = extractPaymentFromMessage(
      'bán cho hoa 3 cái kẹp tóc giá 90k, đã thanh toán bằng chuyển khoản',
    );
    expect(pay.paymentStatus).toBe('paid');
    expect(pay.paymentMethod).toBe('bank_transfer');
  });
});

describe('sanitizeIntentAgainstMessage', () => {
  it('forces expense for uống nước and strips hallucinated entities', () => {
    const bad: ChatIntent = {
      ...emptyIntent('create_revenue'),
      amount: 50000,
      description: 'uống nước hết 50k',
      quantity: 10,
      customerName: 'Hoa',
      platformName: 'Website',
      confidence: 0.9,
      missing: [],
    };
    const fixed = sanitizeIntentAgainstMessage('uống nước hết 50k', bad);
    expect(fixed.intent).toBe('create_expense');
    expect(fixed.customerName).toBeUndefined();
    expect(fixed.platformName).toBeUndefined();
    expect(fixed.quantity ?? 1).toBe(1);
    expect(fixed.amount).toBe(50000);
  });

  it('keeps revenue for bán cho Hoa with qty + total giá + paid CK', () => {
    const bad: ChatIntent = {
      ...emptyIntent('create_revenue'),
      amount: 90000,
      description: 'kẹp tóc',
      quantity: 10,
      customerName: 'Hoa',
      platformName: 'Website',
      confidence: 0.9,
      missing: [],
    };
    const msg = 'tôi vừa bán cho hoa 3 cái kẹp tóc giá 90k, đã thanh toán bằng chuyển khoản';
    const fixed = sanitizeIntentAgainstMessage(msg, bad);
    expect(fixed.intent).toBe('create_revenue');
    expect(fixed.customerName?.toLowerCase()).toBe('hoa');
    expect(fixed.platformName).toBeUndefined();
    expect(fixed.quantity).toBe(3);
    expect(fixed.amount).toBe(90000);
    expect(fixed.paymentStatus).toBe('paid');
    expect(fixed.paymentMethod).toBe('bank_transfer');
    expect(fixed.description?.toLowerCase()).toContain('kẹp tóc');
    expect(fixed.description?.toLowerCase()).not.toContain('uống');
  });
});

describe('extractPrimaryAmountVnd', () => {
  it('prefers giá 90k over bare 3', () => {
    expect(extractPrimaryAmountVnd('bán cho hoa 3 cái kẹp tóc giá 90k')).toBe(90000);
  });
});
