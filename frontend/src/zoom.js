// Pure zoom/pan math. The content is laid out to fill the viewport at 1x and is
// transformed with transform-origin: center, so view = { scale, x, y } where x/y
// are screen-pixel offsets of the content centre from the viewport centre.

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;
export const STEP = 1.5;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const clampScale = (s) => clamp(s, MIN_SCALE, MAX_SCALE);
export const IDENTITY = Object.freeze({ scale: 1, x: 0, y: 0 });

/** Largest allowed |offset| along one axis so the content always covers the viewport. */
export const maxOffset = (scale, size) => Math.max(0, ((scale - 1) * size) / 2);

export function clampView(view, w, h) {
  const scale = clampScale(view.scale);
  if (scale === 1) return { scale: 1, x: 0, y: 0 };
  const mx = maxOffset(scale, w);
  const my = maxOffset(scale, h);
  return { scale, x: clamp(view.x, -mx, mx), y: clamp(view.y, -my, my) };
}

/** Zoom to nextScale keeping the point (fx, fy), measured from the viewport centre, fixed on screen. */
export function zoomAt(view, nextScale, fx, fy, w, h) {
  const scale = clampScale(nextScale);
  const ratio = scale / view.scale;
  return clampView({ scale, x: fx - (fx - view.x) * ratio, y: fy - (fy - view.y) * ratio }, w, h);
}

export const panBy = (view, dx, dy, w, h) => clampView({ ...view, x: view.x + dx, y: view.y + dy }, w, h);

/** Next button/keyboard zoom level. dir is +1 or -1. Snaps to exactly 1 when close. */
export function stepScale(scale, dir) {
  const next = dir > 0 ? scale * STEP : scale / STEP;
  const c = clampScale(next);
  return c < 1.05 ? 1 : c;
}

/** Multiplicative zoom factor for a wheel event. Trackpad pinch (ctrlKey) is much finer-grained. */
export function wheelFactor(deltaY, deltaMode = 0, ctrlKey = false) {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 100 : deltaY;
  const k = ctrlKey ? 0.01 : 0.002;
  return Math.exp(-clamp(px, -120, 120) * k);
}

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * One pinch step. prev/cur are { a, b } pairs of points relative to the viewport centre.
 * Zooms about the previous midpoint, then follows the midpoint's movement (two-finger pan).
 */
export function pinchStep(view, prev, cur, w, h) {
  const d0 = distance(prev.a, prev.b);
  if (d0 < 1) return view;
  const m0 = midpoint(prev.a, prev.b);
  const m1 = midpoint(cur.a, cur.b);
  const zoomed = zoomAt(view, view.scale * (distance(cur.a, cur.b) / d0), m0.x, m0.y, w, h);
  return panBy(zoomed, m1.x - m0.x, m1.y - m0.y, w, h);
}
