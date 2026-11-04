import { createContext } from 'react';
import { isHls } from './media.js';

/** { queue, thumbDone(id) } from the grid; null outside it. */
export const QueueContext = createContext(null);

/** Loads one job into the browser cache. Photos: the full-size file, decoded. Videos: their first bytes only (metadata). */
export function loadJob(job, priority) {
  return job.kind === 'image' ? loadImage(job.url, priority) : warmVideo(job.url);
}

export function loadImage(url, priority = 'low') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    try { img.fetchPriority = priority; } catch { /* hint only */ }
    img.decoding = 'async';
    img.onload = () => { (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(resolve); };
    img.onerror = () => reject(new Error('image'));
    img.src = url;
  });
}

function warmVideo(url) {
  if (isHls(url)) {
    // The playlist only; the player fetches segments when asked to play.
    return fetch(url, { mode: 'no-cors', cache: 'force-cache' }).then(() => undefined, () => undefined);
  }
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const done = () => { v.onloadedmetadata = null; v.onerror = null; v.removeAttribute('src'); resolve(); };
    v.onloadedmetadata = done;
    v.onerror = done; // best effort: a video that cannot be warmed is still playable on demand
    v.src = url;
  });
}
