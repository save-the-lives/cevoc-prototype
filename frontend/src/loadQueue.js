// Loading order for the evidence on the public page.
//   1. All thumbnails load first (the page renders them; the queue is told when they have settled).
//   2. Then the FIRST photo's full-size image loads by itself.
//   3. Every other full-size image and any video waits until the first one has loaded, then loads in page order, at most
//      `concurrency` at a time, so all of them end up in the browser cache and opening, zooming or downloading is instant.
//   4. When someone opens a photo, background loading pauses and that photo jumps the queue; the queue resumes after it.
//   5. With Save-Data on, nothing loads in the background: a photo loads only when it is opened.
// `load(job, priority)` is injected (a fake in tests); it resolves when the item is ready and rejects when it failed.

export const STATE = { IDLE: 'idle', QUEUED: 'queued', LOADING: 'loading', READY: 'ready', ERROR: 'error' };

export function createLoadQueue({ jobs, load, concurrency = 2, saveData = false }) {
  const state = new Map(jobs.map((j) => [j.id, STATE.IDLE]));
  const listeners = new Set();
  const promises = new Map();
  let started = false;
  let paused = 0; // photos opened by the person that are still loading
  let running = 0;

  const emit = () => listeners.forEach((fn) => fn());
  const set = (id, s) => { if (state.get(id) !== s) { state.set(id, s); emit(); } };
  const jobOf = (id) => jobs.find((j) => j.id === id);
  const firstPhoto = () => jobs.find((j) => j.kind === 'image');

  function run(job, priority) {
    set(job.id, STATE.LOADING);
    running += 1;
    const p = (async () => {
      try {
        await load(job, priority);
        set(job.id, STATE.READY);
      } catch {
        set(job.id, STATE.ERROR);
      } finally {
        running -= 1;
        promises.delete(job.id);
      }
    })();
    promises.set(job.id, p);
    return p;
  }

  // Background loading waits while a photo the person opened is still on its way.
  function hold(p) {
    paused += 1;
    return p.then(() => { paused -= 1; next(); });
  }

  // The first photo goes alone; the rest only once it has settled (loaded or failed).
  function next() {
    if (!started || saveData || paused > 0) return;
    const first = firstPhoto();
    if (first && state.get(first.id) === STATE.IDLE) {
      set(first.id, STATE.QUEUED);
      run(first, 'high').then(next);
      return;
    }
    if (first && [STATE.QUEUED, STATE.LOADING].includes(state.get(first.id))) return;
    for (const job of jobs) {
      if (running >= concurrency) return;
      if (state.get(job.id) === STATE.IDLE) {
        set(job.id, STATE.QUEUED);
        run(job, 'low').then(next);
      }
    }
  }

  return {
    state: (id) => state.get(id),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** All thumbnails have loaded (or failed): the first photo's full-size copy starts. */
    thumbnailsSettled() {
      if (started) return;
      started = true;
      next();
    },
    /** The person opened this photo: it loads now, ahead of the queue, which pauses until it is done. */
    prioritize(id) {
      const job = jobOf(id);
      if (!job) return Promise.resolve();
      if (promises.has(id)) return hold(promises.get(id));
      if (state.get(id) === STATE.READY) return Promise.resolve();
      return hold(run(job, 'high'));
    },
    /** Called again after an error, for one item. */
    retry(id) {
      const job = jobOf(id);
      if (!job || state.get(id) !== STATE.ERROR) return Promise.resolve();
      return hold(run(job, 'high'));
    },
    get saveData() { return saveData; },
  };
}

/** Jobs for a list of evidence items: photos need their full-size copy, videos their first bytes. Certificates need nothing. */
export function jobsFor(items) {
  return items.flatMap((e) => {
    if (e.kind === 'IMAGE') return [{ id: e.url, kind: 'image', url: e.url }];
    if (e.kind === 'VIDEO') return [{ id: e.url, kind: 'video', url: e.url }];
    return [];
  }).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'image' ? -1 : 1)); // photos first, videos after, page order kept within each
}

export function saveDataOn() {
  const c = typeof navigator !== 'undefined' ? (navigator.connection || {}) : {};
  return !!c.saveData;
}
