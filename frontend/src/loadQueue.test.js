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
  it('does nothing until the thumbnails have settled, then loads only the first photo', async () => {
    const f = fakeLoader();
    const q = createLoadQueue({ jobs, load: f.load });
    expect(f.started).toEqual([]);
    q.thumbnailsSettled();
    expect(f.started).toEqual(['p1:high']);
    expect(q.state('p2')).toBe(STATE.IDLE);
  });

  it('everything else waits for the first photo, then runs in order, two at a time', async () => {
    const f = fakeLoader();
    const q = createLoadQueue({ jobs, load: f.load, concurrency: 2 });
    q.thumbnailsSettled();
    await f.finish('p1');
    expect(f.started).toEqual(['p1:high', 'p2:low', 'p3:low']);
    expect(f.inFlight()).toEqual(['p2', 'p3']);
    expect(q.state('v1')).toBe(STATE.IDLE); // video waits for its turn
    await f.finish('p2');
    expect(f.started.at(-1)).toBe('v1:low');
    await f.finish('p3');
    await f.finish('v1');
    expect(['p1', 'p2', 'p3', 'v1'].map((id) => q.state(id))).toEqual(Array(4).fill(STATE.READY));
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
