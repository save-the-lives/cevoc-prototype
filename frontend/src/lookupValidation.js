// Validation for the details that find a notice. Messages say what is wrong and how to fix it, in plain words.
import settings from '../../settings.json';
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MAX_OFFENCE_AGE_YEARS = settings.maxOffenceAgeYears;
export const YEARS_BACK = MAX_OFFENCE_AGE_YEARS;

const pad = (n) => String(n).padStart(2, '0');
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const daysIn = (m, y) => new Date(y, m, 0).getDate();
export const todayIso = (now = new Date()) => toIso(now);
export const earliestIso = (now = new Date()) => { const t = new Date(now); t.setFullYear(t.getFullYear() - YEARS_BACK); return toIso(t); };

export const cleanNotice = (s) => String(s || '').replace(/[\s-]/g, '');

/** Letters and digits only, no spaces or dashes, upper case. Empty when nothing usable. */
export const cleanRegistration = (s) => String(s || '').replace(/[\s-]/g, '').toUpperCase();

export function checkNotice(raw) {
  const n = cleanNotice(raw);
  if (!n) return 'Enter the penalty notice number';
  if (/\D/.test(n)) return 'The penalty notice number can only contain numbers';
  if (n.length !== 10) return `The penalty notice number must be 10 digits. You entered ${n.length}`;
  return null;
}

/** Optional. Returns a message when something is typed that cannot be a registration number, else null. */
export function checkRegistration(raw) {
  const r = cleanRegistration(raw);
  if (!r) return 'Enter the vehicle registration from your penalty notice';
  if (!/^[A-Z0-9]+$/.test(r)) return 'The vehicle registration can only contain letters and numbers';
  if (r.length > 8) return 'The vehicle registration can have up to 8 characters';
  return null;
}

/** Returns { msg, bad: ['d'|'m'|'y'...] } or null when the date is a real date in the allowed range. */
export function checkDate({ d, m, y }, now = new Date(), what = 'date of the offence') {
  const min = earliestIso(now); const max = todayIso(now);
  const all = { d: d.trim(), m: m.trim(), y: y.trim() };
  const empty = ['d', 'm', 'y'].filter((k) => !all[k]);
  if (empty.length === 3) return { msg: `Enter the ${what}`, bad: ['d', 'm', 'y'] };
  if (empty.length) {
    const name = { d: 'day', m: 'month', y: 'year' };
    return { msg: `The date must include a ${empty.map((k) => name[k]).join(' and a ')}`, bad: empty };
  }
  const nonNum = ['d', 'm', 'y'].filter((k) => /\D/.test(all[k]));
  if (nonNum.length) return { msg: 'The date can only contain numbers, for example 2 9 2026', bad: nonNum };
  const day = Number(all.d); const mon = Number(all.m); const yr = Number(all.y);
  if (all.y.length !== 4) return { msg: 'The year must have 4 digits, for example 2026', bad: ['y'] };
  if (mon < 1 || mon > 12) return { msg: 'The month must be between 1 and 12', bad: ['m'] };
  if (day < 1 || day > daysIn(mon, yr)) return { msg: `Enter a real date. ${MONTHS[mon - 1]} ${yr} doesn’t have a day ${day}`, bad: ['d'] };
  const iso = `${all.y}-${pad(mon)}-${pad(day)}`;
  if (iso > max) return { msg: `The ${what} must be in the past`, bad: ['d', 'm', 'y'] };
  if (iso < min) return { msg: `The ${what} must be within the last ${YEARS_BACK} years`, bad: ['d', 'm', 'y'] };
  return null;
}

export const partsToIso = ({ d, m, y }) => `${y.trim()}-${pad(Number(m))}-${pad(Number(d))}`;
export const isoToParts = (iso) => (iso ? { d: String(Number(iso.slice(8, 10))), m: String(Number(iso.slice(5, 7))), y: iso.slice(0, 4) } : { d: '', m: '', y: '' });

/** What the form shows again after Edit or Back: the notice number and date only. The plate is never part of a draft. */
export const draftFromQuery = (q) => (q ? { num: q.infringementNumber || '', parts: isoToParts(q.offenceDate) } : { num: '', parts: { d: '', m: '', y: '' } });
