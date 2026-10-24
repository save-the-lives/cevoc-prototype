import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { CASES, CERTS, TECH_SEED, staff as findStaff } from '../data.js';
import { isLive, isWithTransport, dueMs, requestedAt } from './workflow.js';
import { setTargets } from '../staff/queue/sla.js';

// Shared demo state for the browser tab, so the public site reflects staff actions.
const KEY = 'cevoc-v12-state';
const HR = 3600e3;
// Simulated events, so the feeds are not empty on first load. Everything here is prototype data.
const SEED_EVENTS = [
  { id: 'E2', at: Date.now() - 2.5 * HR, kind: 'request', to: ['tfnsw'], text: 'New technical request TR-3002 from Revenue NSW (AVG-HUM): surveyed distance', link: '/staff/request/TR-3002' },
  { id: 'E1', at: Date.now() - 20 * HR, kind: 'progress', to: ['rnsw'], text: 'TR-3001 investigation started by Jo Nguyen. Not yet answered.', link: '/staff/queue/reviews?q=case%20%3D%20%22CE-24023%22&open=1' },
];
const INITIAL = {
  certStatus: {}, pending: [], audit: [], decisions: {}, recent: [], user: null, assign: {},
  mode: 'clean', seed: 'cevoc', nonce: 0, force: {}, handoffs: false,
  tech: TECH_SEED, reopened: [], alerts: [], targets: { review: 28, court: 42, tech: 5 },
  events: SEED_EVENTS, seen: { rnsw: 0, tfnsw: 0 }, skew: 0, lastRefresh: Date.now(), feedPaused: false,
};

const now = () => new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const log = (s, who, what, ref) => [{ at: now(), who, what, ref }, ...s.audit];

const nm = (id) => findStaff(id)?.name || id;
const caseLink = (r) => `/staff/queue/reviews?q=${encodeURIComponent(`case = "${r.caseId}"`)}&open=1`;

// Add events to the feed and mark the feed as freshly updated (unless the presenter has paused it).
function emit(s, evs) {
  if (!evs?.length) return s;
  const t = Date.now();
  const made = evs.map((e, i) => ({ id: `E${t}${i}`, at: t + i, ...e }));
  return { ...s, events: [...made.reverse(), ...s.events].slice(0, 80), lastRefresh: s.feedPaused ? s.lastRefresh : t };
}

// Apply a change to one technical request, only if it is in an allowed state (so a stale click can't skip the workflow).
// Every change is logged with a time, so each agency can see time in state and last activity.
function move(s, id, from, patch, type, who, what, evs) {
  const r = s.tech.find((x) => x.id === id);
  if (!r || !from.includes(r.status)) return s;
  const next = { ...r, ...(typeof patch === 'function' ? patch(r) : patch), log: [...(r.log || []), { at: Date.now(), type, by: who }] };
  const base = { ...s, tech: s.tech.map((x) => (x.id === id ? next : x)), audit: log(s, who, `${what} (${id})`, r.caseId) };
  return emit(base, evs(next, r));
}

