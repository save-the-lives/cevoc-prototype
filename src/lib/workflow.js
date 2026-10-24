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
export const REQUEST_STATUS = {
  AWAITING_TRANSPORT: { label: 'Open', tone: 'warning' },
  MORE_INFORMATION_REQUIRED: { label: 'Awaiting Revenue NSW', tone: 'grey' },
  ADVICE_RECEIVED: { label: 'Answered', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'grey' },
};
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
  if (r?.status === 'AWAITING_TRANSPORT') return 'AWAITING_TRANSPORT';
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
