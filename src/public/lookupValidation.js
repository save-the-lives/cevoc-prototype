// Validation for the two details that find a notice. Messages say what is wrong and how to fix it, in plain words.
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const YEARS_BACK = 3;

export const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const isoToParts = (iso) => (iso ? { d: String(Number(iso.slice(8, 10))), m: String(Number(iso.slice(5, 7))), y: iso.slice(0, 4) } : { d: '', m: '', y: '' });
export const daysIn = (m, y) => new Date(y, m, 0).getDate();
export const todayIso = () => toIso(new Date());
export const earliestIso = () => { const t = new Date(); t.setFullYear(t.getFullYear() - YEARS_BACK); return toIso(t); };

export const cleanNotice = (s) => s.replace(/[\s-]/g, '');

export function checkNotice(raw) {
  const n = cleanNotice(raw);
  if (!n) return 'Enter the penalty notice number';
  if (/\D/.test(n)) return 'The penalty notice number can only contain numbers';
  if (n.length !== 10) return `The penalty notice number must be 10 digits. You entered ${n.length}`;
  return null;
}

// Returns { msg, bad: ['d'|'m'|'y'...] } or null when the date is a real date in the allowed range.
export function checkDate({ d, m, y }, min = earliestIso(), max = todayIso()) {
  const all = { d: d.trim(), m: m.trim(), y: y.trim() };
  const empty = ['d', 'm', 'y'].filter((k) => !all[k]);
  if (empty.length === 3) return { msg: 'Enter the date of the offence', bad: ['d', 'm', 'y'] };
  if (empty.length) {
    const name = { d: 'day', m: 'month', y: 'year' };
    const list = empty.map((k) => name[k]);
    return { msg: `The date must include a ${list.join(' and a ')}`, bad: empty };
  }
  const nonNum = ['d', 'm', 'y'].filter((k) => /\D/.test(all[k]));
  if (nonNum.length) return { msg: 'The date can only contain numbers, for example 2 9 2026', bad: nonNum };
  const day = Number(all.d); const mon = Number(all.m); const yr = Number(all.y);
  if (all.y.length !== 4) return { msg: 'The year must have 4 digits, for example 2026', bad: ['y'] };
  if (mon < 1 || mon > 12) return { msg: 'The month must be between 1 and 12', bad: ['m'] };
  if (day < 1 || day > daysIn(mon, yr)) return { msg: `Enter a real date. ${MONTHS[mon - 1]} ${yr} doesn’t have a day ${day}`, bad: ['d'] };
  const iso = `${all.y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (iso > max) return { msg: 'The date of the offence must be in the past', bad: ['d', 'm', 'y'] };
  if (iso < min) return { msg: `The date of the offence must be within the last ${YEARS_BACK} years`, bad: ['d', 'm', 'y'] };
  return null;
}

export const partsToIso = ({ d, m, y }) => `${y.trim()}-${String(Number(m)).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`;
