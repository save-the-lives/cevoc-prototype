import { fmtDate } from '../lib/format.js';

// What is happening with this matter, who has it, what happens next, and what the person can still do.
// Written to inform, not push: paying is one option among several, and rights are stated plainly.
const short = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function matterStatus({ n, left, openCase, ev }) {
  const due = fmtDate(n.due);
  const days = `${left} ${left === 1 ? 'day' : 'days'}`;

  if (openCase) {
    const court = openCase.type === 'court';
    const reply = fmtDate(addDays(openCase.lodged, court ? 42 : 28));
    return {
      tone: 'info', court, stage: court ? 'Court election' : 'In review',
      who: [{ name: 'Revenue NSW', role: court ? 'preparing for court' : 'deciding your review' }, ...(!court && !ev.current ? [{ name: 'Transport for NSW', role: 'may be asked to check the camera' }] : [])],
      headline: court ? 'Revenue NSW is preparing your court election.' : 'Revenue NSW is looking at your review request.',
      mini: court ? 'Revenue NSW is preparing court' : `Revenue NSW reviewing · reply by ${short(addDays(openCase.lodged, 28))}`,
      next: court ? 'The court will send you a notice of the hearing. You don’t need to do anything else for now.' : `A Revenue NSW officer will decide and write to you by ${reply}. You don’t need to do anything else for now.`,
      rights: `You can still pay${court ? '' : ' or nominate the driver'} before ${due} if you change your mind.`,
      payLabel: 'Pay now',
    };
  }
  if (left < 0) {
    return {
      tone: 'warn', stage: 'Past the due date',
      who: [{ name: 'Revenue NSW', role: 'holds this notice' }],
      headline: `The due date (${due}) has passed.`,
      mini: 'Due date passed · contact Revenue NSW',
      next: 'Revenue NSW can tell you which options are still open. Contact them as soon as you can.',
      rights: 'You may still be able to pay, ask for a review or set up a payment plan.',
      payLabel: 'See your options',
    };
  }
  return {
    tone: left <= 7 ? 'warn' : 'info', stage: 'Waiting for you',
    who: [{ name: 'Revenue NSW', role: 'holds this notice' }],
    headline: 'This notice is with Revenue NSW. Nothing happens until you decide.',
    mini: `With Revenue NSW · decide by ${short(n.due)} (${days})`,
    next: `Take the time you need. You have until ${due}, which is ${days} away.`,
    rights: 'If you agree it happened, you can pay now. You can also ask for a review, nominate the driver or have a court decide, up to the same date.',
    payLabel: 'Pay now',
  };
}
