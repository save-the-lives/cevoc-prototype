import { CASES, NOTICES, TECH_CATEGORIES, site as findSite } from '../data.js';
import { classifyMedia } from './media.js';
import { impactOf } from './rules.js';

// The case workflow, worked out from what has happened rather than stored twice:
//   OPEN -> TRIAGE -> (referred to Transport) -> determination received -> RESOLVED
// Revenue NSW resolves what is within its authority. Where a technical or certification question decides whether
// enforcement stands, Revenue NSW refers it; Transport holds the authority to determine (including to authorise
// withdrawal), and Revenue NSW is informed and carries out its own downstream steps. CEVOC does not own those steps.
export const CASE_STATE = {
  OPEN: { label: 'Open', token: 'open', tone: 'grey' },
  TRIAGE: { label: 'In triage', token: 'triage', tone: 'primary' },
  AWAITING_TRANSPORT: { label: 'Referred to Transport', token: 'awaiting', tone: 'primary' },
  MORE_INFORMATION_REQUIRED: { label: 'Transport needs more information', token: 'more-info', tone: 'warning' },
  ADVICE_RECEIVED: { label: 'Determination received', token: 'advice', tone: 'warning' },
  REOPENED: { label: 'Reopened', token: 'reopened', tone: 'warning' },
  DECIDED: { label: 'Resolved', token: 'decided', tone: 'grey' },
};
// A referral moves Referred -> Acknowledged -> Under assessment -> (recommendation) -> Determination issued -> Revenue downstream action.
// Being acknowledged is not being assessed, and a recommendation is not a determination.
export const REQUEST_STATUS = {
  AWAITING_TRANSPORT: { label: 'Referred', tone: 'primary', stage: 0 },
  ACKNOWLEDGED: { label: 'Acknowledged', tone: 'primary', stage: 1 },
  INVESTIGATING: { label: 'Under assessment', tone: 'primary', stage: 2 },
  AWAITING_DETERMINATION: { label: 'Awaiting determination', tone: 'warning', stage: 2 },
  MORE_INFORMATION_REQUIRED: { label: 'Awaiting Revenue NSW', tone: 'grey', stage: 2 },
  ADVICE_RECEIVED: { label: 'Determination issued', tone: 'primary', stage: 3 },
  CANCELLED: { label: 'Cancelled', tone: 'grey', stage: -1 },
};
export const LIFECYCLE = ['Revenue referral', 'Transport acknowledgement', 'Technical assessment', 'Determination issued', 'Revenue downstream action'];
export const WITH_TRANSPORT = ['AWAITING_TRANSPORT', 'ACKNOWLEDGED', 'INVESTIGATING', 'AWAITING_DETERMINATION'];
export const isWithTransport = (s) => WITH_TRANSPORT.includes(s);
export const isLive = (s) => s !== 'ADVICE_RECEIVED' && s !== 'CANCELLED';

// What a Transport determination can say. These are conceptual outcome categories: formal terminology and legal meaning need business confirmation.
export const DETERMINATION = {
  supportable: 'Enforcement remains supportable',
  withdrawal: 'Withdrawal authorised',
  'further-info': 'Further information required',
  'court-support': 'Defence support provided (the court process is outside CEVOC)',
};
export const DETERMINATION_TONE = { supportable: 'primary', withdrawal: 'warning', 'further-info': 'grey', 'court-support': 'primary' };

