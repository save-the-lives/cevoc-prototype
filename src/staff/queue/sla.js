import { TODAY } from '../../lib/format.js';
import { daysBetween } from '../../lib/rules.js';

const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// How long the customer has been waiting since they asked for the review, against the target reply time
// (28 days for reviews, 42 for court elections). The tone shows how close the wait is to the target.
export function slaOf(c) {
  const target = c.type === 'court' ? 42 : 28;
  const waited = Math.max(daysBetween(c.lodged, TODAY), 0);
  const due = addDays(c.lodged, target);
  const left = target - waited;
  return {
    waited, target, due, left,
    label: waited === 0 ? 'Today' : `${waited} day${waited === 1 ? '' : 's'}`,
    tone: left < 0 ? 'danger' : waited >= target * 0.75 ? 'warning' : 'grey',
    hint: left < 0 ? `${-left} days past the ${target}-day target` : left === 0 ? 'Target reply is due today' : `${left} days until the ${target}-day target`,
  };
}

export const PRIORITY = { high: { rank: 0, label: 'High', tone: 'danger' }, normal: { rank: 1, label: 'Normal', tone: 'grey' }, low: { rank: 2, label: 'Low', tone: 'grey' } };
