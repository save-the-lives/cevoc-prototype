import { useMemo } from 'react';
import { Link } from '../../shared/ui.jsx';
import { CASES, notice as findNotice } from '../../data.js';
import { evaluate } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';
import { TODAY } from '../../lib/format.js';
import { daysBetween } from '../../lib/rules.js';
import { TARGETS, slaOf } from '../queue/sla.js';
import { caseState, impactLevel } from '../../lib/workflow.js';
import { dueOf } from '../tech/TechInbox.jsx';

// A small, actionable summary at the top of each agency's landing page. Every figure opens the matching work.
function Strip({ label, items }) {
  return (
    <div className="kstrip ws" role="group" aria-label={label}>
      {items.map((i) => (
        <Link key={i.label} to={i.to} className={`kpi is-${i.tone || 'grey'} ${i.n === 0 ? 'is-quiet' : ''}`}><span className="kpi-l">{i.label}</span><b className="kpi-v">{i.n}</b></Link>
      ))}
    </div>
  );
}

export default function WorkSummary({ user }) {
  const { state, statusOf } = useStore();
  const items = useMemo(() => {
    if (user.agency === 'tfnsw') {
      const open = state.tech.filter((r) => r.status === 'AWAITING_TRANSPORT');
      const sites = new Set(state.tech.filter((r) => r.status !== 'CANCELLED').map((r) => r.site));
      return [
        { label: 'Open technical requests', n: open.length, to: '/staff/requests?view=open', tone: 'ac' },
        { label: 'Awaiting investigation', n: open.filter((r) => !r.assignee).length, to: '/staff/requests?view=unassigned', tone: 'warn' },
        { label: 'Responses due', n: open.filter((r) => daysBetween(TODAY, dueOf(r)) <= 2).length, to: '/staff/requests?view=open', tone: 'bad' },
        { label: 'Potential systemic issues', n: [...sites].filter((s) => impactLevel({ site: s }, state.tech) !== 'Single notice' && state.tech.filter((r) => r.site === s && r.status !== 'CANCELLED').length > 1).length, to: '/staff/requests?view=all', tone: 'warn' },
        { label: 'Certificate actions to approve', n: state.pending.length, to: '/staff/queue/approvals', tone: 'warn' },
      ];
    }
    const rows = CASES.map((c) => {
      const n = findNotice(c.notice); const ev = evaluate(n, statusOf); const a = c.id in state.assign ? state.assign[c.id] : c.assignee;
      return { c, ev, sla: slaOf(c), st: caseState(c.id, state, a) };
    });
    const open = rows.filter((r) => r.st !== 'DECIDED');
    const escalated = (id) => state.tech.some((t) => t.caseId === id && t.status !== 'CANCELLED');
    return [
      { label: 'Need attention', n: open.filter((r) => r.st !== 'AWAITING_TRANSPORT').length, to: '/staff/queue/reviews?view=action', tone: 'ac' },
      { label: 'Resolved without Transport', n: rows.filter((r) => r.st === 'DECIDED' && !escalated(r.c.id)).length, to: '/staff/queue/reviews?view=completed', tone: 'grey' },
      { label: 'Awaiting Transport advice', n: open.filter((r) => r.st === 'AWAITING_TRANSPORT' || r.st === 'MORE_INFORMATION_REQUIRED').length, to: '/staff/queue/reviews?view=awaiting', tone: 'warn' },
      { label: 'Advice returned, your move', n: open.filter((r) => r.st === 'ADVICE_RECEIVED').length, to: '/staff/queue/reviews?view=advice', tone: 'ac' },
      { label: 'Nearing target date', n: open.filter((r) => r.sla.left <= 5).length, to: '/staff/queue/reviews?view=risk', tone: 'bad' },
    ];
  }, [state, statusOf, user.agency]);
  return <Strip label="Work summary" items={items} />;
}

// Certificate changes from Transport that touch open Revenue cases. Simulated notification, not a live integration.
export function CertAlerts() {
  const { state, dispatch } = useStore();
  if (!state.alerts.length) return null;
  return (
    <div className="alerts" role="region" aria-label="Notices from Transport">
      {state.alerts.map((a) => (
        <p key={a.id} role="status"><strong>From Transport (simulated):</strong> certificate {a.cert} {a.kind === 'withdrawal' ? 'was withdrawn' : 'was restored'} {a.at}. {a.cases.length} open case{a.cases.length === 1 ? ' relies' : 's rely'} on it:{' '}
          <Link to={`/staff/queue/reviews?q=${encodeURIComponent(`case IN (${a.cases.map((c) => `"${c}"`).join(', ')})`)}`}>{a.cases.join(', ')}</Link>
          <button type="button" className="st-link" onClick={() => dispatch({ type: 'dismissAlert', id: a.id })}>Dismiss</button></p>
      ))}
    </div>
  );
}