function reducer(s, a) {
  switch (a.type) {
    case 'signIn': return { ...s, user: a.id, audit: log(s, a.id, 'Signed in (mock SSO)') };
    case 'signOut': return { ...s, user: null };
    case 'visit': return { ...s, recent: [a.ref, ...s.recent.filter((r) => r.to !== a.ref.to)].slice(0, 6) };
    case 'request': return emit({ ...s, pending: [...s.pending, a.req], audit: log(s, a.req.by, `Requested ${a.req.kind} of ${a.req.cert}: ${a.req.reason}`, a.req.cert) }, [{ kind: 'cert', to: ['tfnsw'], text: `${a.req.kind === 'withdrawal' ? 'Withdrawal' : 'Restoration'} of ${a.req.cert} is waiting for approval (${a.req.affected} notices affected).`, link: '/staff/queue/approvals' }]);
    case 'approve': {
      const p = s.pending.find((x) => x.id === a.id);
      const alerts = a.cases?.length ? [{ id: `AL-${s.alerts.length + 1}`, cert: p.cert, kind: p.kind, cases: a.cases, at: now(), by: a.by }, ...s.alerts] : s.alerts;
      const audit = [
        { at: now(), who: 'system', what: `Revenue NSW notified: ${p.affected} fine(s) affected (simulated)`, ref: p.cert },
        { at: now(), who: a.by, what: `Approved ${p.kind} of ${p.cert}`, ref: p.cert },
        ...s.audit,
      ];
      const verb = p.kind === 'withdrawal' ? 'withdrawn' : 'restored';
      const count = a.cases?.length || 0;
      return emit({ ...s, alerts, pending: s.pending.filter((x) => x.id !== a.id), certStatus: { ...s.certStatus, [p.cert]: p.kind === 'withdrawal' ? 'withdrawn' : 'published' }, audit }, [
        { kind: 'cert', urgent: true, to: ['rnsw'], text: `Certificate ${p.cert} ${verb} by Transport: ${count} open case${count === 1 ? '' : 's'} affected.`, link: `/staff/queue/reviews?q=${encodeURIComponent(`case IN (${(a.cases || []).map((c) => `"${c}"`).join(', ')})`)}` },
        { kind: 'cert', to: ['tfnsw'], text: `Certificate ${p.cert} ${verb}: ${p.affected} notice${p.affected === 1 ? '' : 's'} and ${count} Revenue case${count === 1 ? '' : 's'} affected. Revenue NSW has been told (simulated).`, link: `/staff/cert/${p.cert}` },
      ]);
    }
    case 'reject': {
      const p = s.pending.find((x) => x.id === a.id);
      return { ...s, pending: s.pending.filter((x) => x.id !== a.id), audit: log(s, a.by, `Rejected ${p.kind} of ${p.cert}`, p.cert) };
    }
    case 'decide': { const reqs = s.tech.filter((r) => r.caseId === a.id && r.status === 'ADVICE_RECEIVED'); return emit({ ...s, reopened: s.reopened.filter((x) => x !== a.id), decisions: { ...s.decisions, [a.id]: a.d }, audit: log(s, a.d.by, `Decision on ${a.id}: ${a.d.label}`, a.id) }, reqs.map((r) => ({ kind: 'info', to: ['tfnsw'], text: `Revenue NSW made the final decision on ${a.id}. ${r.id} is complete.`, link: `/staff/request/${r.id}` }))); }
    case 'undecide': { const { [a.id]: _gone, ...rest } = s.decisions; return { ...s, decisions: rest, audit: log(s, a.by, `Undid decision on ${a.id}`, a.id) }; }
    case 'note': return { ...s, audit: log(s, a.who, a.what, a.ref) };
    case 'assign': return { ...s, assign: { ...s.assign, ...a.map }, audit: log(s, a.by, a.what, a.ref) };
    // Technical requests. Each transition checks the request is in a state that allows it, and tells the other agency.
    case 'techRequest': return emit({ ...s, tech: [a.req, ...s.tech], audit: log(s, a.req.by, `Requested technical advice (${a.req.id}) on ${a.req.caseId}: ${a.req.summary}`, a.req.caseId) },
      [{ kind: 'request', to: ['tfnsw'], text: `New technical request ${a.req.id} from Revenue NSW (${a.req.site}): ${a.req.summary}`, link: `/staff/request/${a.req.id}` }]);
    case 'techAck': return move(s, a.id, ['AWAITING_TRANSPORT'], { status: 'ACKNOWLEDGED', assignee: a.by }, 'acknowledged', a.by, 'Acknowledged the technical request',
      (r) => [{ kind: 'progress', to: ['rnsw'], text: `${r.id} acknowledged by ${nm(a.by)}. Acknowledged, not yet answered.`, link: caseLink(r) }]);
    case 'techStart': return move(s, a.id, ['ACKNOWLEDGED'], { status: 'INVESTIGATING' }, 'investigating', a.by, 'Started the technical investigation',
      (r) => [{ kind: 'progress', to: ['rnsw'], text: `Technical investigation started on ${r.id} (${r.caseId}).`, link: caseLink(r) }]);
    case 'techRespond': return move(s, a.id, ['INVESTIGATING'], { status: 'ADVICE_RECEIVED', response: a.response }, 'advice', a.response.by, 'Gave technical advice',
      (r) => [
        { kind: 'advice', urgent: true, to: ['rnsw'], text: `Transport returned advice on ${r.caseId} (${r.id}). A decision is required.`, link: caseLink(r) },
        ...(a.related || []).map((c) => ({ kind: 'related', to: ['rnsw'], text: `Advice ${r.id} may be relevant to ${c}, another case at ${r.site}.`, link: `/staff/queue/reviews?q=${encodeURIComponent(`case = "${c}"`)}&open=1` })),
      ]);
    case 'techClarify': return move(s, a.id, ['ACKNOWLEDGED', 'INVESTIGATING'], (r) => ({ status: 'MORE_INFORMATION_REQUIRED', thread: [...r.thread, { by: a.by, at: now(), text: a.text }] }), 'clarify', a.by, 'Asked Revenue NSW for more information',
      (r) => [{ kind: 'advice', urgent: true, to: ['rnsw'], text: `Transport needs more information on ${r.caseId} (${r.id}): reply to continue.`, link: caseLink(r) }]);
    case 'techReply': return move(s, a.id, ['MORE_INFORMATION_REQUIRED'], (r) => ({ status: 'INVESTIGATING', thread: [...r.thread, { by: a.by, at: now(), text: a.text }] }), 'reply', a.by, 'Replied with more information',
      (r) => [{ kind: 'request', to: ['tfnsw'], text: `Revenue NSW replied on ${r.id}. Investigation can continue.`, link: `/staff/request/${r.id}` }]);
    case 'techCancel': return move(s, a.id, ['AWAITING_TRANSPORT', 'ACKNOWLEDGED', 'INVESTIGATING', 'MORE_INFORMATION_REQUIRED'], { status: 'CANCELLED' }, 'cancelled', a.by, 'Cancelled the technical request',
      (r) => [{ kind: 'info', to: ['tfnsw'], text: `Revenue NSW cancelled ${r.id}.`, link: `/staff/request/${r.id}` }]);
    case 'techEscalate': return move(s, a.id, ['AWAITING_TRANSPORT', 'ACKNOWLEDGED', 'INVESTIGATING', 'MORE_INFORMATION_REQUIRED'], { escalated: true }, 'note', a.by, 'Escalated internally (simulated)',
      (r) => [{ kind: 'overdue', urgent: true, to: ['rnsw', 'tfnsw'], text: `${r.id} (${r.caseId}) has been escalated.`, link: `/staff/request/${r.id}` }]);
    case 'techNote': return move(s, a.id, ['AWAITING_TRANSPORT', 'ACKNOWLEDGED', 'INVESTIGATING', 'MORE_INFORMATION_REQUIRED', 'ADVICE_RECEIVED'], (r) => ({ thread: [...r.thread, { by: a.by, at: now(), text: a.text, internal: true }] }), 'note', a.by, a.text, () => []);
    case 'techAssign': return move(s, a.id, ['AWAITING_TRANSPORT', 'ACKNOWLEDGED', 'INVESTIGATING', 'MORE_INFORMATION_REQUIRED'], { assignee: a.to }, 'note', a.by, `Assigned to ${nm(a.to)}`, () => []);
    // Presenter controls: skip the clock forward, and pause or refresh the simulated live feed.
    case 'advanceDays': {
      const before = Date.now() + s.skew * 864e5; const after = before + a.days * 864e5;
      const crossed = s.tech.filter((r) => isLive(r.status) && !r.escalated && dueMs(r, s.targets.tech) >= before && dueMs(r, s.targets.tech) < after);
      return emit({ ...s, skew: s.skew + a.days }, crossed.map((r) => ({ kind: 'overdue', urgent: true, to: ['rnsw', 'tfnsw'], text: `${r.id} (${r.caseId}) is past its target response date.`, link: `/staff/request/${r.id}` })));
    }
    case 'refresh': return { ...s, lastRefresh: Date.now(), feedPaused: false };
    case 'feed': return { ...s, feedPaused: a.paused, lastRefresh: a.paused ? s.lastRefresh : Date.now() };
    case 'seen': return { ...s, seen: { ...s.seen, [a.agency]: Date.now() } };
    case 'reopen': { const { [a.id]: _gone, ...rest } = s.decisions; return { ...s, decisions: rest, reopened: [...s.reopened.filter((x) => x !== a.id), a.id], audit: log(s, a.by, `Reopened ${a.id}`, a.id) }; }
    case 'dismissAlert': return { ...s, alerts: s.alerts.filter((x) => x.id !== a.id) };
    case 'targets': return { ...s, targets: { ...s.targets, ...a.targets } };
    case 'handoffs': return { ...s, handoffs: a.on };
    case 'mode': return { ...s, mode: a.mode };
    case 'seed': return { ...s, seed: a.seed };
    case 'reshuffle': return { ...s, nonce: s.nonce + 1 };
    case 'force': return { ...s, force: { ...s.force, [a.key]: a.on } };
    case 'hydrate': return { ...s, ...a.shared };
    case 'reset': return { ...INITIAL, user: s.user, recent: s.recent };
    default: return s;
  }
}

