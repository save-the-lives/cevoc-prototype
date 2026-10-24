import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { useStore } from '../../lib/store.jsx';
import { staff as findStaff } from '../../data.js';
import { OUTCOMES } from '../case/outcomes.js';

// Decide without leaving the queue. Revenue NSW officers record the outcome and the customer-facing reason;
// Transport staff see who decides and can add technical advice instead.
export default function QuickDecision({ k, user, riskCount, onAdvice }) {
  const { state, dispatch } = useStore();
  const [out, setOut] = useState('');
  const [reason, setReason] = useState('');
  const done = state.decisions[k.id];
  const canDecide = user.perms.includes('case:decide');
  const opts = OUTCOMES[k.type];
  const label = opts.find((o) => o[0] === out)?.[1];
  const ready = out && reason.trim().length > 9;

  if (done) {
    return (
      <div className="st-decide is-done" role="status">
        <strong>Decided: {done.label}</strong>
        <span>{done.reason} · by {findStaff(done.by)?.name}</span>
      </div>
    );
  }
  if (!canDecide) {
    return (
      <div className="st-decide">
        <span><span className="owner-tag">Revenue NSW</span> decides this case.</span>
        {user.perms.includes('inspect:request') && <Button size="sm" variant="outline" onClick={onAdvice}>Add technical advice</Button>}
        <Link to={`/staff/case/${k.id}`}>Open full case ↗</Link>
      </div>
    );
  }
  return (
    <form className="st-decide" onSubmit={(e) => {
      e.preventDefault();
      if (!ready) return;
      dispatch({ type: 'decide', id: k.id, d: { label, reason: reason.trim(), by: user.id } });
      toast.success(`${k.id}: ${label}`);
      setOut(''); setReason('');
    }}>
      <label className="st-decide__f">
        <span>Outcome</span>
        <select value={out} onChange={(e) => setOut(e.target.value)}>
          <option value="">Choose…</option>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="st-decide__f st-decide__reason">
        <span>Reason, in the customer letter</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }} placeholder={riskCount ? `Note the ${riskCount} certification risk${riskCount > 1 ? 's' : ''}` : 'At least 10 characters'} />
      </label>
      <Button type="submit" size="sm" disabled={!ready} title="Ctrl+Enter">Record decision</Button>
    </form>
  );
}
