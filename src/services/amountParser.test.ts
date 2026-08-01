import { describe, expect, it } from 'vitest';
import { parseMoney, extractMoneyFromText } from './amountParser';
import {
  looksLikeBulkLineList,
  parseLineListDrafts,
  parseTextToDraft,
  parseTextToDrafts,
  shouldDeferCreateToLlm,
} from './textDraftParser';
import { validateDraft, draftsHaveErrors } from './draftTypes';
import { normalizeBulkExtract } from './llmBulkDraftExtractor';

describe('parseMoney', () => {
  it('parses k and tr units', () => {
    expect(parseMoney('25k')?.amountVnd).toBe(25000);
    expect(parseMoney('1.5tr')?.amountVnd).toBe(1_500_000);
    expect(parseMoney('2triệu')?.amountVnd).toBe(2_000_000);
  });

  it('parses FX to VND', () => {
    const r = parseMoney('100 USD');
    expect(r?.amountVnd).toBe(2_545_000);
    expect(r?.rawFx?.currency).toBe('USD');
  });

  it('parses Vietnamese dong suffix and thousands dots', () => {
    expect(parseMoney('798.000')?.amountVnd).toBe(798_000);
    expect(parseMoney('798.000 ₫')?.amountVnd).toBe(798_000);
    expect(parseMoney('798.000đ')?.amountVnd).toBe(798_000);
    expect(parseMoney('98.000 VND')?.amountVnd).toBe(98_000);
    expect(parseMoney('130.000 đồng')?.amountVnd).toBe(130_000);
  });
});

