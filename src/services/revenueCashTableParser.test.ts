import { describe, expect, it } from 'vitest';
import {
  looksLikeRevenueCashTable,
  parseDayMonthDate,
  parseRevenueCashTableDrafts,
} from './revenueCashTableParser';
import { parseTextToDrafts } from './textDraftParser';
import { looksLikeStockInTable } from './stockInTableParser';

const SAMPLE = `doanh thu hiện tại đã thu được:
Nội dung	 Số tiền	Date
Tổng đến hiện tại	3.570.000 ₫	31/07
Mầm non cá zoi	125.000 ₫	31/07
NHư	110.000 ₫	06/08
Kiều an 	27.000 ₫	06/08
Muội Muội	245.000 ₫	06/08`;

describe('parseDayMonthDate', () => {
  it('parses DD/MM with current year', () => {
    expect(parseDayMonthDate('31/07', new Date('2026-08-09'))).toBe('2026-07-31');
    expect(parseDayMonthDate('06/08', new Date('2026-08-09'))).toBe('2026-08-06');
  });
});

describe('parseRevenueCashTableDrafts', () => {
  it('parses đã thu table as paid revenue and skips tổng row when details exist', () => {
    expect(looksLikeRevenueCashTable(SAMPLE)).toBe(true);
    expect(looksLikeStockInTable(SAMPLE)).toBe(false);

    const { isTable, drafts, skipped } = parseRevenueCashTableDrafts(SAMPLE);
    expect(isTable).toBe(true);
    expect(drafts).toHaveLength(4);
    expect(drafts.every((d) => d.kind === 'revenue')).toBe(true);
    expect(drafts.every((d) => d.paymentStatus === 'paid')).toBe(true);
    expect(drafts.reduce((s, d) => s + d.amount, 0)).toBe(125_000 + 110_000 + 27_000 + 245_000);
    expect(drafts.some((d) => /tổng/i.test(d.description))).toBe(false);
    expect(skipped.some((s) => /tổng/i.test(s))).toBe(true);

    expect(drafts[0]!.customerName?.toLowerCase()).toContain('mầm');
    expect(drafts[0]!.date).toBe('2026-07-31');
    expect(drafts[1]!.date).toBe('2026-08-06');

    const via = parseTextToDrafts(SAMPLE);
    expect(via).toHaveLength(4);
    expect(via.every((d) => d.paymentStatus === 'paid')).toBe(true);
  });

  it('keeps tổng as opening-balance revenue when no line items', () => {
    const msg = `doanh thu đến hiện tại, đơn gốc không có hàng
Tổng đến hiện tại	3.570.000 ₫	31/07`;
    expect(looksLikeRevenueCashTable(msg)).toBe(true);
    const { drafts, skipped } = parseRevenueCashTableDrafts(msg);
    expect(drafts).toHaveLength(1);
    expect(skipped).toEqual([]);
    expect(drafts[0]!.kind).toBe('revenue');
    expect(drafts[0]!.amount).toBe(3_570_000);
    expect(drafts[0]!.paymentStatus).toBe('paid');
    expect(drafts[0]!.description.toLowerCase()).toContain('doanh thu đến hiện tại');
    expect(drafts[0]!.date).toBe('2026-07-31');
    expect(drafts[0]!.customerName).toBeUndefined();

    const via = parseTextToDrafts(msg);
    expect(via).toHaveLength(1);
    expect(via[0]!.amount).toBe(3_570_000);
  });

  it('parses amount cell with “ghi nhận vào DD/MM”', () => {
    const msg = `Tổng đến hiện tại	3.570.000 ₫, ghi nhận vào 31/07`;
    expect(looksLikeRevenueCashTable(msg)).toBe(true);
    const { drafts } = parseRevenueCashTableDrafts(msg);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.amount).toBe(3_570_000);
    expect(drafts[0]!.date).toBe('2026-07-31');
    expect(drafts[0]!.paymentStatus).toBe('paid');
    expect(drafts[0]!.description.toLowerCase()).toContain('doanh thu đến hiện tại');

    const via = parseTextToDrafts(msg);
    expect(via).toHaveLength(1);
    expect(via[0]!.date).toBe('2026-07-31');
  });
});
