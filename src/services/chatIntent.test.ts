import { describe, expect, it } from 'vitest';
import {
  normalizeIntent,
  fillMissingSlots,
  mergeClarifyReply,
  mergeIntent,
  intentToDraft,
  draftToCreateIntent,
  isCancelMessage,
  isConfirmMessage,
} from './chatIntent';
import type { DraftRecord } from './draftTypes';

describe('normalizeIntent', () => {
  it('parses create_revenue with unit price', () => {
    const i = normalizeIntent({
      intent: 'create_revenue',
      customerName: 'Hoa',
      description: 'kẹp tóc',
      quantity: 3,
      unitPrice: 15000,
      confidence: 0.9,
      missing: [],
    });
    expect(i).not.toBeNull();
    expect(i!.amount).toBe(45000);
    expect(i!.missing).toEqual([]);
  });

  it('keeps platformName on create_revenue', () => {
    const i = normalizeIntent({
      intent: 'create_revenue',
      customerName: 'Dung',
      description: 'kẹp tóc',
      quantity: 3,
      unitPrice: 60000,
      platformName: 'Zalo',
      confidence: 0.9,
      missing: [],
    });
    expect(i!.platformName).toBe('Zalo');
    expect(i!.amount).toBe(180000);
  });

  it('flags missing amount', () => {
    const i = fillMissingSlots({
      intent: 'create_expense',
      description: 'cà phê',
      confidence: 0.8,
      missing: [],
    });
    expect(i.missing).toContain('amount');
  });
});

describe('mergeClarifyReply', () => {
  it('fills amount from 25k', () => {
    const base = fillMissingSlots({
      intent: 'create_expense',
      description: 'cà phê',
      confidence: 0.7,
      missing: [],
    });
    const merged = mergeClarifyReply(base, '25k');
    expect(merged.amount).toBe(25000);
    expect(merged.missing).toEqual([]);
  });

  it('accepts 0đ for create_revenue clarify', () => {
    const base = fillMissingSlots({
      intent: 'create_revenue',
      description: 'luffy',
      customerName: 'Tin tin',
      confidence: 0.8,
      missing: [],
    });
    expect(base.missing).toContain('amount');
    const merged = mergeClarifyReply(base, '0đ');
    expect(merged.amount).toBe(0);
    expect(merged.missing).toEqual([]);
    const phrase = mergeClarifyReply(base, 'không cần số tiền, tạo với giá 0đ');
    expect(phrase.amount).toBe(0);
    expect(phrase.missing).toEqual([]);
  });

  it('flips mis-labeled create_expense to revenue when user says 0đ', () => {
    const base = fillMissingSlots({
      intent: 'create_expense',
      description: 'Đơn Tin tin',
      confidence: 0.7,
      missing: [],
    });
    expect(base.missing).toContain('amount');
    const patch = mergeClarifyReply(base, '0đ');
    const merged = mergeIntent(base, patch);
    expect(merged.intent).toBe('create_revenue');
    expect(merged.amount).toBe(0);
    expect(merged.missing).toEqual([]);
  });

  it('fills customer name', () => {
    const base = fillMissingSlots({
      intent: 'create_revenue',
      description: 'kẹp tóc',
      amount: 15000,
      confidence: 0.7,
      missing: ['customerName'],
    });
    // force missing
    base.missing = ['customerName'];
    const merged = mergeClarifyReply(base, 'Hoa');
    expect(merged.customerName?.toLowerCase()).toBe('hoa');
  });
});

describe('intentToDraft', () => {
  it('builds revenue draft with qty', () => {
    const d = intentToDraft({
      intent: 'create_revenue',
      description: 'kẹp tóc',
      quantity: 3,
      unitPrice: 15000,
      amount: 45000,
      customerName: 'Hoa',
      confidence: 0.9,
      missing: [],
    });
    expect(d?.kind).toBe('revenue');
    expect(d?.amount).toBe(45000);
    expect(d?.quantity).toBe(3);
    expect(d?.customerName).toBe('Hoa');
  });
});

describe('draftToCreateIntent', () => {
  it('preserves platformName for revenue', () => {
    const draft: DraftRecord = {
      id: 'd1',
      kind: 'revenue',
      date: '2026-08-01',
      amount: 180000,
      unitPrice: 60000,
      quantity: 3,
      description: '3 × Kẹp tóc',
      customerName: 'Dung',
      platformName: 'Zalo',
      source: 'text',
    };
    const intent = draftToCreateIntent(draft);
    expect(intent.intent).toBe('create_revenue');
    expect(intent.platformName).toBe('Zalo');
    const roundTrip = intentToDraft(intent);
    expect(roundTrip?.platformName).toBe('Zalo');
    expect(roundTrip?.quantity).toBe(3);
  });

  it('maps product draft to create_product', () => {
    const draft: DraftRecord = {
      id: 'd2',
      kind: 'product',
      date: '2026-08-08',
      amount: 50000,
      description: 'Hello Kitty',
      source: 'text',
    };
    const intent = draftToCreateIntent(draft);
    expect(intent.intent).toBe('create_product');
    expect(intent.amount).toBe(50000);
    expect(intent.missing).toEqual([]);
  });

  it('normalizes create_product and create_customer', () => {
    const p = normalizeIntent({
      intent: 'create_product',
      description: 'Luffy',
      unitPrice: 120000,
      confidence: 0.9,
      missing: [],
    });
    expect(p!.missing).toEqual([]);
    expect(p!.amount).toBe(120000);

    const c = normalizeIntent({
      intent: 'create_customer',
      customerName: 'Hoa',
      confidence: 0.9,
      missing: [],
    });
    expect(c!.missing).toEqual([]);
  });
});

describe('confirm/cancel', () => {
  it('detects confirm and cancel', () => {
    expect(isConfirmMessage('xác nhận')).toBe(true);
    expect(isCancelMessage('hủy')).toBe(true);
    expect(isConfirmMessage('hello')).toBe(false);
  });
});
