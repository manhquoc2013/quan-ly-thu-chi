import { describe, expect, it } from 'vitest';
import { emptyIntent, normalizeIntent, type ChatIntent } from './chatIntent';
import {
  extractPaymentFromMessage,
  extractPrimaryAmountVnd,
  sanitizeIntentAgainstMessage,
} from './intentSanitize';
import { splitMultiTx } from './splitMultiTx';
import { EXTRACT_PROMPT } from './llmIntentExtractor';

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

  it('splits header tạo đơn + ưu tiên cho khách lines', () => {
    const msg = `tạo đơn 
khách Út Chi mua 1 Sửa trắng xanh hồng giá 55k và 1 bó hoa màu đỏ giá 55k đặt ở tiktok
ưu tiên cho khách Thu 3, chó đeo mắt kính giá 70k ở tiktok
ưu tiên cho khách T, chó đeo mắt kính giá 70k ở tiktok`;
    const parts = splitMultiTx(msg);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^khách Út Chi.*và 1 bó hoa.*tiktok/i);
    expect(parts[1]).toMatch(/^ưu tiên cho khách Thu 3,/i);
    expect(parts[2]).toMatch(/^ưu tiên cho khách T,/i);
  });

  it('does not split và line-items inside one tạo đơn', () => {
    const parts = splitMultiTx(
      'tạo đơn khách Út Chi mua 1 Sửa trắng xanh hồng giá 55k và 1 bó hoa màu đỏ giá 55k đặt ở tiktok',
    );
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatch(/và 1 bó hoa/i);
  });
});

describe('parsePriorityOrderCommand', () => {
  it('parses priority toggle commands', async () => {
    const { parsePriorityOrderCommand } = await import('./chatIntent');
    const set = parsePriorityOrderCommand('ưu tiên đơn DH-20260809-001');
    expect(set?.intent).toBe('update_revenue');
    expect(set?.priority).toBe(true);
    expect(set?.targetHint).toMatch(/DH-20260809-001/i);
    const clear = parsePriorityOrderCommand('bỏ ưu tiên đơn DH-20260809-001');
    expect(clear?.priority).toBe(false);
    expect(
      parsePriorityOrderCommand(
        'ưu tiên cho khách Thu 3, chó đeo mắt kính giá 70k ở tiktok',
      ),
    ).toBeNull();
  });
});

describe('sanitize does not flip LLM kind', () => {
  it('keeps create_expense even if message looks like a customer payment', () => {
    const bad: ChatIntent = {
      ...emptyIntent('create_expense'),
      amount: 300000,
      description: 'kẹp tóc',
    };
    const out = sanitizeIntentAgainstMessage('Hoa đã trả 300k cho 6 kẹp tóc', bad);
    expect(out.intent).toBe('create_expense');
    expect(out.amount).toBe(300000);
  });

  it('keeps create_revenue for "tạo đơn hàng khách"', () => {
    const intent: ChatIntent = {
      ...emptyIntent('create_revenue'),
      customerName: 'Hoa',
      description: 'kẹp tóc',
      amount: 90000,
    };
    const out = sanitizeIntentAgainstMessage(
      'tạo đơn hàng khách Hoa kẹp tóc giá 90k',
      intent,
    );
    expect(out.intent).toBe('create_revenue');
    expect(out.customerName?.toLowerCase()).toBe('hoa');
    expect(out.amount).toBe(90000);
  });

  it('does not force expense for uống nước when LLM said revenue', () => {
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
    expect(fixed.intent).toBe('create_revenue');
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

describe('extractPrimaryAmountVnd', () => {
  it('prefers giá 90k over bare 3', () => {
    expect(extractPrimaryAmountVnd('bán cho hoa 3 cái kẹp tóc giá 90k')).toBe(90000);
  });
});

describe('LLM-only routing contracts', () => {
  it('EXTRACT_PROMPT maps tạo đơn hàng khách to create_revenue', () => {
    expect(EXTRACT_PROMPT).toMatch(/tạo đơn hàng khách/i);
    expect(EXTRACT_PROMPT).toMatch(/CẤM create_expense/i);
    expect(EXTRACT_PROMPT).toMatch(/targetHint="SKU tất cả"/);
  });

  it('normalizeIntent keeps orderItems on create_revenue', () => {
    const intent = normalizeIntent({
      intent: 'create_revenue',
      customerName: 'Út Chi',
      description: 'Đơn Út Chi',
      amount: 110000,
      orderItems: [
        { name: 'Sửa trắng xanh hồng', quantity: 1, unitPrice: 55000 },
        { name: 'bó hoa màu đỏ', quantity: 1, unitPrice: 55000 },
      ],
      confidence: 0.9,
      missing: [],
      summaryVi: 'tạo đơn hàng khách Út Chi',
    });
    expect(intent?.intent).toBe('create_revenue');
    expect(intent?.orderItems).toHaveLength(2);
    expect(intent?.customerName).toMatch(/Út Chi/i);
  });
});
