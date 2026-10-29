// Which certificates each camera type needs, and whether each was current on the offence date.
// Plain-English summary for prototyping, not legal advice.
import { CERTS, site } from '../data.js';

const S137 = { section: 's137', label: 'Speed device tested and sealed', days: 365, window: 'within 12 months' };
const S138 = { section: 's138', label: 'Camera inspected', days: 90, window: 'within 90 days' };

export const REQUIRED = {
  FIXED_SPEED: [S137, S138],
  RED_LIGHT_SPEED: [S137, S138],
  MOBILE_SPEED: [S137, { section: 's138', session: true, label: 'Camera checked before the session', window: 'on the day, before the session' }],
  AVERAGE_SPEED: [
    { section: 's132', label: 'Distance between cameras surveyed', window: 'before the offence' },
    { ...S138, point: 'A', label: 'Camera at point A inspected' },
    { ...S138, point: 'B', label: 'Camera at point B inspected' },
  ],
  MOBILE_PHONE: [S138],
};

const day = (iso) => new Date(iso.slice(0, 10) + 'T00:00:00');
export const daysBetween = (a, b) => Math.round((day(b) - day(a)) / 86400000);

// statusOf(cert) lets callers apply withdrawals (real or hypothetical).
export function evaluate(n, statusOf = (c) => c.status) {
  const s = site(n.site);
  const date = n.dateTime.slice(0, 10);
  const time = n.dateTime.slice(11, 16);
  const items = REQUIRED[s.program].map((req) => {
    const pool = CERTS.filter((c) => c.site === n.site && c.section === req.section && (!req.point || c.point === req.point) && !!c.session === !!req.session && c.date <= date)
      .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    const live = pool.filter((c) => statusOf(c) !== 'withdrawn');
    const withdrawn = pool.find((c) => statusOf(c) === 'withdrawn' && (!live[0] || c.date >= live[0].date));
    const c = live[0] || null;
    if (!c) return { req, cert: null, current: false, why: 'No certificate on record', withdrawn };
    const age = daysBetween(c.date, date);
    const current = req.session ? age === 0 && (!c.time || c.time <= time) : req.days ? age <= req.days : true;
    return { req, cert: c, age, current, withdrawn, why: current ? '' : `Last one ${age} days before. Needed ${req.window}.` };
  });
  return { items, current: items.every((i) => i.current), notCurrent: items.filter((i) => !i.current).length };
}

// Full validation scorecard used in the staff view: evidence + certificate checks.
export function scorecard(n, statusOf) {
  const s = site(n.site);
  const ev = evaluate(n, statusOf);
  const imgs = n.media.filter((m) => m.type === 'image').length;
  const checks = [
    { group: 'Evidence', label: 'Plate read matches registration', ok: n.plateConfidence >= 0.9, detail: `${Math.round(n.plateConfidence * 100)}% confidence` },
    { group: 'Evidence', label: 'Required images present', ok: imgs >= 2, detail: `${imgs} images` },
    { group: 'Evidence', label: 'Security indicators verified', ok: true, detail: 'SHA-256 on every image (mock)' },
    { group: 'Evidence', label: 'Clock synchronised', ok: true, detail: 'Within 1 second of time source' },
    s.program === 'MOBILE_PHONE'
      ? { group: 'Evidence', label: 'Image checked by a person', ok: !!n.personChecked, detail: 'Adjudicator ADJ-0412 (mock)' }
      : { group: 'Evidence', label: 'Measurement within device tolerance', ok: true, detail: n.segment ? `${n.segment.distanceKm} km surveyed` : 'Pass' },
    ...ev.items.map((i) => ({ group: 'Certification', label: i.req.label, ok: i.current, detail: i.cert ? `${i.cert.id} · ${i.age === 0 ? 'same day' : `${i.age} days before`}` : i.why, cert: i.cert })),
  ];
  return { checks, valid: checks.filter((c) => c.ok).length, total: checks.length, ev };
}

// Fines whose result changes if this certificate is withdrawn.
export function impactOf(certId, notices, statusOf) {
  const after = (c) => (c.id === certId ? 'withdrawn' : statusOf(c));
  return notices
    .map((n) => ({ n, before: evaluate(n, statusOf), after: evaluate(n, after) }))
    .filter((x) => x.before.items.some((i) => i.cert?.id === certId));
}
