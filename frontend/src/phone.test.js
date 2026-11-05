import { describe, expect, it } from 'vitest';
import { PHONE_QUERY, makeDoubleTap } from './phone.js';

describe('phone rule', () => {
  it('is defined once: coarse pointer or narrow window', () => {
    expect(PHONE_QUERY).toBe('(pointer: coarse), (max-width: 600px)');
  });
});

describe('makeDoubleTap', () => {
  it('needs two quick taps close together', () => {
    const tap = makeDoubleTap();
    expect(tap(10, 10, 1000)).toBe(false);
    expect(tap(14, 12, 1200)).toBe(true);
  });
  it('a third tap starts again', () => {
    const tap = makeDoubleTap();
    tap(10, 10, 0); tap(10, 10, 100);
    expect(tap(10, 10, 200)).toBe(false);
  });
  it('slow or distant taps do not count', () => {
    const tap = makeDoubleTap();
    tap(10, 10, 0);
    expect(tap(10, 10, 900)).toBe(false);
    expect(tap(200, 10, 1000)).toBe(false);
  });
});