const Ctx = createContext(null);

// Demo data is shared between browser tabs (so a Revenue window and a Transport window stay in step, like two
// officers on one system). Who is signed in stays per tab.
const ME = `${KEY}-me`;
const split = (st) => { const { user, recent, ...shared } = st; return [shared, { user, recent }]; };

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    try {
      const shared = JSON.parse(localStorage.getItem(KEY) || '{}');
      const me = JSON.parse(sessionStorage.getItem(ME) || '{}');
      return { ...INITIAL, ...shared, ...me };
    } catch (e) { return INITIAL; }
  });
  useEffect(() => {
    try {
      const [shared, me] = split(state);
      const text = JSON.stringify(shared);
      if (localStorage.getItem(KEY) !== text) localStorage.setItem(KEY, text);
      sessionStorage.setItem(ME, JSON.stringify(me));
    } catch (e) { /* ignore */ }
  }, [state]);
  useEffect(() => {
    const on = (e) => { if (e.key === KEY && e.newValue) { try { dispatch({ type: 'hydrate', shared: JSON.parse(e.newValue) }); } catch (err) { /* ignore */ } } };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);
  setTargets(state.targets); // read by slaOf() everywhere, so set before children render
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }, [state]);
  const value = useMemo(() => ({
    state, dispatch,
    statusOf: (c) => state.certStatus[c.id] || c.status,
    certStatus: (id) => state.certStatus[id] || CERTS.find((c) => c.id === id)?.status,
    faultSettings: { mode: state.mode, seed: state.seed, nonce: state.nonce, force: state.force },
  }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