const DAY = 864e5;
// The prototype's clock: real time plus whatever the presenter has skipped forward (demo hub > Controls).
export const nowMs = (skew = 0) => Date.now() + skew * DAY;
export const requestedAt = (r) => r.log?.[0]?.at || new Date(`${r.at}T09:00:00`).getTime();
export const lastActivityAt = (r) => r.log?.[r.log.length - 1]?.at || requestedAt(r);
const STATE_TYPES = ['requested', 'acknowledged', 'investigating', 'assessed', 'determination', 'actioned', 'clarify', 'reply', 'advice', 'cancelled'];
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
// None | Due soon (within a day of the internal target) | Overdue | Escalated. Targets are illustrative and configurable, not statutory.
export function escalation(r, now, days) {
  if (!isLive(r.status)) return { level: 'none', label: 'None', tone: 'grey' };
  if (r.escalated) return { level: 'escalated', label: 'Escalated', tone: 'danger' };
  const left = dueMs(r, days) - now;
  if (left < 0) return { level: 'overdue', label: 'Past internal target', tone: 'danger' };
  if (left < DAY) return { level: 'soon', label: 'Nearing internal target', tone: 'warning' };
  return { level: 'none', label: 'Within target', tone: 'grey' };
}
export function nextRequired(r, decided) {
  switch (r.status) {
    case 'AWAITING_TRANSPORT': return { who: 'Transport', text: 'Acknowledge the referral' };
    case 'ACKNOWLEDGED': return { who: 'Transport', text: 'Start the technical assessment' };
    case 'INVESTIGATING': return { who: 'Transport', text: 'Record an assessment' };
    case 'AWAITING_DETERMINATION': return { who: 'Transport (authorised role)', text: 'Issue a determination' };
    case 'MORE_INFORMATION_REQUIRED': return { who: 'Revenue NSW', text: 'Reply to Transport’s question' };
    case 'ADVICE_RECEIVED': return r.actioned || decided ? { who: 'Nobody', text: 'Complete' } : { who: 'Revenue NSW', text: 'Carry out downstream steps in Revenue systems' };
    default: return { who: 'Nobody', text: 'Nothing' };
  }
}
export const RECOMMENDATION = {
  valid: 'Assessment: the evidence and certification support continued enforcement',
  invalid: 'Assessment: a technical or certification issue may justify withdrawal',
  inconclusive: 'Assessment: inconclusive, more work needed',
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

// Certification validity on the offence date. A check that has not finished, or failed, is never shown as valid.
// Validity is only one of four separate things (see matterStatus): it says nothing about whether enforcement is defensible.
export function validationOf(ev, status = 'ready') {
  if (status === 'loading' || status === 'slow') return { label: 'Checking…', tone: 'grey', short: 'Certificate check still running' };
  if (status !== 'ready') return { label: 'Unavailable', tone: 'grey', short: 'Certificate check failed or not available. Do not treat as valid.' };
  return ev.current ? { label: 'Valid', tone: 'success', short: 'Certificates valid on the offence date' } : { label: 'Not valid', tone: 'warning', short: `${ev.notCurrent} certificate${ev.notCurrent > 1 ? 's' : ''} not valid on the offence date` };
}

// Four separate questions, never merged into one traffic light:
//   certification validity | evidence completeness | assessment status | enforcement defensibility.
// Only a Transport determination can say anything about defensibility. Before that it is "Not assessed", and it is never green.
export function matterStatus({ n, ev, validation, req }) {
  const kinds = new Set(classifyMedia(n.media, findSite(n.site).program).map((m) => m.kind));
  const needs = findSite(n.site).program === 'MOBILE_PHONE' ? ['prime'] : ['prime', 'id'];
  const missing = needs.filter((k) => !kinds.has(k));
  const evidence = missing.length ? { label: 'Incomplete', tone: 'warning', short: `Missing: ${missing.map((k) => (k === 'id' ? 'number plate image' : 'offence image')).join(', ')}` } : { label: 'Complete', tone: 'grey', short: `${n.media.length} item${n.media.length === 1 ? '' : 's'} on record` };
  let assessment = { label: 'Not assessed', tone: 'grey', short: 'No technical assessment requested' };
  let defensibility = { label: 'Not assessed', tone: 'grey', short: 'Only a Transport determination can assess this' };
  if (req) {
    const st = req.status;
    assessment = st === 'ADVICE_RECEIVED' ? { label: 'Determination issued', tone: 'primary', short: `By ${req.response?.by ? 'an authorised Transport role' : 'Transport'}` }
      : st === 'AWAITING_DETERMINATION' ? { label: 'Recommendation recorded', tone: 'warning', short: 'Waiting for an authorised determination' }
      : st === 'INVESTIGATING' ? { label: 'In progress', tone: 'primary', short: 'Transport is assessing' }
      : st === 'MORE_INFORMATION_REQUIRED' ? { label: 'Needs information', tone: 'warning', short: 'Transport asked Revenue NSW a question' }
      : st === 'CANCELLED' ? { label: 'Not assessed', tone: 'grey', short: 'Referral cancelled' }
      : { label: 'Referred', tone: 'primary', short: st === 'ACKNOWLEDGED' ? 'Acknowledged, not started' : 'Not yet acknowledged' };
    if (st === 'ADVICE_RECEIVED' && req.response?.outcome) {
      const o = req.response.outcome;
      defensibility = { label: DETERMINATION[o]?.split(' (')[0] || o, tone: o === 'withdrawal' ? 'warning' : o === 'further-info' ? 'grey' : 'primary', short: 'Transport determination' };
    }
  }
  return { certification: validation, evidence, assessment, defensibility };
}

export function nextAction(st, validation) {
  if (st === 'DECIDED') return { label: 'Done', tone: 'grey' };
  if (st === 'AWAITING_TRANSPORT') return { label: 'Follow up', tone: 'grey' };
  if (st === 'MORE_INFORMATION_REQUIRED') return { label: 'Reply to Transport', tone: 'warning' };
  if (st === 'ADVICE_RECEIVED') return { label: 'Action downstream', tone: 'primary' };
  if (st === 'REOPENED') return { label: 'Resume', tone: 'warning' };
  if (st === 'TRIAGE') return { label: validation.label === 'Valid' ? 'Resolve' : 'Review', tone: 'primary' };
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
