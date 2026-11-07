import { describe, expect, it } from 'vitest';
import { MAX_CARDS, certificateLabel, certificateRows, certificateSummary, coverageTone, formatDate, hasCertificateList } from './certs.js';

const c = (over) => ({ description: 'd', type: 't', periodText: 'p', certifiedDate: '2026-01-01', expiryDate: '2027-01-01', coversOffence: false, ...over });

describe('certificate helpers', () => {
  it('formats dates without time zone shifts', () => {
    expect(formatDate('2026-03-14')).toBe('14 Mar 2026');
    expect(formatDate('2026-12-01')).toBe('1 Dec 2026');
    expect(formatDate('')).toBe('Not given');
    expect(formatDate(null)).toBe('Not given');
    expect(formatDate('garbage')).toBe('garbage');
    expect(formatDate('2026-13-01')).toBe('2026-13-01');
  });
  it('labels rows in plain words', () => {
    expect(certificateLabel(c({ coversOffence: true }))).toBe('In force on the offence date');
    expect(certificateLabel(c({ coversOffence: false }))).toBe('Not in force on the offence date');
    expect(certificateLabel(c({ coversOffence: undefined }))).toBe('Not in force on the offence date');
  });
  it('keeps the order the server chose and shows at most three cards, without mutating', () => {
    const input = [c({ description: 'before' }), c({ description: 'after' }), c({ description: 'x' }), c({ description: 'y' })];
    const rows = certificateRows(input);
    expect(rows.map((x) => x.description)).toEqual(['before', 'after', 'x']);
    expect(rows).toHaveLength(MAX_CARDS);
    expect(input).toHaveLength(4);
  });
  it('builds rows with text fields', () => {
    const [r] = certificateRows([c({ coversOffence: true, certifiedDate: '2026-03-14', expiryDate: '2027-03-13' })]);
    expect(r).toMatchObject({ covers: true, label: 'In force on the offence date', certifiedText: '14 Mar 2026', expiryText: '13 Mar 2027' });
  });
  it('uses the server coverage message as the headline', () => {
    expect(certificateSummary([c({ coversOffence: true })], { status: 'covered', message: 'This camera was certified at the time of the offence.' }))
      .toBe('This camera was certified at the time of the offence.');
    expect(certificateSummary([c()], { status: 'gap', message: 'Some camera certificates may not have been in force on the offence date.' }))
      .toMatch(/may not have been in force/);
  });
  it('falls back when coverage has no message', () => {
    expect(certificateSummary([c({ coversOffence: true })], { status: 'covered' }))
      .toBe('This camera was certified at the time of the offence.');
    expect(certificateSummary([c()], null)).toMatch(/None of these/);
  });
  it('picks a tone from the coverage summary', () => {
    expect(coverageTone({ status: 'covered' })).toBe('ok');
    expect(coverageTone({ status: 'gap', side: 'between', gapDays: 0 })).toBe('ok');
    expect(coverageTone({ status: 'gap', side: 'between', gapDays: 12 })).toBe('warn');
    expect(coverageTone({ status: 'gap', side: 'before-only', gapDays: 0 })).toBe('warn');
    expect(coverageTone({ status: 'gap', side: 'after-only', gapDays: 3 })).toBe('warn');
    expect(coverageTone({ status: 'none' })).toBe('neutral');
    expect(coverageTone(null)).toBe('neutral');
  });
  it('detects certificate data from either certificates or uncoveredTypes', () => {
    expect(hasCertificateList({ certificates: [c()] })).toBe(true);
    expect(hasCertificateList({ certificates: [], uncoveredTypes: [{ description: 'x', message: 'y' }] })).toBe(true);
    expect(hasCertificateList({ certificates: [] })).toBe(false);
    expect(hasCertificateList({ certificates: null })).toBe(false);
    expect(hasCertificateList({})).toBe(false);
    expect(hasCertificateList(undefined)).toBe(false);
  });
});
