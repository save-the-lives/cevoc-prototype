import { describe, expect, it, vi } from 'vitest';
import { buildRequest, emptyFields, formatSummary, imageCaption, imageSrc, isLiveCheckRoute, parseOffenceDate, parseResponse, runLiveCheck } from './liveCheck.js';

const good = { notice: 'ZZ000111', date: '05/03/2026', registration: 'AB 12CD' };

describe('parseOffenceDate', () => {
  it('converts DD/MM/YYYY to ISO', () => expect(parseOffenceDate('05/03/2026')).toBe('2026-03-05'));
  it('accepts leap day only in leap years', () => {
    expect(parseOffenceDate('29/02/2028')).toBe('2028-02-29');
    expect(parseOffenceDate('29/02/2027')).toBeNull();
  });
  it.each(['', '5/3/2026', '2026-03-05', '31/04/2026', '00/01/2026', '12/13/2026', 'ab/cd/efgh'])('rejects %j', (v) => expect(parseOffenceDate(v)).toBeNull());
});

describe('buildRequest', () => {
  it('builds body with ISO date and null registration when blank', () => {
    const r = buildRequest({ ...good, registration: '  ' });
    expect(r.ok).toBe(true);
    expect(r.request.body).toEqual({ notice: 'ZZ000111', offenceDate: '2026-03-05', registration: null, includeImages: true });
  });
  it('rejects bad input without echoing values', () => {
    for (const bad of [{ notice: 'a b' }, { date: '2026-03-05' }, { registration: 'x'.repeat(21) }]) {
      const r = buildRequest({ ...good, ...bad });
      expect(r.ok).toBe(false);
      for (const v of Object.values(good)) expect(r.error).not.toContain(v);
    }
  });
});

describe('formatSummary', () => {
  it('parses backend lines into rows', () => {
    const rows = formatSummary('state reached      : 3 images\nfields found       : \n  location: yes\nimages             : 2\n');
    expect(rows[0]).toEqual({ label: 'State reached', value: '3 images', nested: false });
    expect(rows[2]).toEqual({ label: 'Location', value: 'yes', nested: true });
    expect(rows[3].value).toBe('2');
  });
  it('handles empty', () => expect(formatSummary('')).toEqual([]));
});

describe('routing', () => {
  it('matches path and hash forms only', () => {
    expect(isLiveCheckRoute({ pathname: '/live-check', hash: '' })).toBe(true);
    expect(isLiveCheckRoute({ pathname: '/live-check/', hash: '' })).toBe(true);
    expect(isLiveCheckRoute({ pathname: '/', hash: '#/live-check' })).toBe(true);
    expect(isLiveCheckRoute({ pathname: '/', hash: '' })).toBe(false);
  });
});

describe('runLiveCheck', () => {
  it('sends no token header, no credentials, and yields rows', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, text: async () => 'images : 1\n' });
    const out = await runLiveCheck(good, { fetchImpl: f, base: 'http://x' });
    expect(out.ok).toBe(true);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('http://x/live-check/lookup');
    expect(init.headers['X-Live-Check-Token']).toBeUndefined();
    expect(init.credentials).toBe('omit');
  });
  it('maps a refusal and network failure to generic messages', async () => {
    const a = await runLiveCheck(good, { fetchImpl: async () => ({ ok: false, status: 401, text: async () => good.notice }) });
    expect(a.error).not.toMatch(/token/);
    expect(a.error).not.toContain(good.notice);
    const b = await runLiveCheck(good, { fetchImpl: async () => { throw new Error(good.notice); } });
    expect(b.error).not.toContain(good.notice);
  });
  it('does not call the network when invalid', async () => {
    const f = vi.fn();
    expect((await runLiveCheck({ ...good, date: 'x' }, { fetchImpl: f })).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('captured images (owner view)', () => {
  const img = { width: 8, height: 6, renderedWidth: 4, renderedHeight: 3, naturalWidth: 8, naturalHeight: 6, bytes: 120, path: 'canvas', contentType: 'image/png', data: 'AAEC' };

  it('asks for images in the request body', () => {
    expect(buildRequest(good).request.body.includeImages).toBe(true);
  });
  it('parses the JSON response into rows and displayable images with numbers-only captions', () => {
    const out = parseResponse(JSON.stringify({ summary: 'images : 1\nstep 1 start-browser : ok 5ms\n', images: [img] }));
    expect(out.rows.map((r) => r.label)).toEqual(['Images', 'Step 1 start-browser']);
    expect(out.images).toHaveLength(1);
    expect(out.images[0].src).toBe('data:image/png;base64,AAEC');
    expect(imageCaption(img)).toBe('8x6 px, 120 bytes, via canvas; rendered 4x3 px, natural 8x6 px');
  });
  it('reports unknown sizes as unknown and drops unsafe images', () => {
    expect(imageCaption({ ...img, naturalWidth: 0, naturalHeight: 0 })).toContain('natural unknown');
    expect(imageSrc({ ...img, contentType: 'text/html' })).toBeNull();
    expect(imageSrc({ ...img, data: 'a"onerror=x' })).toBeNull();
    expect(parseResponse(JSON.stringify({ summary: 'x : y', images: [{ ...img, contentType: 'text/html' }] })).images).toEqual([]);
  });
  it('still reads a plain text response', () => {
    const out = parseResponse('images             : 0\n');
    expect(out.images).toEqual([]);
    expect(out.rows[0].value).toBe('0');
  });
  it('runLiveCheck passes images through and sends no-store', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ summary: 'images : 1\n', images: [img] }) });
    const out = await runLiveCheck(good, { fetchImpl: f });
    expect(out.images).toHaveLength(1);
    expect(f.mock.calls[0][1].cache).toBe('no-store');
    expect(JSON.parse(f.mock.calls[0][1].body).includeImages).toBe(true);
  });
});

describe('cleared fields', () => {
  it('emptyFields gives blanks and a fresh object each time', () => {
    expect(emptyFields()).toEqual({ notice: '', date: '', registration: '' });
    expect(emptyFields()).not.toBe(emptyFields());
  });
});
