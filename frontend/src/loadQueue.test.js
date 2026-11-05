import { describe, expect, it } from 'vitest';
import { STATE, createLoadQueue, jobsFor } from './loadQueue.js';

/** A loader whose requests finish when the test says so, and which records the order they started in. */
function fakeLoader() {
  const started = [];
  const pending = new Map();
  const load = (job, priority) => new Promise((resolve, reject) => {
    started.push(`${job.id}:${priority}`);
    pending.set(job.id, { resolve, reject });
  });
  const finish = async (id, ok = true) => { const p = pending.get(id); pending.delete(id); ok ? p.resolve() : p.reject(new Error('x')); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
  return { load, started, finish, inFlight: () => [...pending.keys()] };
}

const jobs = [
  { id: 'p1', kind: 'image' }, { id: 'p2', kind: 'image' }, { id: 'p3', kind: 'image' }, { id: 'v1', kind: 'video' },
];

describe('load queue', () => {
  it('does nothing until the thumbnails have settled, then starts the first photo (high) with the rest in parallel behind it (low)', async () => {
    const f = fakeLoader();
    const q = createLoadQueue({ jobs, load: f.load });
    expect(f.started).toEqual([]);
    q.thumbnailsSettled();
    expect(f.started).toEqual(['p1:high', 'p2:low', 'p3:low']); // nobody waits for the first photo to finish
    expect(q.state('v1')).toBe(STATE.IDLE); // the limit of 3 is full
  });

  it('as each load finishes the next one in page order starts', async () => {
    const f = fakeLoader();
    const q = createLoadQueue({ jobs, load: f.load, concurrency: 2 });
    q.thumbnailsSettled();
    expect(f.started).toEqual(['p1:high', 'p2:low']);
    await f.finish('p2');
    expect(f.started.at(-1)).toBe('p3:low');
    await f.finish('p1');
    expect(f.started.at(-1)).toBe('v1:low');
    await f.finish('p3');
    await f.finish('v1');
    expect(['p1', 'p2', 'p3', 'v1'].map((id) => q.state(id))).toEqual(Array(4).fill(STATE.READY));
  });

  it('backs off to one at a time after an error or a slow load, and recovers after fast ones', async () => {
    const f = fakeLoader();
    let t = 0;
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `q${i}`, kind: 'image' }));
    const q = createLoadQueue({ jobs: many, load: f.load, concurrency: 4, now: () => t });
    q.thumbnailsSettled();
    expect(f.inFlight()).toEqual(['q0', 'q1', 'q2', 'q3']);
    await f.finish('q0', false); // error: limit 4 -> 2
    expect(q.limit).toBe(2);
    t = 5000; // q1 took 5s: slow, limit 2 -> 1
    await f.finish('q1');
    expect(q.limit).toBe(1);
    await f.finish('q2'); await f.finish('q3'); // slow too (t is far from their start); nothing new starts until in-flight < 1
    expect(f.inFlight().length).toBeLessThanOrEqual(1);
    for (let i = 0; i < 4; i += 1) { await f.finish(f.inFlight()[0]); } // t does not move: fast loads
    expect(q.limit).toBeGreaterThan(1);
  });

  it('a failed first photo does not block the rest; the failure is visible and can be retried', async () => {
    const f = fakeLoader();
    const q = createLoadQueue({ jobs, load: f.load });
    q.thumbnailsSettled();
    await f.finish('p1', false);
    expect(q.state('p1')).toBe(STATE.ERROR);
    expect(f.started).toContain('p2:low');
    q.retry('p1');
    expect(f.started.at(-1)).toBe('p1:high');
  });

  it('opening a photo makes it jump the queue and pauses background loading until it is done', async () => {
    const f = fakeLoader();
    const q = createLoadQueue({ jobs, load: f.load, concurrency: 1 });
    q.thumbnailsSettled();
    await f.finish('p1');
    expect(f.started).toEqual(['p1:high', 'p2:low']);
    const opened = q.prioritize('p3'); // not started yet: starts now, at high priority
    expect(f.started.at(-1)).toBe('p3:high');
    await f.finish('p2'); // the background one finishes, but nothing new starts while p3 is loading
    expect(f.started).toEqual(['p1:high', 'p2:low', 'p3:high']);
    await f.finish('p3');
    await opened;
    expect(f.started.at(-1)).toBe('v1:low'); // resumed
  });

  it('opening a photo that is already loading just holds the queue until it lands', async () => {
    const f = fakeLoader();
    const q = createLoadQueue({ jobs, load: f.load, concurrency: 2 });
    q.thumbnailsSettled();
    await f.finish('p1');
    q.prioritize('p2');
    await f.finish('p3');
    expect(f.started).not.toContain('v1:low');
    await f.finish('p2');
    expect(f.started).toContain('v1:low');
  });

  it('with Save-Data nothing loads in the background, but opening a photo still loads it', async () => {
    const f = fakeLoader();
    const q = createLoadQueue({ jobs, load: f.load, saveData: true });
    q.thumbnailsSettled();
    expect(f.started).toEqual([]);
    q.prioritize('p2');
    expect(f.started).toEqual(['p2:high']);
    await f.finish('p2');
    expect(f.started).toEqual(['p2:high']); // and the queue stays off
  });

  it('tells subscribers about each change', async () => {
    const f = fakeLoader();
    const q = createLoadQueue({ jobs, load: f.load });
    const seen = [];
    q.subscribe(() => seen.push(q.state('p1')));
    q.thumbnailsSettled();
    await f.finish('p1');
    expect(seen.at(-1)).toBe(STATE.READY);
    expect(seen).toContain(STATE.LOADING);
  });
});

describe('jobsFor', () => {
  it('lists photos first and videos after, in page order, and ignores certificates', () => {
    const items = [{ kind: 'VIDEO', url: 'v1' }, { kind: 'IMAGE', url: 'a' }, { kind: 'CERTIFICATE', url: 'c' }, { kind: 'IMAGE', url: 'b' }, { kind: 'VIDEO', url: 'v2' }];
    expect(jobsFor(items).map((j) => j.id)).toEqual(['a', 'b', 'v1', 'v2']);
  });
});
