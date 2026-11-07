// Pure helpers for the public journey: what to say, given what the backend returned.
import { coverageTone, hasCertificateList } from './certs.js';
import { detailRows, pickProgram } from './programs.js';

export const HELP_PHONE = '1300 138 118';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'yyyy-MM-dd' -> '14 Mar 2026' without Date objects (no time zone shifts). */
export function niceDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m && MONTHS[Number(m[2]) - 1] ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : (iso || '');
}

/** 'HH:mm[:ss]' -> '11:12 am'. */
export function niceTime(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  if (!m) return t || '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
}

export function money(n) {
  if (n === null || n === undefined || n === '') return '';
  const v = Number(n);
  if (Number.isNaN(v)) return String(n);
  return `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

/** What the page can do with a lookup response. */
export function classify(result) {
  if (!result) return 'unavailable';
  switch (result.status) {
    case 'FOUND': return result.notice ? 'found' : 'unavailable';
    case 'NOT_FOUND': return 'not-found';
    case 'LIVE_LOOKUP_OFF':
    case 'LIVE_LOOKUP_DISABLED': return 'lookup-off';
    default: return 'unavailable';
  }
}

/**
 * Which evidence message applies.
 *  show            at least one photo or video
 *  needs-plate     the backend flagged plateRequired, or a camera offence with no images and no registration number given
 *  plate-no-images camera offence, no images, although a registration number was given (not accepted, or none held)
 *  not-yet         camera offence, nothing to show and we cannot tell why
 *  not-applicable  not a camera notice
 */
export function evidenceState(result, registrationGiven) {
  const media = (result?.evidence || []).filter((e) => e.kind !== 'CERTIFICATE');
  if (media.length > 0) return 'show';
  // The backend says so directly: the source holds images for this notice but releases them only with the number plate.
  if (result?.plateRequired === true && !registrationGiven) return 'needs-plate';
  const method = result?.notice?.enforcementMethod;
  if (method === 'OFFICER_ISSUED') return 'not-applicable';
  if (method !== 'CAMERA') return 'not-applicable';
  return registrationGiven ? 'plate-no-images' : 'needs-plate';
}

/** The plain-language answer under "Was the camera working properly?". */
export function certificateAnswer(result) {
  // No-plate path: certificates need the registration number too.
  if (result?.plateRequired === true && !hasCertificateList(result)) {
    return { tone: 'neutral', text: 'The camera certificates also need the number plate.' };
  }
  const cov = result?.certificateCoverage;
  if (cov && typeof cov.message === 'string' && cov.message) {
    return { tone: coverageTone(cov), text: cov.message };
  }
  if (!hasCertificateList(result)) {
    return { tone: 'neutral', text: 'We can’t show the camera’s certificates for this notice yet.' };
  }
  // No summary from the server: say only what the rows themselves say.
  return result.certificates.some((c) => c.coversOffence === true)
    ? { tone: 'ok', text: 'A certificate for this camera was in force on the offence date.' }
    : { tone: 'warn', text: 'None of the certificates we found was in force on the offence date.' };
}

/** Headline for the notice status box. Only says what the data says. */
export function statusSummary(notice) {
  const owing = money(notice.amountOwing);
  switch (notice.noticeStatus) {
    case 'PAID': return { tone: 'info', stage: 'Paid', headline: 'This penalty has been paid.', sub: 'This penalty notice is paid. No need to take any further action.', resolved: true };
    case 'CAUTION': return { tone: 'info', stage: 'Caution', headline: 'This penalty has been replaced with a caution.', sub: 'You no longer need to pay.', resolved: true };
    case 'PAYABLE': return { tone: 'warn', stage: 'Payment due', headline: owing ? `${owing} is owing on this notice.` : 'Payment is due on this notice.', next: 'Nothing here changes your notice. See your options below.', options: 'You can pay, ask for a review or set up a payment plan.', resolved: false };
    default: return { tone: 'info', stage: 'Notice status', headline: notice.statusMessage || 'Contact us about the current status of this notice.', next: '', options: 'You may still be able to pay, ask for a review or set up a payment plan.', resolved: false };
  }
}

/** A camera notice: marked so by the data, or the source is holding camera images back until the plate is given. */
export function isCamera(result) {
  return result?.notice?.enforcementMethod === 'CAMERA' || result?.plateRequired === true;
}

/** Steps shown for a result, in order. */
export function stepsFor(result, evState) {
  const camera = isCamera(result);
  const steps = [
    { id: 'step-what', label: 'What happened' },
    { id: 'step-evidence', label: evState === 'not-applicable' ? 'Camera evidence' : 'Was it my vehicle?' },
  ];
  if (camera && hasMeasureData(result)) steps.push({ id: 'step-measure', label: 'How it was measured' });
  if (camera) steps.push({ id: 'step-camera', label: 'Was the camera working?' });
  steps.push({ id: 'step-options', label: 'Your options' });
  return steps;
}

/** True when the result has enough measurement metadata to warrant the "How it was measured" step. */
export function hasMeasureData(result) {
  const view = detailRows(result);
  return view.state === 'rows' && view.rows.some((r) => !r.missing);
}

/** The line under "Was it my vehicle?" once the photos are available. It must not send people to photos they cannot see. */
export function photosAnswer({ hasVideo, timedOut }) {
  if (timedOut) return 'Your photos have timed out, so we can’t show them right now.';
  return `Check the number plate and the vehicle in the ${hasVideo ? 'photos and video' : 'photos'}.`;
}
