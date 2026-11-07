import { describe, expect, it } from 'vitest';
import { SECTION, applyEvent, eventsFromResult, initialLookup, restartSections, toResult } from './lookupState.js';

const details = { status: 'FOUND', infringementNumber: '9000000004', summary: 's', notice: { enforcementMethod: 'CAMERA' }, source: 'TEST' };
const run = (events, from = initialLookup()) => events.reduce((s, [n, d]) => applyEvent(s, n, d), from);

describe('lookup state', () => {
  it('fills each section as its event arrives', () => {
    let s = initialLookup();
    expect(toResult(s)).toBeNull();
    s = applyEvent(s, 'details', details);
    expect(toResult(s).notice.enforcementMethod).toBe('CAMERA');
    expect(s.evidence.state).toBe(SECTION.LOADING);
    expect(s.certificates.state).toBe(SECTION.LOADING);
    s = applyEvent(s, 'evidence', { evidence: [{ kind: 'IMAGE', url: '/a' }], plateRequired: false });
    expect(s.evidence.state).toBe(SECTION.READY);
    expect(s.certificates.state).toBe(SECTION.LOADING);
    s = applyEvent(s, 'certificates', { certificates: [{ coversOffence: true }] });
    s = applyEvent(s, 'done', { ok: true });
    expect(s.finished).toBe(true);
    expect(toResult(s).evidence).toHaveLength(1);
    expect(toResult(s).certificates).toHaveLength(1);
  });

  it('carries the coverage summary from the certificates event into the result', () => {
    const coverage = { status: 'gap', side: 'between', gapDays: 39, message: 'There is a 39 day gap in certification around the offence date.' };
    const s = run([['details', details], ['evidence', { evidence: [], plateRequired: false }], ['certificates', { certificates: [{}, {}], coverage }], ['done', {}]]);
    expect(toResult(s).certificateCoverage).toEqual(coverage);
    const older = run([['details', details], ['certificates', { certificates: [] }]]);
    expect(toResult(older).certificateCoverage).toBeNull();
  });

  it('a single JSON answer keeps the coverage summary', () => {
    const coverage = { status: 'covered', message: 'x' };
    const ev = eventsFromResult({ ...details, evidence: [], certificates: [{}], certificateCoverage: coverage }).find((e) => e[0] === 'certificates');
    expect(ev[1]).toEqual({ certificates: [{}], coverage, uncoveredTypes: [] });
  });

  it('carries the plate-required flag into the result', () => {
    const s = run([['details', details], ['evidence', { evidence: [], plateRequired: true }], ['certificates', { certificates: [] }], ['done', {}]]);
    expect(toResult(s).plateRequired).toBe(true);
    expect(toResult(s).evidence).toEqual([]);
  });

  it('an error settles sections that never arrived as failed, keeping the ones that did', () => {
    const s = run([['details', details], ['evidence', { evidence: [], plateRequired: false }], ['error', { cause: 'timeout' }]]);
    expect(s.evidence.state).toBe(SECTION.READY);
    expect(s.certificates.state).toBe(SECTION.ERROR);
    expect(s.error).toBe('timeout');
  });

  it('an error without a cause token still gets a fixed one', () => {
    expect(run([['error', {}]]).error).toBe('source-failed');
    expect(run([['error', { cause: { x: 1 } }]]).error).toBe('source-failed');
  });

  it('ignores unknown events', () => {
    const s = initialLookup();
    expect(applyEvent(s, 'surprise', {})).toBe(s);
  });

  it('restarting for a plate keeps the notice and shows the other sections as loading again', () => {
    const done = run([['details', details], ['evidence', { evidence: [], plateRequired: true }], ['certificates', { certificates: [] }], ['done', {}]]);
    const again = restartSections(done);
    expect(again.details).toEqual(details);
    expect(again.evidence.state).toBe(SECTION.LOADING);
    expect(again.evidence.plateRequired).toBe(false);
    expect(again.finished).toBe(false);
  });

  it('a single JSON answer is the same sequence of events', () => {
    const names = eventsFromResult({ ...details, evidence: [], certificates: [], plateRequired: true }).map((e) => e[0]);
    expect(names).toEqual(['details', 'evidence', 'certificates', 'done']);
    const notFound = eventsFromResult({ status: 'NOT_FOUND', infringementNumber: 'x', summary: 'n', evidence: [], certificates: [] });
    expect(notFound.map((e) => e[0])).toEqual(['details', 'evidence', 'certificates', 'done']);
    expect(notFound[0][1].status).toBe('NOT_FOUND');
    expect(eventsFromResult({ ...details, evidence: [], certificates: [], plateRequired: true })[1][1].plateRequired).toBe(true);
  });
});
