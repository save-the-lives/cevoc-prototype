import { describe, expect, it } from 'vitest';
import { checkVersions, detailRows, pickProgram, pickVersion } from './programs.js';
import config from './programs.json';
import { applyEvent, eventsFromResult, initialLookup, toResult } from './lookupState.js';

// FICTITIOUS values only.
const redLight = (over = {}) => ({
  notice: { offenceDescription: 'Proceed through red traffic light', offenceDate: '2026-01-15', enforcementMethod: 'CAMERA' },
  details: { timeSinceRed: 1.2, speedLimit: 60 },
  ...over,
});

describe('program configuration file', () => {
  it('has no overlaps or gaps and every program has a version', () => {
    for (const p of config.programs) expect(checkVersions(p)).toEqual([]);
  });
  it('detects an overlap, a gap and two open ends', () => {
    const v = (version, from, to) => ({ version, from, to });
    expect(checkVersions({ id: 'X', versions: [v('a', '2024-01-01', '2024-06-30'), v('b', '2024-06-30', null)] }).join()).toContain('overlaps');
    expect(checkVersions({ id: 'X', versions: [v('a', '2024-01-01', '2024-06-30'), v('b', '2024-07-02', null)] }).join()).toContain('gap');
    expect(checkVersions({ id: 'X', versions: [v('a', '2024-01-01', null), v('b', '2024-07-01', null)] }).join()).toContain('no end');
  });
});

describe('picking the version by offence date', () => {
  const p = { id: 'X', versions: [{ version: 'a', from: '2024-01-01', to: '2024-06-30' }, { version: 'b', from: '2024-07-01', to: null }] };
  it('uses inclusive ends and the open-ended current version', () => {
    expect(pickVersion(p, '2024-01-01').version).toBe('a');
    expect(pickVersion(p, '2024-06-30').version).toBe('a');
    expect(pickVersion(p, '2024-07-01').version).toBe('b');
    expect(pickVersion(p, '2031-01-01').version).toBe('b');
    expect(pickVersion(p, '2023-12-31')).toBeNull();
    expect(pickVersion(p, 'not a date')).toBeNull();
  });
});

describe('red light details', () => {
  it('shows the two mockup facts with units, time since red first', () => {
    const v = detailRows(redLight());
    expect(v.state).toBe('rows');
    expect(v.rows).toEqual([
      { key: 'timeSinceRed', label: 'Seconds after the light turned red', first: true, value: '1.2 seconds' },
      { key: 'speedLimit', label: 'Speed limit', first: false, value: '60 km/h' },
    ]);
  });
  it('marks a missing or empty fact as missing (shown as a plain message), and ignores keys it does not show', () => {
    const v = detailRows(redLight({ details: { timeSinceRed: 2, speedLimit: '', lane: 2, direction: 'North' } }));
    expect(v.rows.map((r) => r.key)).toEqual(['timeSinceRed', 'speedLimit']);
    expect(v.rows.map((r) => !!r.missing)).toEqual([false, true]);
  });
  it('marks every configured fact missing when nothing was returned', () => {
    for (const details of [{}, undefined]) {
      const v = detailRows(redLight({ details }));
      expect(v.rows.map((r) => r.missing)).toEqual([true, true]);
    }
  });
  it('matches on a returned time since red when the summary text is different', () => {
    expect(pickProgram({ notice: { offenceDescription: 'Camera recorded' }, details: { timeSinceRed: 1 } }).id).toBe('RED_LIGHT_SPEED');
  });
  it('says so plainly when no version covers the offence date', () => {
    const v = detailRows(redLight({ notice: { offenceDescription: 'red light', offenceDate: '1990-01-01' } }));
    expect(v.state).toBe('no-version');
    expect(v.message).toMatch(/do not have display rules/);
  });
  it('is the default (nothing extra shown) for a notice that matches no program, and never throws on no details', () => {
    expect(detailRows({ notice: { offenceDescription: 'Parking offence', offenceDate: '2026-01-15' } }).state).toBe('default');
    expect(detailRows({ notice: null }).state).toBe('default');
    expect(detailRows(null).state).toBe('default');
  });
});

describe('the details map travels through the lookup state', () => {
  it('is applied from an extra event and appears in the result; absent otherwise', () => {
    let s = applyEvent(initialLookup(), 'details', { status: 'FOUND', notice: {} });
    expect(toResult(s).details).toBeUndefined();
    s = applyEvent(s, 'extra', { details: { lane: '2' } });
    expect(toResult(s).details).toEqual({ lane: '2' });
    expect(applyEvent(s, 'extra', { details: 'not a map' })).toBe(s);
  });
  it('a single JSON answer with details is equivalent to an extra event', () => {
    const names = eventsFromResult({ status: 'FOUND', evidence: [], certificates: [], details: { lane: '2' } }).map((e) => e[0]);
    expect(names).toContain('extra');
    expect(eventsFromResult({ status: 'FOUND', evidence: [], certificates: [] }).map((e) => e[0])).not.toContain('extra');
  });
});
