import { TODAY } from '../../lib/format.js';
import { daysBetween } from '../../lib/rules.js';

const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// Service level: reviews are due 28 days after lodging, court elections 42 days.
export function slaOf(c) {
  const due = addDays(c.lodged, c.type === 'court' ? 42 : 28);
  const days = daysBetween(TODAY, due);
  return {
    due, days,
    label: days < 0 ? `Overdue ${-days}d` : days === 0 ? 'Due today' : `${days}d left`,
    tone: days < 0 ? 'danger' : days <= 7 ? 'warning' : 'grey',
  };
}

export const PRIORITY = { high: { rank: 0, label: 'High', tone: 'danger' }, normal: { rank: 1, label: 'Normal', tone: 'grey' }, low: { rank: 2, label: 'Low', tone: 'grey' } };
