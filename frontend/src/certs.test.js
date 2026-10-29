import { describe, expect, it } from 'vitest';
import { certificateLabel, certificateRows, certificateSummary, formatDate, hasCertificateList, orderCertificates } from './certs.js';

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
    expect(certificateLabel(c({ coversOffence: true }))).toBe('Valid on the offence date');
    expect(certificateLabel(c({ coversOffence: false }))).toBe('Not in force on the offence date');
    expect(certificateLabel(c({ coversOffence: undefined }))).toBe('Not in force on the offence date');
  });
  it('puts covering rows first, then newest certified first, without mutating', () => {
    const input = [c({ description: 'old', certifiedDate: '2024-01-01' }), c({ description: 'cover', certifiedDate: '2025-01-01', coversOffence: true }), c({ description: 'new', certifiedDate: '2026-01-01' })];
    const out = orderCertificates(input);
    expect(out.map((x) => x.description)).toEqual(['cover', 'new', 'old']);
    expect(input[0].description).toBe('old');
  });
  it('builds rows with text fields', () => {
    const [r] = certificateRows([c({ coversOffence: true, certifiedDate: '2026-03-14', expiryDate: '2027-03-13' })]);
    expect(r).toMatchObject({ covers: true, label: 'Valid on the offence date', certifiedText: '14 Mar 2026', expiryText: '13 Mar 2027' });
  });
  it('summarises how many cover the offence', () => {
    expect(certificateSummary([c({ coversOffence: true })])).toBe('1 certificate was valid on the offence date.');
    expect(certificateSummary([c({ coversOffence: true }), c({ coversOffence: true })])).toBe('2 certificates were valid on the offence date.');
    expect(certificateSummary([c()])).toMatch(/None of these/);
  });
  it('falls back to the old display unless certificates is a non-empty array', () => {
    expect(hasCertificateList({ certificates: [c()] })).toBe(true);
    expect(hasCertificateList({ certificates: [] })).toBe(false);
    expect(hasCertificateList({ certificates: null })).toBe(false);
    expect(hasCertificateList({})).toBe(false);
    expect(hasCertificateList(undefined)).toBe(false);
  });
});
