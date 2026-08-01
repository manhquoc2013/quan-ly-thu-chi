import { describe, expect, it } from 'vitest';
import { parseMoney, extractMoneyFromText } from './amountParser';
import { parseTextToDraft } from './textDraftParser';
import { validateDraft, draftsHaveErrors } from './draftTypes';

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

  it('parses bán cho khách + SL + SP + giá đơn vị', () => {
    const d = parseTextToDraft('bán cho Hoa 3 kẹp tóc giá 15k');
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('revenue');
    expect(d!.customerName?.toLowerCase()).toBe('hoa');
    expect(d!.quantity).toBe(3);
    expect(d!.unitPrice).toBe(15000);
    expect(d!.amount).toBe(45000);
    expect(d!.description.toLowerCase()).toContain('kẹp tóc');
    expect(d!.description).not.toMatch(/^cho\b/i);
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
