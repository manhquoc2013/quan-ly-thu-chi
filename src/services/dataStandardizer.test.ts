import { describe, it, expect } from 'vitest';
import {
  normalizeVietnameseTitleCase,
  normalizeVietnameseSentenceCase,
  normalizePhoneNumber,
  normalizeAddressHeuristic,
  heuristicStandardize,
  STANDARD_UNITS,
  type StandardizationCandidate,
  type StandardizableEntity,
} from './dataStandardizer';

describe('dataStandardizer helpers', () => {
  it('normalizes Vietnamese Title Case properly', () => {
    expect(normalizeVietnameseTitleCase('nguyen van a')).toBe('Nguyen Van A');
    expect(normalizeVietnameseTitleCase('NGUYEN THI MAI')).toBe('Nguyen Thi Mai');
    expect(normalizeVietnameseTitleCase('   áo   thun   nam   ')).toBe('Áo Thun Nam');
  });

  it('normalizes sentence case for descriptions', () => {
    expect(normalizeVietnameseSentenceCase('tien ca phe sang')).toBe('Tien ca phe sang');
    expect(normalizeVietnameseSentenceCase('   mua giay in nhiet')).toBe('Mua giay in nhiet');
  });

  it('normalizes phone numbers to standard 10-digit 0xxxxxxxxx', () => {
    expect(normalizePhoneNumber('+84912345678')).toBe('0912345678');
    expect(normalizePhoneNumber('0912.345.678')).toBe('0912345678');
    expect(normalizePhoneNumber('0912 345 678')).toBe('0912345678');
    expect(normalizePhoneNumber('912345678')).toBe('0912345678');
  });

  it('expands administrative abbreviations in addresses', () => {
    const raw = '123 nguyen trai p 2 q 5 tphcm';
    const normalized = normalizeAddressHeuristic(raw);
    expect(normalized).toContain('Phường 2');
    expect(normalized).toContain('Quận 5');
    expect(normalized).toContain('TP. Hồ Chí Minh');
  });

  it('maps non-standard product units to standard form', () => {
    expect(STANDARD_UNITS['cai']).toBe('cái');
    expect(STANDARD_UNITS['chiec']).toBe('chiếc');
    expect(STANDARD_UNITS['ky']).toBe('kg');
    expect(STANDARD_UNITS['kilo']).toBe('kg');
    expect(STANDARD_UNITS['hop']).toBe('hộp');
  });

  it('performs heuristic standardization on expense candidate', () => {
    const candidate: StandardizationCandidate = {
      id: 'exp-1',
      entityType: 'expense',
      title: 'Chi phí: tien cafe sang',
      issues: ['Mô tả viết hoàn toàn chữ thường'],
      original: {
        id: 'exp-1',
        description: 'tien cafe sang',
        category: 'other',
        amount: 35000,
      } as unknown as StandardizableEntity,
      status: 'pending',
    };

    const res = heuristicStandardize(candidate);
    expect(res.changes.length).toBeGreaterThan(0);
    // Should classify into supplies
    expect(res.suggested.category).toBe('supplies');
    expect(res.suggested.description).toBe('Tien cafe sang');
  });

  it('performs heuristic standardization on customer candidate', () => {
    const candidate: StandardizationCandidate = {
      id: 'cust-1',
      entityType: 'customer',
      title: 'Khách hàng',
      issues: ['Chưa chuẩn'],
      original: {
        id: 'cust-1',
        name: 'nguyen van tuan',
        phone: '+84988123456',
        address: '12 le loi p 1 q 1 hcm',
      } as unknown as StandardizableEntity,
      status: 'pending',
    };

    const res = heuristicStandardize(candidate);
    expect(res.suggested.name).toBe('Nguyen Van Tuan');
    expect(res.suggested.phone).toBe('0988123456');
    expect(res.suggested.address).toContain('TP. Hồ Chí Minh');
  });

  it('performs heuristic standardization on product unit', () => {
    const candidate: StandardizationCandidate = {
      id: 'prod-1',
      entityType: 'product',
      title: 'Sản phẩm',
      issues: ['Đơn vị chưa chuẩn'],
      original: {
        id: 'prod-1',
        name: 'banh quy bo',
        unit: 'Hop',
      } as unknown as StandardizableEntity,
      status: 'pending',
    };

    const res = heuristicStandardize(candidate);
    expect(res.suggested.name).toBe('Banh Quy Bo');
    expect(res.suggested.unit).toBe('hộp');
  });
});
