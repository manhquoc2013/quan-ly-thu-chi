import { describe, expect, it } from 'vitest';
import { resolveNavigateTarget } from './appNavigation';

describe('resolveNavigateTarget', () => {
  it('resolves mở chi phí / cài đặt / tổng quan', () => {
    expect(resolveNavigateTarget({ query: 'chi phí' })?.path).toBe('/expense');
    expect(resolveNavigateTarget({ query: 'cài đặt' })?.path).toBe('/settings');
    expect(resolveNavigateTarget({ query: 'tổng quan' })?.path).toBe('/');
    expect(resolveNavigateTarget({ route: '/products' })?.path).toBe('/products');
  });
});
