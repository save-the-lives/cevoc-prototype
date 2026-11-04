import { afterEach, describe, expect, it, vi } from 'vitest';
import { LookupError, resolveEvidence, resolveMediaUrl, streamLookup } from './api.js';

const enc = new TextEncoder();
const sseResponse = (chunks, init = {}) => new Response(
  new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } }),
  { status: 200, headers: { 'Content-Type': 'text/event-stream' }, ...init },
);
const q = { infringementNumber: '9000000004', offenceDate: '2026-01-15' };
const collect = () => { const ev = []; return { ev, on: (n, d) => ev.push([n, d]) }; };

afterEach(() => vi.unstubAllGlobals());

describe('streamLookup', () => {
  it('delivers the parts in order, from chunks split anywhere', async () => {
    const body = 'event:details\ndata:{"status":"FOUND"}\n\nevent:evidence\ndata:{"evidence":[{"kind":"IMAGE","url":"/api/media/abc","previewUrl":"/api/media/abc?s=thumb"}],"plateRequired":false}\n\nevent:certificates\ndata:{"certificates":[]}\n\nevent:done\ndata:{"ok":true}\n\n';
    const fetchMock = vi.fn(async () => sseResponse([body.slice(0, 17), body.slice(17, 90), body.slice(90)]));
    vi.stubGlobal('fetch', fetchMock);
    const { ev, on } = collect();
    await streamLookup({ ...q, registration: 'TST123' }, on);
    expect(ev.map((e) => e[0])).toEqual(['details', 'evidence', 'certificates', 'done']);
    // the plate travels in the body of that one request, never in the address
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/penalty-lookups/stream');
    expect(url).not.toContain('TST123');
    expect(JSON.parse(init.body).registration).toBe('TST123');
    expect(init.headers.Accept).toBe('text/event-stream');
  });

  it('no plate means no registration field at all', async () => {
    const fetchMock = vi.fn(async () => sseResponse(['event:done\ndata:{}\n\n']));
    vi.stubGlobal('fetch', fetchMock);
    await streamLookup(q, () => {});
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('registration');
  });

  it('a stream that stops early ends with an error event, so no section waits forever', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse(['event:details\ndata:{"status":"FOUND"}\n\n'])));
    const { ev, on } = collect();
    await streamLookup(q, on);
    expect(ev.at(-1)).toEqual(['error', { cause: 'stream-interrupted' }]);
  });

  it('falls back to the single JSON answer when there is no stream endpoint', async () => {
    const json = { status: 'FOUND', infringementNumber: 'x', notice: {}, evidence: [], certificates: [], plateRequired: true };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { ev, on } = collect();
    await streamLookup(q, on);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/penalty-lookups');
    expect(ev.map((e) => e[0])).toEqual(['details', 'evidence', 'certificates', 'done']);
    expect(ev[1][1].plateRequired).toBe(true);
  });

  it('a rejected body is invalid, a network failure is unavailable, an abort is passed on', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 400 })));
    await expect(streamLookup(q, () => {})).rejects.toMatchObject({ kind: 'invalid' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    await expect(streamLookup(q, () => {})).rejects.toBeInstanceOf(LookupError);
    vi.stubGlobal('fetch', vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }));
    await expect(streamLookup(q, () => {})).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('media urls', () => {
  it('only the API paths are resolved against the API origin; everything else is left alone', () => {
    expect(resolveMediaUrl('/api/media/abc')).toBe('/api/media/abc'); // API_BASE is empty in tests
    expect(resolveMediaUrl('/samples/image-1.jpg')).toBe('/samples/image-1.jpg');
    expect(resolveMediaUrl('https://x.example.test/a.jpg')).toBe('https://x.example.test/a.jpg');
    expect(resolveEvidence([{ kind: 'IMAGE', url: '/api/media/a', previewUrl: '/api/media/a?s=thumb' }])[0].previewUrl).toBe('/api/media/a?s=thumb');
    expect(resolveEvidence(null)).toEqual([]);
  });
});
