import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { CERTS, TECH_SEED } from '../data.js';
import { setTargets } from '../staff/queue/sla.js';

// Shared demo state for the browser tab, so the public site reflects staff actions.
const KEY = 'cevoc-v12-state';
const INITIAL = {
  certStatus: {}, pending: [], audit: [], decisions: {}, recent: [], user: null, assign: {},
  mode: 'clean', seed: 'cevoc', nonce: 0, force: {}, handoffs: false,
  tech: TECH_SEED, reopened: [], alerts: [], targets: { review: 28, court: 42, tech: 5 },
};

const now = () => new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const log = (s, who, what, ref) => [{ at: now(), who, what, ref }, ...s.audit];

// Apply a change to one technical request, only if it is in an allowed state (so a stale click can't skip the workflow).
function upd(s, id, from, fn, who, what) {
  const r = s.tech.find((x) => x.id === id);
  if (!r || !from.includes(r.status)) return s;
  return { ...s, tech: s.tech.map((x) => (x.id === id ? fn(x) : x)), audit: log(s, who, `${what} (${id})`, r.caseId) };
}

function reducer(s, a) {
  switch (a.type) {
    case 'signIn': return { ...s, user: a.id, audit: log(s, a.id, 'Signed in (mock SSO)') };
    case 'signOut': return { ...s, user: null };
    case 'visit': return { ...s, recent: [a.ref, ...s.recent.filter((r) => r.to !== a.ref.to)].slice(0, 6) };
    case 'request': return { ...s, pending: [...s.pending, a.req], audit: log(s, a.req.by, `Requested ${a.req.kind} of ${a.req.cert}: ${a.req.reason}`, a.req.cert) };
    case 'approve': {
      const p = s.pending.find((x) => x.id === a.id);
      const alerts = a.cases?.length ? [{ id: `AL-${s.alerts.length + 1}`, cert: p.cert, kind: p.kind, cases: a.cases, at: now(), by: a.by }, ...s.alerts] : s.alerts;
      const audit = [
        { at: now(), who: 'system', what: `Revenue NSW notified: ${p.affected} fine(s) affected (simulated)`, ref: p.cert },
        { at: now(), who: a.by, what: `Approved ${p.kind} of ${p.cert}`, ref: p.cert },
        ...s.audit,
      ];
      return { ...s, alerts, pending: s.pending.filter((x) => x.id !== a.id), certStatus: { ...s.certStatus, [p.cert]: p.kind === 'withdrawal' ? 'withdrawn' : 'published' }, audit };
    }
    case 'reject': {
      const p = s.pending.find((x) => x.id === a.id);
      return { ...s, pending: s.pending.filter((x) => x.id !== a.id), audit: log(s, a.by, `Rejected ${p.kind} of ${p.cert}`, p.cert) };
    }
    case 'decide': return { ...s, reopened: s.reopened.filter((x) => x !== a.id), decisions: { ...s.decisions, [a.id]: a.d }, audit: log(s, a.d.by, `Decision on ${a.id}: ${a.d.label}`, a.id) };
    case 'undecide': { const { [a.id]: _gone, ...rest } = s.decisions; return { ...s, decisions: rest, audit: log(s, a.by, `Undid decision on ${a.id}`, a.id) }; }
    case 'note': return { ...s, audit: log(s, a.who, a.what, a.ref) };
    case 'assign': return { ...s, assign: { ...s.assign, ...a.map }, audit: log(s, a.by, a.what, a.ref) };
    // Technical requests. Each transition checks the request is in a state that allows it.
    case 'techRequest': return { ...s, tech: [a.req, ...s.tech], audit: log(s, a.req.by, `Requested technical advice (${a.req.id}) on ${a.req.caseId}: ${a.req.summary}`, a.req.caseId) };
    case 'techRespond': return upd(s, a.id, ['AWAITING_TRANSPORT'], (r) => ({ ...r, status: 'ADVICE_RECEIVED', response: a.response }), a.response.by, 'Gave technical advice');
    case 'techClarify': return upd(s, a.id, ['AWAITING_TRANSPORT'], (r) => ({ ...r, status: 'MORE_INFORMATION_REQUIRED', thread: [...r.thread, { by: a.by, at: now(), text: a.text }] }), a.by, 'Asked Revenue NSW for more information');
    case 'techReply': return upd(s, a.id, ['MORE_INFORMATION_REQUIRED'], (r) => ({ ...r, status: 'AWAITING_TRANSPORT', thread: [...r.thread, { by: a.by, at: now(), text: a.text }] }), a.by, 'Replied with more information');
    case 'techCancel': return upd(s, a.id, ['AWAITING_TRANSPORT', 'MORE_INFORMATION_REQUIRED'], (r) => ({ ...r, status: 'CANCELLED' }), a.by, 'Cancelled the technical request');
    case 'techNote': return upd(s, a.id, ['AWAITING_TRANSPORT', 'MORE_INFORMATION_REQUIRED', 'ADVICE_RECEIVED'], (r) => ({ ...r, thread: [...r.thread, { by: a.by, at: now(), text: a.text, internal: true }] }), a.by, a.text);
    case 'techAssign': return upd(s, a.id, ['AWAITING_TRANSPORT', 'MORE_INFORMATION_REQUIRED'], (r) => ({ ...r, assignee: a.to }), a.by, `Assigned to ${a.to}`);
    case 'reopen': { const { [a.id]: _gone, ...rest } = s.decisions; return { ...s, decisions: rest, reopened: [...s.reopened.filter((x) => x !== a.id), a.id], audit: log(s, a.by, `Reopened ${a.id}`, a.id) }; }
    case 'dismissAlert': return { ...s, alerts: s.alerts.filter((x) => x.id !== a.id) };
    case 'targets': return { ...s, targets: { ...s.targets, ...a.targets } };
    case 'handoffs': return { ...s, handoffs: a.on };
    case 'mode': return { ...s, mode: a.mode };
    case 'seed': return { ...s, seed: a.seed };
    case 'reshuffle': return { ...s, nonce: s.nonce + 1 };
    case 'force': return { ...s, force: { ...s.force, [a.key]: a.on } };
    case 'reset': return { ...INITIAL };
    default: return s;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    try { return { ...INITIAL, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') }; } catch (e) { return INITIAL; }
  });
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
