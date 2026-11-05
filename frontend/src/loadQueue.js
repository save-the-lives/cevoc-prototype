// Loading order for the evidence on the public page.
//   1. All thumbnails load first (the page renders them; the queue is told when they have settled).
//   2. Then every full-size photo and video starts at once, in parallel: the first photo at high priority, the rest at low
//      priority behind it, never more than `limit` at a time. No photo waits for another to finish.
//   3. The limit starts at `concurrency` and backs off (halves, minimum 1) on an error or a slow load, and creeps back up
//      after fast loads, so a weak connection is not flooded.
//   4. When someone opens or swipes to a photo, background loading pauses and that photo jumps ahead; the queue resumes after.
//   5. With Save-Data on, nothing loads in the background: a photo loads only when it is opened.
// `load(job, priority)` is injected (a fake in tests); it resolves when the item is ready and rejects when it failed.

export const STATE = { IDLE: 'idle', QUEUED: 'queued', LOADING: 'loading', READY: 'ready', ERROR: 'error' };

const SLOW_MS = 4000;
const FAST_MS = 1500;

export function createLoadQueue({ jobs, load, concurrency = 3, saveData = false, now = () => performance.now() }) {
  const state = new Map(jobs.map((j) => [j.id, STATE.IDLE]));
  const listeners = new Set();
  const promises = new Map();
  let started = false;
  let paused = 0; // photos opened by the person that are still loading
  let running = 0;
  let limit = concurrency; // current parallelism: backs off on trouble

  const emit = () => listeners.forEach((fn) => fn());
  const set = (id, s) => { if (state.get(id) !== s) { state.set(id, s); emit(); } };
  const jobOf = (id) => jobs.find((j) => j.id === id);
  const firstPhoto = () => jobs.find((j) => j.kind === 'image');

  function run(job, priority) {
    set(job.id, STATE.LOADING);
    running += 1;
    const t0 = now();
    const p = (async () => {
      try {
        await load(job, priority);
        const ms = now() - t0;
        if (ms > SLOW_MS) limit = Math.max(1, limit >> 1);
        else if (ms < FAST_MS) limit = Math.min(concurrency, limit + 1);
        set(job.id, STATE.READY);
      } catch {
        limit = Math.max(1, limit >> 1);
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

  // Everything else starts in parallel behind the first photo, up to the current limit.
  function next() {
    if (!started || saveData || paused > 0) return;
    const first = firstPhoto();
    for (const job of jobs) {
      if (running >= limit) return;
      if (state.get(job.id) === STATE.IDLE) {
        set(job.id, STATE.QUEUED);
        run(job, job === first ? 'high' : 'low').then(next);
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
    get limit() { return limit; },
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
