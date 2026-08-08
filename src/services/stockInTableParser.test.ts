import { describe, expect, it } from 'vitest';
import { looksLikeOrderTable, parseOrderTableDrafts } from './orderTableParser';
import {
  looksLikeSalesProductTable,
  looksLikeStockInTable,
  parseSalesProductTableDrafts,
  parseStockInTableDrafts,
} from './stockInTableParser';
import { parseTextToDrafts } from './textDraftParser';

const SAMPLE_NHAP = `nhập hàng:
STT	Tên mẫu	giá 1 con	Số lượng	Thành tiền
1	Nhập hello kitty 	30.000 ₫	5	180.000 ₫
2	Vịt đội mũ	30.000 ₫	5	180.000 ₫
3	Bắp ngô	20.000 ₫	6	120.000 ₫
4	Gấu panda	21.000 ₫	10	210.000 ₫
5	Chó 	21.000 ₫	38	840.000 ₫
6	Vịt nhung gấu	21.000 ₫	10	210.000 ₫`;

const SAMPLE_BAN = `đã bán được:
STT	Tên mẫu	giá 1 con	Số lượng	Thành tiền
1	Nhập hello kitty 	50.000 ₫	1	50.000 ₫
2	Vịt đội mũ	50.000 ₫	1	50.000 ₫
5	Chó 	32.000 ₫	2	64.000 ₫`;

describe('parseStockInTableDrafts', () => {
  it('parses nhập hàng spreadsheet as expense stock-in drafts', () => {
    expect(looksLikeStockInTable(SAMPLE_NHAP)).toBe(true);
    expect(looksLikeOrderTable(SAMPLE_NHAP)).toBe(false);

    const { isTable, drafts, skipped } = parseStockInTableDrafts(SAMPLE_NHAP);
    expect(isTable).toBe(true);
    expect(skipped).toEqual([]);
    expect(drafts).toHaveLength(6);
    expect(drafts.every((d) => d.kind === 'expense')).toBe(true);
    expect(drafts.every((d) => d.category === 'supplies')).toBe(true);

    expect(drafts[0]!.description.toLowerCase()).toContain('hello kitty');
    expect(drafts[0]!.quantity).toBe(5);
    expect(drafts[0]!.unitPrice).toBe(30_000);
    expect(drafts[0]!.amount).toBe(180_000);

    expect(drafts[4]!.description.toLowerCase()).toContain('chó');
    expect(drafts[4]!.quantity).toBe(38);
    expect(drafts[4]!.amount).toBe(840_000);

    const viaParse = parseTextToDrafts(SAMPLE_NHAP);
    expect(viaParse).toHaveLength(6);
    expect(viaParse.every((d) => d.kind === 'expense')).toBe(true);
    expect(parseOrderTableDrafts(SAMPLE_NHAP).drafts).toHaveLength(0);
  });
});

describe('parseSalesProductTableDrafts', () => {
  it('parses đã bán được spreadsheet as paid revenue drafts (not chi phí)', () => {
    expect(looksLikeSalesProductTable(SAMPLE_BAN)).toBe(true);
    expect(looksLikeStockInTable(SAMPLE_BAN)).toBe(false);
    expect(looksLikeOrderTable(SAMPLE_BAN)).toBe(false);

    const { isTable, drafts, skipped } = parseSalesProductTableDrafts(SAMPLE_BAN);
    expect(isTable).toBe(true);
    expect(skipped).toEqual([]);
    expect(drafts).toHaveLength(3);
    expect(drafts.every((d) => d.kind === 'revenue')).toBe(true);
    expect(drafts.every((d) => d.paymentStatus === 'paid')).toBe(true);
    expect(drafts.reduce((s, d) => s + d.amount, 0)).toBe(164_000);

    expect(drafts[2]!.quantity).toBe(2);
    expect(drafts[2]!.unitPrice).toBe(32_000);
    expect(drafts[2]!.description.toLowerCase()).toContain('chó');

    const viaParse = parseTextToDrafts(SAMPLE_BAN);
    expect(viaParse).toHaveLength(3);
    expect(viaParse.every((d) => d.kind === 'revenue')).toBe(true);
    expect(parseStockInTableDrafts(SAMPLE_BAN).drafts).toHaveLength(0);
  });
});
