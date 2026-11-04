import { describe, expect, it } from 'vitest';
import { certificateAnswer, classify, evidenceState, money, niceDate, niceTime, statusSummary, stepsFor } from './journey.js';

const notice = (over) => ({ enforcementMethod: 'CAMERA', noticeStatus: 'PAYABLE', amountOwing: 277, ...over });
const img = { kind: 'IMAGE', title: 'Sample', url: '/x.jpg' };

describe('formatting', () => {
  it('formats dates, times and money', () => {
    expect(niceDate('2026-03-14')).toBe('14 Mar 2026');
    expect(niceTime('11:12:00')).toBe('11:12 am');
    expect(niceTime('00:05:00')).toBe('12:05 am');
    expect(niceTime('15:30')).toBe('3:30 pm');
    expect(money(277)).toBe('$277');
    expect(money(277.5)).toBe('$277.50');
    expect(money(null)).toBe('');
  });
});

describe('classify', () => {
  it('maps the backend statuses to page states', () => {
    expect(classify({ status: 'FOUND', notice: {} })).toBe('found');
    expect(classify({ status: 'FOUND', notice: null })).toBe('unavailable');
    expect(classify({ status: 'NOT_FOUND' })).toBe('not-found');
    expect(classify({ status: 'LIVE_LOOKUP_DISABLED' })).toBe('lookup-off');
    expect(classify({ status: 'UNAVAILABLE' })).toBe('unavailable');
    expect(classify(null)).toBe('unavailable');
  });
});

describe('evidenceState', () => {
  it('shows media when there is any', () => {
    expect(evidenceState({ notice: notice(), evidence: [img] }, false)).toBe('show');
  });
  it('asks for the plate on a camera notice with no images and none given', () => {
    expect(evidenceState({ notice: notice(), evidence: [] }, false)).toBe('needs-plate');
  });
  it('says so when a plate was given and there are still no images', () => {
    expect(evidenceState({ notice: notice(), evidence: [] }, true)).toBe('plate-no-images');
  });
  it('a certificate alone is not evidence media', () => {
    expect(evidenceState({ notice: notice(), evidence: [{ kind: 'CERTIFICATE', url: '/c.pdf' }] }, false)).toBe('needs-plate');
  });
  it('is not applicable for officer-issued and unknown notices', () => {
    expect(evidenceState({ notice: notice({ enforcementMethod: 'OFFICER_ISSUED' }), evidence: [] }, false)).toBe('not-applicable');
    expect(evidenceState({ notice: notice({ enforcementMethod: 'UNKNOWN' }), evidence: [] }, true)).toBe('not-applicable');
  });
});

describe('certificateAnswer', () => {
  const cert = (c) => ({ description: 'd', type: 't', periodText: 'p', certifiedDate: '2026-01-01', expiryDate: '2027-01-01', coversOffence: c });
  it('says plainly whether a certificate covered the offence', () => {
    expect(certificateAnswer({ certificates: [cert(true), cert(false)] })).toMatchObject({ tone: 'ok', text: expect.stringMatching(/was in force/) });
    expect(certificateAnswer({ certificates: [cert(true), cert(true)] }).text).toMatch(/2 certificates/);
    expect(certificateAnswer({ certificates: [cert(false)] })).toMatchObject({ tone: 'warn' });
    expect(certificateAnswer({ certificates: [] })).toMatchObject({ tone: 'neutral' });
  });
});

describe('statusSummary and steps', () => {
  it('describes each notice status', () => {
    expect(statusSummary(notice()).headline).toBe('$277 is owing on this notice.');
    expect(statusSummary(notice({ noticeStatus: 'PAID' })).headline).toMatch(/paid/);
    expect(statusSummary(notice({ noticeStatus: 'CAUTION' })).next).toMatch(/no longer need to pay/);
  });
  it('only lists the camera step for camera notices', () => {
    expect(stepsFor({ notice: notice() }, 'show').map((s) => s.id)).toEqual(['step-what', 'step-evidence', 'step-camera', 'step-options']);
    expect(stepsFor({ notice: notice({ enforcementMethod: 'OFFICER_ISSUED' }) }, 'not-applicable').map((s) => s.id)).toEqual(['step-what', 'step-evidence', 'step-options']);
  });
});
