import { describe, it, expect } from 'vitest';

import { clampIndex, resolveFallbackIndex } from '../client/src/utils/heroSlider';

describe('heroSlider utils', () => {
  it('clampIndex wraps forward and backward', () => {
    expect(clampIndex(0, 5)).toBe(0);
    expect(clampIndex(4, 5)).toBe(4);
    expect(clampIndex(5, 5)).toBe(0);
    expect(clampIndex(6, 5)).toBe(1);
    expect(clampIndex(-1, 5)).toBe(4);
    expect(clampIndex(-6, 5)).toBe(4);
  });

  it('resolveFallbackIndex cycles through fallback set', () => {
    expect(resolveFallbackIndex(0, 0, 5)).toBe(0);
    expect(resolveFallbackIndex(0, 1, 5)).toBe(1);
    expect(resolveFallbackIndex(4, 1, 5)).toBe(0);
    expect(resolveFallbackIndex(2, 7, 5)).toBe(4);
  });
});
