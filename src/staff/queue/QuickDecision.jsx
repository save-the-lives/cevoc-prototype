import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { useStore } from '../../lib/store.jsx';
import { staff as findStaff } from '../../data.js';
import { OUTCOMES } from '../case/outcomes.js';
import { activeRequest } from '../../lib/workflow.js';
import AdviceBlock from './AdviceBlock.jsx';

// Decide without leaving the queue. Revenue NSW officers record the outcome and the customer-facing reason;
// Transport staff see who decides and can add technical advice instead.
// Ready-made reasons so the common outcomes take a click, not a paragraph. They only fill the box; the officer edits freely.
function templates(out, risk) {
  const by = {
    uphold: risk ? ['Evidence is clear. The certification risk was reviewed and does not affect this offence.'] : ['Evidence and certification checked and in order.'],
    withdraw: [...(risk ? ['Withdrawn: the camera certification was not current on the day.'] : []), 'Withdrawn: the evidence is not sufficient to proceed.'],
    caution: ['Withdrawn and a caution given, taking the circumstances into account.'],
    brief: ['Brief of evidence to be prepared for the court election.'],
  };
  return by[out] || [];
}

export default function QuickDecision({ k, n, ev, user, riskCount, onDecided }) {
  const { state, dispatch } = useStore();
  const [out, setOut] = useState('');
  const [reason, setReason] = useState('');
  const done = state.decisions[k.id];
  const canDecide = user.perms.includes('case:decide');
  const opts = OUTCOMES[k.type];
  const label = opts.find((o) => o[0] === out)?.[1];
  const ready = out && reason.trim().length > 9;

  const req = activeRequest(state.tech, k.id);
  const waiting = req && req.status !== 'ADVICE_RECEIVED';

  if (done) {
    return (
      <div className="st-decide is-done" role="status">
        <strong>Decided: {done.label}</strong>
        <span>{done.reason} · by {findStaff(done.by)?.name}</span>
        {canDecide && <Button size="sm" variant="ghost" onClick={() => { dispatch({ type: 'reopen', id: k.id, by: user.id }); toast.info(`${k.id} reopened`); }}>Reopen</Button>}
      </div>
    );
  }
  if (!canDecide) {
    return (
      <div className="st-decide">
        {user.agency === 'rnsw' ? <span>Review officers decide this case. As a manager you can reassign it from the queue.</span> : <span><span className="owner-tag">Revenue NSW</span> decides this case. Transport advises through <Link to="/staff/requests">Technical requests</Link>.</span>}
        <Link to={`/staff/case/${k.id}`}>Open full case ↗</Link>
      </div>
    );
  }
  return (
    <>
    <AdviceBlock k={k} n={n} ev={ev} user={user} onUse={(t) => { setReason(t); document.getElementById('qd-outcome')?.focus(); }} />
    {waiting ? <div className="st-decide is-wait" role="status"><span>Waiting for Transport’s advice before you decide. Cancel the request above to decide without it.</span></div> : (
    <form className="st-decide" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.requestSubmit(); } }} onSubmit={(e) => {
      e.preventDefault();
      if (!ready) return;
      dispatch({ type: 'decide', id: k.id, d: { label, reason: reason.trim(), by: user.id } });
      toast.success(`${k.id}: ${label}`, { action: { label: 'Undo', onClick: () => dispatch({ type: 'undecide', id: k.id, by: user.id }) } });
      setOut(''); setReason('');
      onDecided?.(k.id);
    }}>
      <label className="st-decide__f">
        <span>Outcome <kbd>d</kbd></span>
        <select id="qd-outcome" value={out} onChange={(e) => setOut(e.target.value)}>
          <option value="">Choose…</option>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="st-decide__f st-decide__reason">
        <span>Reason, in the customer letter</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={riskCount ? `Note the ${riskCount} certification risk${riskCount > 1 ? 's' : ''}` : 'At least 10 characters'} />
      </label>
      <Button type="submit" size="sm" disabled={!ready} title="Ctrl+Enter">Record decision</Button>
      <div className="st-decide__aid">
        {riskCount > 0 && <p className={`st-decide__hint ${out === 'uphold' ? 'is-strong' : ''}`} role={out === 'uphold' ? 'alert' : undefined}>{out === 'uphold' ? `Upholding with ${riskCount} certification ${riskCount > 1 ? 'risks' : 'risk'}. Say why it doesn’t matter.` : `${riskCount} certification ${riskCount > 1 ? 'risks' : 'risk'}: upholding may not survive a challenge.`}</p>}
        {out && templates(out, riskCount > 0).map((t) => <button key={t} type="button" className="st-decide__chip" onClick={() => setReason(t)} title="Use this reason">{t}</button>)}
        <span className="st-decide__keys"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> records and moves to the next case</span>
      </div>
    </form>
    )}
    </>
  );
}
