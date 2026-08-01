import { describe, expect, it } from 'vitest';
import {
  looksLikeOrderTable,
  parseOrderContentItems,
  parseOrderTableDrafts,
  parseTsvRows,
} from './orderTableParser';
import { parseTextToDrafts } from './textDraftParser';

const SAMPLE = `Tên khách	Nền tảng	Nội dung	 Số tiền	Trạng thái đơn	NOTE
Mầm non cá zoi	Tiktok	"1 Sứa
1 ong hề"	125.000 ₫	Đã xong	
Annyeong	Tiktok	"1 bơ
1 nấm mini"	70.000 ₫		
Thương	Tiktok	"1 kẹp hoa xanh dương=15
1 chữ H size lớn có chân tay xanh dương= 45
1 chữ h size nhỏ=12
1 con cánh cụt,1 sư tử  nhỏ=35
1 nơ xanh dương nhỏ=10
1 ngôi sao xanh dương=22
Ship=11"	139.000 ₫		
Tin tin		"1 luffy
1 zoro
2 con (gửi trong zalo)"			
Ng lan	Zalo	"1. bó hoa -> đã móc
1 bảng chữ L -> OK"	525.000 ₫		đã trả tiền
Kaylin	Zalo	1 thỏ, 1 vịt	120.000 ₫		
Chi chi	Zalo	1 thỏ hướng dương	150.000 ₫		
Llinh	Tiktok	 1 thỏ	70.000 ₫		móc thử khách xem
NHư	Zalo	"1 bó hoa
4 kẹp tóc"	110.000 ₫	Đã xong	`;

describe('parseTsvRows', () => {
  it('keeps quoted multiline cells', () => {
    const rows = parseTsvRows(SAMPLE);
    expect(rows.length).toBeGreaterThan(5);
    const mam = rows.find((r) => r[0]?.includes('Mầm non'));
    expect(mam?.[2]).toMatch(/Sứa/);
    expect(mam?.[2]).toMatch(/ong hề/);
    expect(mam?.[3]).toMatch(/125/);
  });
});

describe('parseOrderContentItems', () => {
  it('parses qty lines without unit prices into one summary line', () => {
    const { items, shippingFee } = parseOrderContentItems('1 Sứa\n1 ong hề', 125_000);
    expect(items).toHaveLength(1);
    expect(items[0]!.unitPrice).toBe(125_000);
    expect(items[0]!.name.toLowerCase()).toContain('sứa');
    expect(shippingFee).toBe(0);
  });

  it('extracts Ship= as shippingFee (customer), not a product line', () => {
    const { items, shippingFee } = parseOrderContentItems(
      '1 kẹp=15\n1 nơ=10\nShip=11',
      36_000,
    );
    expect(shippingFee).toBe(11_000);
    expect(items.every((it) => !/^ship$/i.test(it.name))).toBe(true);
    const goods = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    expect(goods).toBe(25_000);
  });
});

describe('parseOrderTableDrafts', () => {
  it('detects table and creates revenue drafts', () => {
    expect(looksLikeOrderTable(SAMPLE)).toBe(true);
    const { isTable, drafts, skipped } = parseOrderTableDrafts(SAMPLE);
    expect(isTable).toBe(true);
    expect(skipped.some((s) => /Tin tin/i.test(s))).toBe(true);
    expect(drafts.length).toBeGreaterThanOrEqual(7);

    const mam = drafts.find((d) => d.customerName?.includes('Mầm'));
    expect(mam?.kind).toBe('revenue');
    expect(mam?.amount).toBe(125_000);
    expect(mam?.platformName).toBe('TikTok');
    expect(mam?.orderStatus).toBe('completed');

    const lan = drafts.find((d) => /lan/i.test(d.customerName ?? ''));
    expect(lan?.paymentStatus).toBe('paid');
    expect(lan?.platformName).toBe('Zalo');
    expect(lan?.amount).toBe(525_000);

    const kaylin = drafts.find((d) => /kaylin/i.test(d.customerName ?? ''));
    expect(kaylin?.amount).toBe(120_000);
  });

  it('is preferred over expense line-list in parseTextToDrafts', () => {
    const drafts = parseTextToDrafts(SAMPLE);
    expect(drafts.every((d) => d.kind === 'revenue')).toBe(true);
    expect(drafts.some((d) => d.customerName?.includes('Kaylin'))).toBe(true);
  });

  it('ignores Vietnamese preamble before the TSV header', () => {
    const withLead = `bạn giúp tôi tạo các đơn hàng:\n${SAMPLE}`;
    expect(looksLikeOrderTable(withLead)).toBe(true);
    const { isTable, drafts, skipped } = parseOrderTableDrafts(withLead);
    expect(isTable).toBe(true);
    expect(drafts.length).toBeGreaterThanOrEqual(7);
    expect(skipped.some((s) => /Tin tin/i.test(s))).toBe(true);
    expect(parseTextToDrafts(withLead).every((d) => d.kind === 'revenue')).toBe(true);
  });
});
