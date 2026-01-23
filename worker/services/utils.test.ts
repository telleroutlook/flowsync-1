import { describe, it, expect } from 'vitest';
import { clampNumber, safeJsonParse } from './utils';

describe('utils', () => {
  it('clamps numeric ranges', () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(-1, 0, 10)).toBe(0);
    expect(clampNumber(11, 0, 10)).toBe(10);
  });

  it('returns fallback on invalid JSON', () => {
    expect(safeJsonParse('{bad}', [])).toEqual([]);
    expect(safeJsonParse(null, 'fallback')).toBe('fallback');
  });
});
