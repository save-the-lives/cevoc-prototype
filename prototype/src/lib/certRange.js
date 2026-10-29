import { CERTS, site as findSite } from '../data.js';
import { evaluate } from './rules.js';

// Was this camera's certification current across a date range? Checked day by day with the same rules used for a
// penalty notice, then grouped into runs so the answer reads "current 1 Jul to 29 Aug, not current 30 Aug to 4 Sep".
const iso = (d) => d.toISOString().slice(0, 10);
export const MAX_DAYS = 366;

export function certRange(code, from, to, statusOf) {
  const s = findSite(code);
  if (!s) return null;
  const spans = [];
  const start = new Date(`${from}T12:00:00`); const end = new Date(`${to}T12:00:00`);
  let days = 0;
  for (let d = new Date(start); d <= end && days < MAX_DAYS; d.setDate(d.getDate() + 1), days += 1) {
    const day = iso(d);
    const ev = evaluate({ site: code, dateTime: `${day}T12:00:00` }, statusOf);
    const lapsed = ev.items.filter((i) => !i.current).map((i) => i.req.label);
    const key = `${ev.current}|${lapsed.join('+')}`;
    const last = spans[spans.length - 1];
    if (last && last.key === key) last.to = day;
    else spans.push({ key, from: day, to: day, current: ev.current, lapsed });
  }
  const certs = CERTS.filter((c) => c.site === code).sort((a, b) => b.date.localeCompare(a.date)).map((c) => ({ ...c, status: statusOf(c) }));
  return { site: s, spans, certs, days, truncated: days >= MAX_DAYS && new Date(`${to}T12:00:00`) > new Date(start.getTime() + MAX_DAYS * 864e5) };
}
