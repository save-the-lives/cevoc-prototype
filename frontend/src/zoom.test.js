import { describe, expect, it } from 'vitest';
import {
  IDENTITY, MAX_SCALE, clampView, maxOffset, panBy, pinchStep, stepScale, wheelFactor, zoomAt,
} from './zoom.js';

const W = 400, H = 300;

describe('clampView', () => {
  it('forces offset to zero at 1x', () => {
    expect(clampView({ scale: 1, x: 50, y: -20 }, W, H)).toEqual(IDENTITY);
  });
  it('limits scale to [1, MAX]', () => {
    expect(clampView({ scale: 0.2, x: 0, y: 0 }, W, H).scale).toBe(1);
    expect(clampView({ scale: 99, x: 0, y: 0 }, W, H).scale).toBe(MAX_SCALE);
  });
  it('limits pan so content covers the viewport', () => {
    const v = clampView({ scale: 2, x: 9999, y: -9999 }, W, H);
    expect(v.x).toBe(maxOffset(2, W)); // 200
    expect(v.y).toBe(-maxOffset(2, H)); // -150
  });
});

describe('zoomAt', () => {
  it('keeps the focal point fixed on screen', () => {
    const fx = 100, fy = -50;
    const v = zoomAt(IDENTITY, 2, fx, fy, W, H);
    // content point under focal before: (fx, fy) at scale 1; after: x + 2 * fx must equal fx
    expect(v.x + 2 * fx).toBeCloseTo(fx);
    expect(v.y + 2 * fy).toBeCloseTo(fy);
  });
  it('zooming at the centre does not move the content', () => {
    expect(zoomAt(IDENTITY, 3, 0, 0, W, H)).toEqual({ scale: 3, x: 0, y: 0 });
  });
  it('returns to identity when zoomed back out to 1x', () => {
    const z = zoomAt(IDENTITY, 3, 120, 80, W, H);
    expect(zoomAt(z, 1, 120, 80, W, H)).toEqual(IDENTITY);
  });
  it('clamps at the maximum', () => {
    expect(zoomAt(IDENTITY, 50, 0, 0, W, H).scale).toBe(MAX_SCALE);
  });
});

describe('panBy', () => {
  it('cannot pan at 1x', () => {
    expect(panBy(IDENTITY, 30, 30, W, H)).toEqual(IDENTITY);
  });
  it('pans and clamps when zoomed', () => {
    const v = panBy({ scale: 2, x: 0, y: 0 }, 1000, -10, W, H);
    expect(v).toEqual({ scale: 2, x: 200, y: -10 });
  });
});

describe('stepScale', () => {
  it('steps up and down by 1.5x', () => {
    expect(stepScale(1, 1)).toBe(1.5);
    expect(stepScale(3, -1)).toBe(2);
  });
  it('snaps to 1 and respects the max', () => {
    expect(stepScale(1.2, -1)).toBe(1);
    expect(stepScale(MAX_SCALE, 1)).toBe(MAX_SCALE);
  });
});

describe('wheelFactor', () => {
  it('zooms in for negative deltaY and out for positive', () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
  });
  it('treats ctrlKey (trackpad pinch) with a larger per-pixel gain', () => {
    expect(Math.abs(Math.log(wheelFactor(-5, 0, true)))).toBeGreaterThan(Math.abs(Math.log(wheelFactor(-5, 0, false))));
  });
  it('caps huge deltas', () => {
    expect(wheelFactor(-100000)).toBe(wheelFactor(-120));
  });
});

describe('pinchStep', () => {
  const pair = (ax, ay, bx, by) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } });
  it('doubles scale when finger distance doubles about the centre', () => {
    const v = pinchStep(IDENTITY, pair(-50, 0, 50, 0), pair(-100, 0, 100, 0), W, H);
    expect(v.scale).toBeCloseTo(2);
    expect(v.x).toBeCloseTo(0);
  });
  it('pans when the midpoint moves at constant distance', () => {
    const start = { scale: 2, x: 0, y: 0 };
    const v = pinchStep(start, pair(-50, 0, 50, 0), pair(-30, 0, 70, 0), W, H);
    expect(v.scale).toBeCloseTo(2);
    expect(v.x).toBeCloseTo(20);
  });
  it('ignores degenerate (zero distance) starts', () => {
    expect(pinchStep(IDENTITY, pair(0, 0, 0, 0), pair(-10, 0, 10, 0), W, H)).toBe(IDENTITY);
  });
});