describe('parseTextToDraft', () => {
  it.each([
    ['cà phê 25k', 'expense', 25000],
    ['đổ xăng 30k', 'expense', 30000],
    ['xăng 30', 'expense', 30000],
    ['chi 50k ăn trưa', 'expense', 50000],
    ['mua bút 15k', 'expense', 15000],
    ['thanh toán 2tr tiền thuê', 'expense', 2_000_000],
    ['thêm chi phí 100k tiền điện', 'expense', 100000],
    ['ăn sáng hết 30k', 'expense', 30000],
    ['50000 tiền mạng', 'expense', 50000],
    ['bán nước 15k cho Hùng', 'revenue', 15000],
    ['thu 50k từ Hùng', 'revenue', 50000],
    ['doanh thu 200k bán mỹ phẩm', 'revenue', 200000],
    ['khách Lan trả 80k', 'revenue', 80000],
    ['mua phần mềm 10 USD', 'expense', 254500],
  ] as const)('%s → %s %d', (input, kind, amount) => {
    const d = parseTextToDraft(input);
    expect(d).not.toBeNull();
    expect(d!.kind).toBe(kind);
    expect(d!.amount).toBe(amount);
  });

  it('parses bán … cho khách with multi-word product', () => {
    const d = parseTextToDraft('bán Thú nhồi bông 25k cho hùng');
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('revenue');
    expect(d!.amount).toBe(25000);
    expect(d!.description.toLowerCase()).toContain('thú nhồi bông');
    expect(d!.customerName?.toLowerCase()).toBe('hùng');
  });

  it('parses bán cho + giá = tổng hàng', () => {
    const d = parseTextToDraft('bán cho Hoa 3 kẹp tóc giá 90k');
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('revenue');
    expect(d!.customerName?.toLowerCase()).toBe('hoa');
    expect(d!.quantity).toBe(3);
    expect(d!.amount).toBe(90_000);
    expect(d!.unitPrice).toBe(30_000);
    expect(d!.description.toLowerCase()).toContain('kẹp tóc');
    expect(d!.description).not.toMatch(/^cho\b/i);
  });

  it('parses đơn giá / giá mỗi cái as unit price', () => {
    const a = parseTextToDraft('bán cho Hoa 3 kẹp tóc đơn giá 15k');
    expect(a!.unitPrice).toBe(15_000);
    expect(a!.amount).toBe(45_000);
    const b = parseTextToDraft('Như mua 3 kẹp tóc giá mỗi cái 30k ở Zalo');
    expect(b!.unitPrice).toBe(30_000);
    expect(b!.amount).toBe(90_000);
    expect(b!.platformName?.toLowerCase()).toBe('zalo');
    expect(b!.description.toLowerCase()).toContain('kẹp tóc');
    expect(b!.description.toLowerCase()).not.toMatch(/mỗi|đơn giá/);
  });

  it('strips qua Zalo from product and sets platform', () => {
    const d = parseTextToDraft('bán cho Dung 3 kẹp tóc qua Zalo giá 60k');
    expect(d).not.toBeNull();
    expect(d!.customerName?.toLowerCase()).toBe('dung');
    expect(d!.quantity).toBe(3);
    expect(d!.amount).toBe(60_000);
    expect(d!.unitPrice).toBe(20_000);
    expect(d!.platformName?.toLowerCase()).toBe('zalo');
    expect(d!.description.toLowerCase()).toContain('kẹp tóc');
    expect(d!.description.toLowerCase()).not.toContain('zalo');
    expect(d!.description.toLowerCase()).not.toContain('qua');
  });

  it.each([
    'Dung mua 3 kẹp tóc qua Zalo giá 60k',
    'Dung mua 3 kẹp tóc giá 60k ở Zalo',
    'Dung lấy 3 kẹp tóc qua Zalo giá 60k',
    'Dung đã mua 3 kẹp tóc giá 60k bên Zalo',
    'khách Dung mua 3 kẹp tóc giá 60k trên Zalo',
    'hôm nay Dung mua 3 kẹp tóc giá 60k ở Zalo',
  ])('parses customer sale with Zalo: %s', (msg) => {
    const d = parseTextToDraft(msg);
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('revenue');
    expect(d!.customerName?.toLowerCase()).toBe('dung');
    expect(d!.quantity).toBe(3);
    expect(d!.amount).toBe(60_000);
    expect(d!.unitPrice).toBe(20_000);
    expect(d!.platformName?.toLowerCase()).toBe('zalo');
    expect(d!.description.toLowerCase()).toContain('kẹp tóc');
    expect(d!.description.toLowerCase()).not.toContain('zalo');
  });

  it('parses cọc + ship khách chịu trên câu bán', () => {
    const d = parseTextToDraft(
      'Như mua 3 kẹp tóc giá 90k, đã cọc 30k ở Zalo, khách chịu phí ship 11k',
    );
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('revenue');
    expect(d!.customerName?.toLowerCase()).toBe('như');
    expect(d!.quantity).toBe(3);
    expect(d!.amount).toBe(90_000);
    expect(d!.unitPrice).toBe(30_000);
    expect(d!.depositAmount).toBe(30_000);
    expect(d!.shippingFee).toBe(11_000);
    expect(d!.shippingPayer).toBe('customer');
    expect(d!.platformName?.toLowerCase()).toBe('zalo');
    expect(d!.description.toLowerCase()).toContain('kẹp tóc');
    expect(d!.description.toLowerCase()).not.toMatch(/cọc|ship/);
  });

  it('keeps leading mua … as expense (shop buying)', () => {
    const d = parseTextToDraft('mua len 500k');
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('expense');
    expect(d!.amount).toBe(500_000);
  });

  it('treats nhập … as expense (stock in)', () => {
    const d = parseTextToDraft('nhập len SS5 798k');
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('expense');
    expect(d!.amount).toBe(798_000);
    expect(d!.description.toLowerCase()).toContain('len');
  });

  it('parses hôm nay {khách} có mua … as revenue (not soft-expense)', () => {
    const d = parseTextToDraft('hôm nay Dung có mua kẹp tóc qua Zalo 60k');
    expect(d?.kind).toBe('revenue');
    expect(d?.customerName?.toLowerCase()).toBe('dung');
    expect(d?.platformName?.toLowerCase()).toBe('zalo');
    expect(d?.amount).toBe(60_000);
    expect(shouldDeferCreateToLlm('mua len 500k')).toBe(false);
    expect(parseTextToDraft('mua len 500k')?.kind).toBe('expense');
  });

  it('parses 3 cái kẹp tóc giá = tổng', () => {
    const d = parseTextToDraft('bán cho Hoa 3 cái kẹp tóc giá 40k');
    expect(d).not.toBeNull();
    expect(d!.quantity).toBe(3);
    expect(d!.amount).toBe(40_000);
    expect(d!.unitPrice).toBe(Math.round(40_000 / 3));
    expect(d!.description.toLowerCase()).toContain('kẹp tóc');
  });

  it('parses multiple clauses in one message', () => {
    const drafts = parseTextToDrafts(
      'bán cho Hoa 3 cái kẹp tóc giá 40k bán cho Hà cặp thú len giá 120k mua len 500k',
    );
    expect(drafts).toHaveLength(3);
    expect(drafts[0]!.kind).toBe('revenue');
    expect(drafts[0]!.customerName?.toLowerCase()).toBe('hoa');
    expect(drafts[0]!.amount).toBe(40_000);
    expect(drafts[1]!.kind).toBe('revenue');
    expect(drafts[1]!.customerName?.toLowerCase()).toBe('hà');
    expect(drafts[1]!.amount).toBe(120000);
    expect(drafts[2]!.kind).toBe('expense');
    expect(drafts[2]!.amount).toBe(500000);
    expect(drafts[2]!.description.toLowerCase()).toContain('len');
  });

  it('parses multi-line expense paste with dong amounts', () => {
    const msg = `thêm chi phí:
Len SS5, 125g	798.000 ₫
Len Milk bò 	350.000 ₫
Nhung Gấu	250.000 ₫
Bông,...	98.000 ₫
300 móc khóa	130.000 ₫
Len bayby yarn _ nhung gấu	456.000 ₫`;
    expect(looksLikeBulkLineList(msg)).toBe(true);
    const { drafts, skipped } = parseLineListDrafts(msg);
    expect(skipped.length).toBe(0);
    expect(drafts).toHaveLength(6);
    expect(drafts.every((d) => d.kind === 'expense')).toBe(true);
    expect(drafts[0]!.amount).toBe(798_000);
    expect(drafts[0]!.description.toLowerCase()).toContain('len ss5');
    expect(drafts[3]!.amount).toBe(98_000);
    expect(drafts[4]!.description.toLowerCase()).toContain('300 móc khóa');
    expect(drafts[4]!.amount).toBe(130_000);

    const viaParse = parseTextToDrafts(msg);
    expect(viaParse).toHaveLength(6);
    expect(viaParse.reduce((s, d) => s + d.amount, 0)).toBe(
      798_000 + 350_000 + 250_000 + 98_000 + 130_000 + 456_000,
    );
  });

  it('parses full shopping-list paste (20 lines)', () => {
    const msg = `thêm chi phí:
Len SS5, 125g	798.000 ₫
Len Milk bò 	350.000 ₫
Nhung Gấu	250.000 ₫
Kẽm sợi dệt,...	220.000 ₫
Bông,...	98.000 ₫
Len mác đen + bò + ss (shopee	286.000 ₫
Móc khóa, phôi kẹp tóc,...	300.000 ₫
Len nhung gấu	135.000 ₫
Len mua ở shop HN (sợi coton vn, ss4,...)	300.000 ₫
Len coton gai,vải, mũi heo	298.000 ₫
Sợi Organic cotton (móc váy cho bomi)	120.000 ₫
len nhung đũa sợi mini	80.000 ₫
Bông,...	82.000 ₫
300 móc khóa	130.000 ₫
120 hộp giấy	113.000 ₫
tem nhãn	96.000 ₫
dây kẽm, ... 	61.000 ₫
 Túi niêm phong	51.000 ₫
Túi bóng gói hàng	39.000 ₫
Len bayby yarn _ nhung gấu	456.000 ₫`;
    const drafts = parseTextToDrafts(msg);
    expect(drafts).toHaveLength(20);
    expect(drafts.reduce((s, d) => s + d.amount, 0)).toBe(4_263_000);
  });

  it('does not invent one junk expense from a failed bulk paste shape', () => {
    const msg = `Len A\txxx
Len B\tyyy`;
    expect(looksLikeBulkLineList(msg)).toBe(false);
  });

  it('parses bán cho khách without qty', () => {
    const d = parseTextToDraft('bán cho Hùng thú nhồi bông 25k');
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('revenue');
    expect(d!.customerName?.toLowerCase()).toBe('hùng');
    expect(d!.amount).toBe(25000);
    expect(d!.description.toLowerCase()).toContain('thú nhồi bông');
  });

  it('ignores analysis prompts', () => {
    expect(parseTextToDraft('phân tích chi phí')).toBeNull();
    expect(parseTextToDraft('tổng quan tháng')).toBeNull();
    expect(parseTextToDraft('lợi nhuận tháng này')).toBeNull();
  });
});

describe('normalizeBulkExtract', () => {
  it('maps LLM items to expense drafts', () => {
    const drafts = normalizeBulkExtract({
      kind: 'expense',
      items: [
        { description: 'Len SS5', amount: 798000 },
        { description: 'Bông', amount: 98000 },
        { description: '', amount: 1000 },
        { description: 'Bad', amount: 0 },
      ],
    });
    expect(drafts).toHaveLength(2);
    expect(drafts[0]!.amount).toBe(798000);
    expect(drafts[1]!.description.toLowerCase()).toContain('bông');
  });
});

describe('validateDraft', () => {
  it('flags missing amount', () => {
    const d = validateDraft({
      id: '1',
      kind: 'expense',
      date: '2026-08-01',
      amount: 0,
      description: 'Test',
      category: 'other',
      source: 'text',
    });
    expect(draftsHaveErrors([d])).toBe(true);
  });
});

describe('extractMoneyFromText', () => {
  it('finds money in free text', () => {
    expect(extractMoneyFromText('mua phần mềm 50 USD')?.amountVnd).toBe(1_272_500);
  });
});
