import { useSyncExternalStore } from 'react';

/**
 * The one place that decides "phone": the primary pointer is coarse (a finger) OR the window is narrow (600px or less).
 * Phones get a double tap and an expand button on each photo instead of a "Zoom in" button; everyone else keeps "Zoom in".
 */
export const PHONE_QUERY = '(pointer: coarse), (max-width: 600px)';

const mql = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(PHONE_QUERY) : null);
const subscribe = (cb) => { const m = mql(); m?.addEventListener?.('change', cb); return () => m?.removeEventListener?.('change', cb); };
export const usePhone = () => useSyncExternalStore(subscribe, () => !!mql()?.matches, () => false);

/** Returns a function to call on every tap: true when this tap completes a double tap (same spot, within `ms`). */
export function makeDoubleTap(ms = 350, slop = 30) {
  let last = null;
  return (x, y, t) => {
    const dbl = !!last && t - last.t <= ms && Math.hypot(x - last.x, y - last.y) <= slop;
    last = dbl ? null : { x, y, t };
    return dbl;
  };
}
