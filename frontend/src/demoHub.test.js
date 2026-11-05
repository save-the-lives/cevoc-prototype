import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allCases, demoCaseParam, demoContentUnavailable, findCase, isDemoHubRoute, spacedNumber, statusMark } from './demoHub.js';
import { applyEvent, initialLookup, toResult } from './lookupState.js';
import { certificateAnswer, classify, evidenceState } from './journey.js';
import { detailRows, videoView } from './programs.js';

// Generated from the backend's demo scenario list (DemoArtifacts); a backend test keeps it current.
const fixture = JSON.parse(readFileSync(new URL('../../scripts/visual-check-demo-cases.json', import.meta.url), 'utf8'));

const play = (events) => events.reduce((state, [name, data]) => applyEvent(state, name, data), initialLookup());

describe('hub routes and links', () => {
  it('recognises the hub and its alias, nothing else', () => {
    expect(isDemoHubRoute({ pathname: '/demo-cases' })).toBe(true);
    expect(isDemoHubRoute({ pathname: '/test-cases/' })).toBe(true);
    expect(isDemoHubRoute({ pathname: '/' })).toBe(false);
    expect(isDemoHubRoute({ pathname: '/demo-cases/x' })).toBe(false);
    expect(isDemoHubRoute({ pathname: '/live-check' })).toBe(false);
  });
  it('reads only a ten-digit demo parameter', () => {
    expect(demoCaseParam('?demo=1000000001')).toBe('1000000001');
    expect(demoCaseParam('?demo=100000001')).toBeNull();
    expect(demoCaseParam('?demo=abcdefghij')).toBeNull();
    expect(demoCaseParam('')).toBeNull();
  });
  it('spaces a number as prefix and sequence', () => expect(spacedNumber('1000000106')).toBe('100000 0106'));
  it('has a mark for every status the backend can send', () => {
    for (const s of ['available', 'partial', 'not_returned', 'held_back', 'failed', 'no_rules', 'not_applicable']) expect(statusMark(s)).not.toBe('?');
  });
});

describe('the generated demo catalog', () => {
  const catalog = fixture.catalog;
  it('lists seven programs, two built, five reserved', () => {
    expect(catalog.programs.map((p) => p.prefix)).toEqual(['000000', '100000', '200000', '300000', '400000', '500000', '600000']);
    expect(catalog.programs.filter((p) => p.built).map((p) => p.prefix)).toEqual(['000000', '100000']);
    expect(catalog.programs.filter((p) => !p.built).every((p) => p.groups.length === 0)).toBe(true);
  });
  it('groups every built program as happy, partial, sad, edge', () => {
    for (const p of catalog.programs.filter((x) => x.built)) expect(p.groups.map((g) => g.kind)).toEqual(['happy', 'partial', 'sad', 'edge']);
  });
  it('finds a case by number', () => {
    expect(findCase(catalog, '1000000001').title).toMatch(/Everything returned/);
    expect(findCase(catalog, '9999999999')).toBeNull();
    expect(allCases(catalog).length).toBe(Object.keys(fixture.cases).length);
  });
});

// The page logic, run on the real stream events of every case, must agree with the status the hub declares for it.
describe.each(allCases(fixture.catalog).map((c) => [c.number, c]))('case %s', (number, c) => {
  const run = fixture.cases[number];
  const live = play(run.events);
  const result = toResult(live);
  const t = c.transparency;

  it('settles every section', () => expect(live.finished).toBe(true));

  it('ends as the hub says for the whole lookup', () => {
    if (t.images === 'not_applicable') expect(classify(result)).toBe('not-found');
    else if (t.details === 'failed') expect(classify(result)).toBe('unavailable');
    else expect(classify(result)).toBe('found');
  });

  it('carries the demo source so the Demo data tag shows', () => expect(live.details.source).toBe('DEMO'));

  it('images, certificates and video follow their declared status', () => {
    if (classify(result) !== 'found') return;
    if (t.images === 'failed') {
      expect(live.evidence.state).toBe('error');
      expect(live.certificates.state).toBe('error');
      return;
    }
    const ev = evidenceState(result, false);
    if (t.images === 'held_back') expect(ev).toBe('needs-plate');
    else expect(ev).toBe('show');
    if (t.images === 'available') expect(result.evidence.filter((e) => e.kind === 'IMAGE').length).toBeGreaterThan(1);
    if (t.images === 'partial') expect(result.evidence.filter((e) => e.kind === 'IMAGE').length).toBe(1);
    const cert = certificateAnswer(result);
    if (t.certificates === 'available') expect(cert.tone).toBe('ok');
    if (t.certificates === 'partial') expect(cert.tone).toBe('warn');
    if (t.certificates === 'not_returned' || t.certificates === 'failed') expect(cert.tone).toBe('neutral');
    const video = videoView(result);
    if (t.video === 'available') expect(video.render).toBe(true);
    if (t.video === 'not_returned') expect(video.render).toBe(false);
  });

  it('program details follow their declared status', () => {
    if (classify(result) !== 'found') return;
    const view = detailRows(result);
    if (t.details === 'no_rules') expect(['default', 'no-version']).toContain(view.state);
    else {
      expect(view.state).toBe('rows');
      const missing = view.rows.filter((r) => r.missing).length;
      if (t.details === 'available') expect(missing).toBe(0);
      if (t.details === 'partial') expect(missing).toBeGreaterThan(0), expect(missing).toBeLessThan(view.rows.length);
      if (t.details === 'not_returned') expect(missing).toBe(view.rows.length);
    }
  });

  if (run.eventsWithPlate) {
    it('with a plate the held-back images follow the plate rule', () => {
      const withPlate = toResult(play(run.eventsWithPlate));
      const shown = evidenceState(withPlate, true);
      expect(shown).toBe(c.plate ? 'show' : 'plate-no-images');
    });
  }
});

describe('demo content that failed to load', () => {
  it('is recognised only when the backend says available is false', () => {
    expect(demoContentUnavailable({ available: false, notice: 'x', programs: [] })).toBe(true);
    expect(demoContentUnavailable({ available: true, programs: [] })).toBe(false);
    expect(demoContentUnavailable({ programs: [] })).toBe(false);
    expect(demoContentUnavailable(null)).toBe(false);
  });
});
