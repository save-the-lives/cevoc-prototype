import { describe, expect, it, vi } from 'vitest';
import { buildRequest, emptyFields, formatSummary, isLiveCheckRoute, parseOffenceDate, runLiveCheck } from './liveCheck.js';

const good = { token: 'tok-fictitious', notice: 'ZZ000111', date: '05/03/2026', registration: 'AB 12CD' };

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
    expect(r.request.body).toEqual({ notice: 'ZZ000111', offenceDate: '2026-03-05', registration: null });
  });
  it('rejects bad input without echoing values', () => {
    for (const bad of [{ token: '' }, { notice: 'a b' }, { date: '2026-03-05' }, { registration: 'x'.repeat(11) }]) {
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
  it('sends the token header, no credentials, and yields rows', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, text: async () => 'images : 1\n' });
    const out = await runLiveCheck(good, { fetchImpl: f, base: 'http://x' });
    expect(out.ok).toBe(true);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('http://x/live-check/lookup');
    expect(init.headers['X-Live-Check-Token']).toBe('tok-fictitious');
    expect(init.credentials).toBe('omit');
  });
  it('maps 401 and network failure to generic messages', async () => {
    const a = await runLiveCheck(good, { fetchImpl: async () => ({ ok: false, status: 401, text: async () => good.notice }) });
    expect(a.error).toMatch(/token/);
    const b = await runLiveCheck(good, { fetchImpl: async () => { throw new Error(good.notice); } });
    expect(b.error).not.toContain(good.notice);
  });
  it('does not call the network when invalid', async () => {
    const f = vi.fn();
    expect((await runLiveCheck({ ...good, date: 'x' }, { fetchImpl: f })).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('cleared fields', () => {
  it('emptyFields gives blanks and a fresh object each time', () => {
    expect(emptyFields()).toEqual({ token: '', notice: '', date: '', registration: '' });
    expect(emptyFields()).not.toBe(emptyFields());
  });
});
