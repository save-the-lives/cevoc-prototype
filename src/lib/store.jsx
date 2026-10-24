import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { CERTS } from '../data.js';

// Shared demo state for the browser tab, so the public site reflects staff actions.
const KEY = 'cevoc-v11-state';
const INITIAL = {
  certStatus: {}, pending: [], audit: [], decisions: {}, recent: [], user: null, assign: {},
  mode: 'clean', seed: 'cevoc', nonce: 0, force: {},
};

const now = () => new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const log = (s, who, what, ref) => [{ at: now(), who, what, ref }, ...s.audit];

function reducer(s, a) {
  switch (a.type) {
    case 'signIn': return { ...s, user: a.id, audit: log(s, a.id, 'Signed in (mock SSO)') };
    case 'signOut': return { ...s, user: null };
    case 'visit': return { ...s, recent: [a.ref, ...s.recent.filter((r) => r.to !== a.ref.to)].slice(0, 6) };
    case 'request': return { ...s, pending: [...s.pending, a.req], audit: log(s, a.req.by, `Requested ${a.req.kind} of ${a.req.cert}: ${a.req.reason}`, a.req.cert) };
    case 'approve': {
      const p = s.pending.find((x) => x.id === a.id);
      const audit = [
        { at: now(), who: 'system', what: `Revenue NSW notified: ${p.affected} fine(s) affected (simulated)`, ref: p.cert },
        { at: now(), who: a.by, what: `Approved ${p.kind} of ${p.cert}`, ref: p.cert },
        ...s.audit,
      ];
      return { ...s, pending: s.pending.filter((x) => x.id !== a.id), certStatus: { ...s.certStatus, [p.cert]: p.kind === 'withdrawal' ? 'withdrawn' : 'published' }, audit };
    }
    case 'reject': {
      const p = s.pending.find((x) => x.id === a.id);
      return { ...s, pending: s.pending.filter((x) => x.id !== a.id), audit: log(s, a.by, `Rejected ${p.kind} of ${p.cert}`, p.cert) };
    }
    case 'decide': return { ...s, decisions: { ...s.decisions, [a.id]: a.d }, audit: log(s, a.d.by, `Decision on ${a.id}: ${a.d.label}`, a.id) };
    case 'undecide': { const { [a.id]: _gone, ...rest } = s.decisions; return { ...s, decisions: rest, audit: log(s, a.by, `Undid decision on ${a.id}`, a.id) }; }
    case 'note': return { ...s, audit: log(s, a.who, a.what, a.ref) };
    case 'assign': return { ...s, assign: { ...s.assign, ...a.map }, audit: log(s, a.by, a.what, a.ref) };
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
