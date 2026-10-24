import { CASES, NOTICES, TECH_CATEGORIES } from '../data.js';
import { impactOf } from './rules.js';

// The Revenue NSW case workflow, worked out from what has happened rather than stored twice:
//   OPEN -> TRIAGE -> AWAITING_TRANSPORT -> ADVICE_RECEIVED -> DECIDED
// with MORE_INFORMATION_REQUIRED (Transport asked a question back), REOPENED and cancelled requests.
// A technical request is advice only. Only a Revenue NSW decision moves a case to DECIDED.
export const CASE_STATE = {
  OPEN: { label: 'Open', token: 'open', tone: 'grey' },
  TRIAGE: { label: 'In triage', token: 'triage', tone: 'primary' },
  AWAITING_TRANSPORT: { label: 'Awaiting Transport advice', token: 'awaiting', tone: 'warning' },
  MORE_INFORMATION_REQUIRED: { label: 'Transport needs more information', token: 'more-info', tone: 'warning' },
  ADVICE_RECEIVED: { label: 'Advice received', token: 'advice', tone: 'success' },
  REOPENED: { label: 'Reopened', token: 'reopened', tone: 'danger' },
  DECIDED: { label: 'Decided', token: 'decided', tone: 'primary' },
};
// A request moves Requested -> Acknowledged -> Investigating -> Advice returned. Being acknowledged is not being answered.
export const REQUEST_STATUS = {
  AWAITING_TRANSPORT: { label: 'Requested', tone: 'warning', stage: 0 },
  ACKNOWLEDGED: { label: 'Acknowledged', tone: 'primary', stage: 1 },
  INVESTIGATING: { label: 'Investigating', tone: 'primary', stage: 2 },
  MORE_INFORMATION_REQUIRED: { label: 'Awaiting Revenue NSW', tone: 'grey', stage: 2 },
  ADVICE_RECEIVED: { label: 'Advice returned', tone: 'success', stage: 3 },
  CANCELLED: { label: 'Cancelled', tone: 'grey', stage: -1 },
};
export const LIFECYCLE = ['Revenue request', 'Transport acknowledgement', 'Technical investigation', 'Advice returned', 'Revenue resolution'];
export const WITH_TRANSPORT = ['AWAITING_TRANSPORT', 'ACKNOWLEDGED', 'INVESTIGATING'];
export const isWithTransport = (s) => WITH_TRANSPORT.includes(s);
export const isLive = (s) => s !== 'ADVICE_RECEIVED' && s !== 'CANCELLED';

const DAY = 864e5;
// The prototype's clock: real time plus whatever the presenter has skipped forward (demo hub > Controls).
export const nowMs = (skew = 0) => Date.now() + skew * DAY;
export const requestedAt = (r) => r.log?.[0]?.at || new Date(`${r.at}T09:00:00`).getTime();
export const lastActivityAt = (r) => r.log?.[r.log.length - 1]?.at || requestedAt(r);
const STATE_TYPES = ['requested', 'acknowledged', 'investigating', 'clarify', 'reply', 'advice', 'cancelled'];
export const inStateSince = (r) => [...(r.log || [])].reverse().find((l) => STATE_TYPES.includes(l.type))?.at || requestedAt(r);
export const dueMs = (r, days) => requestedAt(r) + days * DAY;
export function human(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}
// None | Due soon (within a day of the target) | Overdue | Escalated (manually, or overdue and still unanswered).
export function escalation(r, now, days) {
  if (!isLive(r.status)) return { level: 'none', label: 'None', tone: 'grey' };
  if (r.escalated) return { level: 'escalated', label: 'Escalated', tone: 'danger' };
  const left = dueMs(r, days) - now;
  if (left < 0) return { level: 'overdue', label: 'Overdue', tone: 'danger' };
  if (left < DAY) return { level: 'soon', label: 'Due soon', tone: 'warning' };
  return { level: 'none', label: 'On track', tone: 'grey' };
}
export function nextRequired(r, decided) {
  switch (r.status) {
    case 'AWAITING_TRANSPORT': return { who: 'Transport', text: 'Acknowledge the request' };
    case 'ACKNOWLEDGED': return { who: 'Transport', text: 'Start the technical investigation' };
    case 'INVESTIGATING': return { who: 'Transport', text: 'Provide technical advice' };
    case 'MORE_INFORMATION_REQUIRED': return { who: 'Revenue NSW', text: 'Reply to Transport’s question' };
    case 'ADVICE_RECEIVED': return decided ? { who: 'Nobody', text: 'Complete. Revenue NSW has decided' } : { who: 'Revenue NSW', text: 'Make the final decision' };
    default: return { who: 'Nobody', text: 'Nothing' };
  }
}
export const RECOMMENDATION = {
  valid: 'The certification or evidence is valid for this notice',
  invalid: 'Do not rely on the certification or evidence for this notice',
  inconclusive: 'Inconclusive: further technical work is needed',
};
export const categoryLabel = (id) => TECH_CATEGORIES.find((c) => c[0] === id)?.[1] || id;

