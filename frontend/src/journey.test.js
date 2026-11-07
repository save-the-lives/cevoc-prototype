import { describe, expect, it } from 'vitest';
import { certificateAnswer, classify, evidenceState, hasMeasureData, isCamera, money, niceDate, niceTime, statusSummary, stepsFor } from './journey.js';

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
  it('asks for the plate when the backend says it is required, even if the notice type is not clear', () => {
    expect(evidenceState({ notice: notice({ enforcementMethod: 'UNKNOWN' }), evidence: [], plateRequired: true }, false)).toBe('needs-plate');
    expect(evidenceState({ notice: null, evidence: [], plateRequired: true }, false)).toBe('needs-plate');
  });
  it('a plate that was given and not accepted is not a plate-required answer', () => {
    expect(evidenceState({ notice: notice(), evidence: [], plateRequired: false }, true)).toBe('plate-no-images');
  });
  it('is not applicable for officer-issued and unknown notices', () => {
    expect(evidenceState({ notice: notice({ enforcementMethod: 'OFFICER_ISSUED' }), evidence: [] }, false)).toBe('not-applicable');
    expect(evidenceState({ notice: notice({ enforcementMethod: 'UNKNOWN' }), evidence: [] }, true)).toBe('not-applicable');
  });
});

describe('isCamera', () => {
  it('treats held-back images as a camera notice', () => {
    expect(isCamera({ notice: notice({ enforcementMethod: 'UNKNOWN' }), plateRequired: true })).toBe(true);
    expect(isCamera({ notice: notice({ enforcementMethod: 'UNKNOWN' }) })).toBe(false);
    expect(stepsFor({ notice: notice({ enforcementMethod: 'UNKNOWN' }), plateRequired: true }, 'needs-plate').map((s) => s.id)).toContain('step-camera');
  });
});

describe('certificateAnswer', () => {
  const cert = (c) => ({ description: 'd', type: 't', periodText: 'p', certifiedDate: '2026-01-01', expiryDate: '2027-01-01', coversOffence: c });
  it('uses the server summary: covered, gap, continuous, one-sided and none', () => {
    const msg = (status, extra, message) => ({ certificates: [cert(status === 'covered')], certificateCoverage: { status, message, ...extra } });
    expect(certificateAnswer(msg('covered', {}, 'A certificate for this camera was in force on the offence date.')))
      .toEqual({ tone: 'ok', text: 'A certificate for this camera was in force on the offence date.' });
    expect(certificateAnswer(msg('gap', { side: 'between', gapDays: 39 }, 'There is a 39 day gap in certification around the offence date.')))
      .toEqual({ tone: 'warn', text: 'There is a 39 day gap in certification around the offence date.' });
    expect(certificateAnswer(msg('gap', { side: 'between', gapDays: 0 }, 'The camera was certified continuously around the offence date.')).tone).toBe('ok');
    expect(certificateAnswer(msg('gap', { side: 'before-only', gapDays: 10 }, 'The most recent certificate expired 10 days before the offence.')))
      .toEqual({ tone: 'warn', text: 'The most recent certificate expired 10 days before the offence.' });
    expect(certificateAnswer(msg('gap', { side: 'after-only', gapDays: 10 }, 'The next certificate starts 10 days after the offence.')).tone).toBe('warn');
    expect(certificateAnswer({ certificates: [], certificateCoverage: { status: 'none', message: 'We found no certificates for this camera around the offence date.' } }))
      .toEqual({ tone: 'neutral', text: 'We found no certificates for this camera around the offence date.' });
  });
  it('without a summary says only what the rows say, and never the old long message', () => {
    expect(certificateAnswer({ certificates: [cert(true)] })).toMatchObject({ tone: 'ok', text: expect.stringMatching(/was in force/) });
    const none = certificateAnswer({ certificates: [cert(false)] });
    expect(none.tone).toBe('warn');
    expect(none.text).not.toMatch(/covers the time/);
    expect(certificateAnswer({ certificates: [] })).toMatchObject({ tone: 'neutral' });
  });
});

describe('statusSummary and steps', () => {
  it('describes each notice status', () => {
    expect(statusSummary(notice(), '123').headline).toMatch(/\$277 owing/);
    expect(statusSummary(notice({ noticeStatus: 'PAID' }), '123').headline).toMatch(/paid/);
    expect(statusSummary(notice({ noticeStatus: 'CAUTION' }), '123').sub).toMatch(/no further action/i);
  });
  it('only lists the camera step for camera notices', () => {
    expect(stepsFor({ notice: notice() }, 'show').map((s) => s.id)).toEqual(['step-what', 'step-evidence', 'step-camera', 'step-options']);
    expect(stepsFor({ notice: notice({ enforcementMethod: 'OFFICER_ISSUED' }) }, 'not-applicable').map((s) => s.id)).toEqual(['step-what', 'step-evidence', 'step-options']);
  });
  it('includes measure step when measurement data exists', () => {
    const redLight = { notice: notice({ offenceDescription: 'Red light', offenceDate: '2026-03-01' }), details: { timeSinceRed: 2.5, speedLimit: 60 } };
    expect(stepsFor(redLight, 'show').map((s) => s.id)).toEqual(['step-what', 'step-evidence', 'step-measure', 'step-camera', 'step-options']);
    expect(hasMeasureData(redLight)).toBe(true);
  });
  it('omits measure step when no measurement data', () => {
    expect(hasMeasureData({ notice: notice() })).toBe(false);
  });
});
