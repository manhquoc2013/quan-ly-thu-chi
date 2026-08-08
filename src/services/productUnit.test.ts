import { describe, expect, it } from 'vitest';
import {
  guessProductUnit,
  cleanProductSearchHint,
  isAnimalProductName,
  parseProductUnitUpdateMessage,
} from './productService';

describe('guessProductUnit', () => {
  it('uses con for animal / plush names', () => {
    expect(guessProductUnit('Thú mini')).toBe('con');
    expect(guessProductUnit('Vịt đội mũ')).toBe('con');
    expect(guessProductUnit('Hello Kitty')).toBe('con');
    expect(guessProductUnit('Luffy')).toBe('con');
    expect(guessProductUnit('Chim cánh cụt')).toBe('con');
  });

  it('defaults to cái for non-animals', () => {
    expect(guessProductUnit('Móc khóa nón cối')).toBe('cái');
    expect(guessProductUnit('Giỏ trái cây')).toBe('cái');
  });
});

describe('parseProductUnitUpdateMessage', () => {
  it('parses bulk thú → con', () => {
    const p = parseProductUnitUpdateMessage('sửa lại đơn vị của các sản phẩm thú là con');
    expect(p).not.toBeNull();
    expect(p!.unit).toBe('con');
    expect(p!.targetHint.toLowerCase()).toContain('thú');
    expect(p!.categoryBulk).toBe(true);
  });

  it('parses single product unit change', () => {
    const p = parseProductUnitUpdateMessage('đổi đơn vị Hello Kitty thành con');
    expect(p!.unit).toBe('con');
    expect(cleanProductSearchHint(p!.targetHint).toLowerCase()).toContain('hello');
  });
});

describe('isAnimalProductName', () => {
  it('detects thú family', () => {
    expect(isAnimalProductName('Thỏ ôm hoa tulip')).toBe(true);
    expect(isAnimalProductName('Móc khóa chữ cái')).toBe(false);
  });
});
