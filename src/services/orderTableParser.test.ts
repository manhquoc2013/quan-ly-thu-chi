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
  it('splits unpriced qty lines into separate products and shares total', () => {
    const { items, shippingFee } = parseOrderContentItems('1 Sứa\n1 ong hề', 125_000);
    expect(items).toHaveLength(2);
    expect(items[0]!.name.toLowerCase()).toContain('sứa');
    expect(items[1]!.name.toLowerCase()).toContain('ong');
    expect(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)).toBe(125_000);
    expect(shippingFee).toBe(0);
  });

  it('splits comma-separated qty items without breaking “1, chó”', () => {
    const { items } = parseOrderContentItems(
      '1 thỏ, 1 vịt, 1 thỏ nhỏ\n1, chó -> OK',
      200_000,
    );
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.some((it) => /thỏ$/i.test(it.name) || /^thỏ$/i.test(it.name))).toBe(true);
    expect(items.some((it) => /chó/i.test(it.name))).toBe(true);
    expect(items.every((it) => it.name !== '1')).toBe(true);
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

  it('keeps priced + unpriced lines separate (Thương-style)', () => {
    const content = `1 kẹp hoa xanh dương=15
1 chữ H size lớn=45
1 con cánh cụt,1 sư tử nhỏ=35
Ship=11`;
    const { items, shippingFee } = parseOrderContentItems(content, 139_000);
    expect(shippingFee).toBe(11_000);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.some((it) => /cánh cụt/i.test(it.name))).toBe(true);
    expect(items.some((it) => /sư tử/i.test(it.name))).toBe(true);
  });
});

describe('parseOrderTableDrafts', () => {
  it('detects table and creates revenue drafts', () => {
    expect(looksLikeOrderTable(SAMPLE)).toBe(true);
    const { isTable, drafts } = parseOrderTableDrafts(SAMPLE);
    expect(isTable).toBe(true);
    const tin = drafts.find((d) => /tin tin/i.test(d.customerName ?? ''));
    expect(tin).toBeTruthy();
    expect(tin!.paymentStatus).toBe('unpaid');
    expect(tin!.amount).toBe(0);
    expect(tin!.notes).toMatch(/0đ|chưa có số tiền/i);
    expect(tin!.orderItems?.some((it) => /luffy/i.test(it.name))).toBe(true);
    expect(drafts.length).toBeGreaterThanOrEqual(8);

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
    const { isTable, drafts } = parseOrderTableDrafts(withLead);
    expect(isTable).toBe(true);
    expect(drafts.length).toBeGreaterThanOrEqual(7);
    expect(drafts.some((d) => /tin tin/i.test(d.customerName ?? ''))).toBe(true);
    expect(parseTextToDrafts(withLead).every((d) => d.kind === 'revenue')).toBe(true);
  });

  it('maps STT column so amount/customer stay aligned', () => {
    const withStt = `STT	Tên khách	Nền tảng	Nội dung	 Số tiền	Trạng thái đơn	NOTE
1	Mầm non cá zoi	Tiktok	"1 Sứa
1 ong hề"	125.000 ₫	Đã xong	
2	Annyeong	Tiktok	"1 bơ
1 nấm mini"	70.000 ₫		
4	Tin tin		"1 luffy
1 zoro"			
5	Ng lan	Zalo	"1. bó hoa -> đã móc
1 bảng chữ L -> OK"	685.000 ₫		đã trả tiền
	Chi chi	Zalo	1 thỏ hướng dương	150.000 ₫		`;
    expect(looksLikeOrderTable(withStt)).toBe(true);
    const { drafts } = parseOrderTableDrafts(withStt);
    expect(drafts.find((d) => d.customerName?.includes('Mầm'))?.amount).toBe(125_000);
    expect(drafts.find((d) => /annyeong/i.test(d.customerName ?? ''))?.amount).toBe(70_000);
    expect(drafts.find((d) => /lan/i.test(d.customerName ?? ''))?.paymentStatus).toBe('paid');
    expect(drafts.find((d) => /chi chi/i.test(d.customerName ?? ''))?.amount).toBe(150_000);
    const tin = drafts.find((d) => /tin tin/i.test(d.customerName ?? ''));
    expect(tin?.paymentStatus).toBe('unpaid');
    expect(tin?.orderItems?.map((it) => it.name.toLowerCase()).join(' ')).toMatch(/luffy/);
    expect(drafts.every((d) => d.customerName !== '1' && d.customerName !== '2')).toBe(true);
  });
});
