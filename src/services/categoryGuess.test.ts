import { describe, expect, it } from 'vitest';
import { guessCategory } from './categoryGuess';

describe('guessCategory', () => {
  it('maps common expense phrases', () => {
    expect(guessCategory('cà phê sáng')).toBe('office');
    expect(guessCategory('nhập len SS5')).toBe('supplies');
    expect(guessCategory('đổ xăng')).toBe('transportation');
    expect(guessCategory('tiền thuê mặt bằng')).toBe('rent');
    expect(guessCategory('phí ads facebook')).toBe('marketing');
  });

  it('falls back to other', () => {
    expect(guessCategory('khoản lạ xyz')).toBe('other');
  });
});
