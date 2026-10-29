export const isHls = (url) => /\.m3u8(\?|#|$)/i.test(url || '');

/** Link for "Download original". HLS playlists are not downloadable, so they need an explicit downloadUrl. */
export function downloadHref(item) {
  if (item.downloadUrl) return item.downloadUrl;
  return isHls(item.url) ? null : item.url;
}

export function isSmallScreen() {
  return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 700px)').matches;
}

export function isPoorConnection() {
  const c = typeof navigator !== 'undefined' ? (navigator.connection || {}) : {};
  return !!c.saveData || ['slow-2g', '2g', '3g'].includes(c.effectiveType);
}

/**
 * Pick hls.js level policy. `levels` is hls.levels (with .height).
 * Returns { startLevel, capLevel } where capLevel is -1 for no cap.
 * Poor connection: cap at 480p. Small screen: start at 720p. Otherwise auto up to the best level (1080p).
 */
export function pickLevels(levels, { small, poor }) {
  const best = (maxH) => {
    let idx = -1;
    levels.forEach((l, i) => { if ((l.height || 0) <= maxH && (idx < 0 || (l.height || 0) > (levels[idx].height || 0))) idx = i; });
    return idx;
  };
  if (poor) { const i = best(480); return { startLevel: i, capLevel: i }; }
  if (small) return { startLevel: best(720), capLevel: -1 };
  return { startLevel: -1, capLevel: -1 };
}
