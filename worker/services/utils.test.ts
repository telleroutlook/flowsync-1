import { describe, it, expect } from 'vitest';
import { clampNumber, safeJsonParse, toSqlBoolean } from './utils';

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

  it('maps sql boolean correctly', () => {
    expect(toSqlBoolean(true)).toBe(1);
    expect(toSqlBoolean(false)).toBe(0);
    expect(toSqlBoolean(undefined)).toBe(0);
  });
});
