import { describe, expect, it } from 'vitest';
import { parseMoney, extractMoneyFromText } from './amountParser';
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
    expect(drafts[0]!.category).toBe('supplies');
  });

  it('maps revenue order with customer and line items', () => {
    const drafts = normalizeBulkExtract({
      kind: 'revenue',
      items: [
        {
          description: 'Đơn Hoa',
          amount: 110000,
          customerName: 'Hoa',
          platformName: 'TikTok',
          orderItems: [
            { name: 'Kẹp tóc', quantity: 2, unitPrice: 30000 },
            { name: 'Bó hoa', quantity: 1, unitPrice: 50000 },
          ],
        },
      ],
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.kind).toBe('revenue');
    expect(drafts[0]!.customerName).toBe('Hoa');
    expect(drafts[0]!.orderItems).toHaveLength(2);
    expect(drafts[0]!.amount).toBe(110000);
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