export const requestsFor = (tech, caseId) => tech.filter((r) => r.caseId === caseId && r.status !== 'CANCELLED');
export const activeRequest = (tech, caseId) => requestsFor(tech, caseId).find((r) => r.status !== 'ADVICE_RECEIVED') || requestsFor(tech, caseId)[0] || null;

export function caseState(id, state, assignee) {
  if (state.decisions[id]) return 'DECIDED';
  const r = requestsFor(state.tech, id)[0];
  if (r && isWithTransport(r.status)) return 'AWAITING_TRANSPORT';
  if (r?.status === 'MORE_INFORMATION_REQUIRED') return 'MORE_INFORMATION_REQUIRED';
  if (r?.status === 'ADVICE_RECEIVED') return 'ADVICE_RECEIVED';
  if (state.reopened.includes(id)) return 'REOPENED';
  return assignee ? 'TRIAGE' : 'OPEN';
}

// Validation as the Revenue officer sees it. A check that has not finished or failed is never shown as clear.
export function validationOf(ev, status = 'ready') {
  if (status === 'loading' || status === 'slow') return { label: 'Checking…', tone: 'grey', short: 'Certificate check still running' };
  if (status !== 'ready') return { label: 'Unavailable', tone: 'grey', short: 'Certificate check failed or not available. Do not treat as clear.' };
  return ev.current ? { label: 'Clear', tone: 'success', short: 'Certification current on the day' } : { label: 'Review required', tone: 'warning', short: `${ev.notCurrent} certificate${ev.notCurrent > 1 ? 's' : ''} not current on the day` };
}

export function nextAction(st, validation) {
  if (st === 'DECIDED') return { label: 'Done', tone: 'grey' };
  if (st === 'AWAITING_TRANSPORT') return { label: 'Follow up', tone: 'grey' };
  if (st === 'MORE_INFORMATION_REQUIRED') return { label: 'Reply to Transport', tone: 'warning' };
  if (st === 'ADVICE_RECEIVED') return { label: 'Resolve with advice', tone: 'success' };
  if (st === 'REOPENED') return { label: 'Resume', tone: 'warning' };
  if (st === 'TRIAGE') return { label: validation.label === 'Clear' ? 'Resolve' : 'Review', tone: 'primary' };
  return { label: 'Assess', tone: 'grey' };
}

// Earlier answered advice for the same camera. It is offered for the officer to read and judge, never applied automatically.
export const relatedAdvice = (tech, site, caseId) => tech.filter((r) => r.status === 'ADVICE_RECEIVED' && r.site === site && r.caseId !== caseId);

// How far a technical question reaches: this notice only, other notices at the same camera, or a pattern.
export function impactLevel(req, tech) {
  const same = tech.filter((r) => r.site === req.site && r.status !== 'CANCELLED');
  const notices = new Set(NOTICES.filter((n) => n.site === req.site).map((n) => n.number)).size;
  if (same.length >= 3) return 'Systemic';
  if (same.length > 1 || notices > 1) return 'Multiple';
  return 'Single notice';
}

// Open Revenue cases that rely on a certificate, for the notice to Revenue NSW when it is withdrawn.
export function affectedCases(certId, statusOf, decisions) {
  const nums = impactOf(certId, NOTICES, statusOf).map((x) => x.n.number);
  return CASES.filter((c) => nums.includes(c.notice) && !decisions[c.id]).map((c) => c.id);
}
