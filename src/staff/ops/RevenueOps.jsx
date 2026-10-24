import { useState } from 'react';
import { Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { fmtDate } from '../../lib/format.js';
import { useStore } from '../../lib/store.jsx';
import { useNow } from '../../lib/useNow.js';
import { staff as findStaff } from '../../data.js';
import { REQUEST_STATUS, escalation, human, isWithTransport, requestedAt, dueMs, categoryLabel } from '../../lib/workflow.js';
import { useRevenueRows } from './useRevenueRows.js';
import { Activity, Panel, Scope, StageStrip, TeamWorkload, Tile, q } from './Parts.jsx';
import { STAFF } from '../../data.js';
import LiveStatus from './LiveStatus.jsx';

const open = (id) => `/staff/queue/reviews?q=${q(`case = "${id}"`)}&open=1`;
const list = (query) => `/staff/queue/reviews?q=${q(query)}`;

// Revenue NSW: what needs intervention now, and what is stopping resolution.
export default function RevenueOps({ user }) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const [scope, setScope] = useState('team');
  const all = useRevenueRows();
  const rows = all.filter((r) => !r.decided && (scope === 'team' || r.assignee === user.id || (!r.assignee && false)));
  const affected = new Set(state.alerts.flatMap((a) => a.cases));
  const is = (...sts) => rows.filter((r) => sts.includes(r.st));

  const fresh = is('OPEN'); const deciding = is('TRIAGE', 'REOPENED'); const waiting = is('AWAITING_TRANSPORT'); const back = is('ADVICE_RECEIVED', 'MORE_INFORMATION_REQUIRED');
  const risk = rows.filter((r) => r.sla.left <= 5); const critical = rows.filter((r) => affected.has(r.c.id));

  // Urgent, actionable work first. Anything that is merely waiting on someone else goes in the other panel.
  const action = rows.filter((r) => r.st !== 'AWAITING_TRANSPORT').map((r) => {
    let why = 'Needs a decision'; let score = 30; let go = 'Decide';
    if (r.st === 'ADVICE_RECEIVED') { why = 'Transport advice returned: decide'; score = 100; go = 'Decide'; }
    else if (r.st === 'MORE_INFORMATION_REQUIRED') { why = 'Transport asked you a question'; score = 105; go = 'Reply'; }
    else if (affected.has(r.c.id)) { why = 'A certificate changed on this case'; score = 95; go = 'Review'; }
    else if (r.sla.left < 0) { why = `${-r.sla.left} days past target`; score = 90; go = 'Decide'; }
    else if (r.sla.left <= 5) { why = `Target in ${r.sla.left} day${r.sla.left === 1 ? '' : 's'}`; score = 70 - r.sla.left; go = 'Decide'; }
    else if (r.st === 'OPEN') { why = 'New: needs triage'; score = r.c.priority === 'high' ? 60 : 40; go = 'Triage'; }
    else return null;
    return { r, why, score, go };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 6);

  const caseIds = new Set(rows.map((r) => r.c.id));
  const withTransport = state.tech.filter((t) => isWithTransport(t.status) && caseIds.has(t.caseId));

  return (
    <div className="ops">
      <div className="ops-top">
        <div><h1>Operational dashboard</h1><p className="st-muted">Live view of cases and technical requests needing action.</p></div>
        <div className="ops-ctl"><Scope value={scope} onChange={setScope} label="Whose work" /><LiveStatus /></div>
      </div>

      <div className="otiles">
        <Tile label="New cases" n={fresh.length} sub="Need triage" to={list('state = open')} tone="primary" urgent />
        <Tile label="Awaiting decision" n={deciding.length} sub="With an officer" to={list('state IN (triage, reopened)')} tone="grey" />
        <Tile label="Awaiting Transport" n={waiting.length} sub="Technical advice requested" to="/staff/queue/reviews?view=awaiting" tone="warn" />
        <Tile label="Advice back" n={back.length} sub="Requires your action" to={list('state IN (advice, more-info)')} tone="ok" urgent />
        <Tile label="At risk" n={risk.length} sub="Due within 5 days" to="/staff/queue/reviews?view=risk" tone="bad" urgent />
        <Tile label="Certificate changes" n={critical.length} sub="Affect open cases" to={critical.length ? list(`case IN (${critical.map((r) => `"${r.c.id}"`).join(', ')})`) : '/staff/queue/reviews?view=risk'} tone="bad" urgent />
      </div>

      <div className="ogrid">
        <Panel title="Action required now" count={action.length} tone="bad" action={<Link to="/staff/queue/reviews?view=action">View all</Link>} wide>
          {action.length ? (
            <table className="otable">
              <thead><tr><th>Review ID</th><th>Notice</th><th>Reason</th><th>Why now</th><th>Due</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>{action.map(({ r, why, go, score }) => (
                <tr key={r.c.id}>
                  <td><Link to={open(r.c.id)}><strong>{r.c.id}</strong></Link></td><td>{r.c.notice}</td><td>{r.c.category}</td>
                  <td>{score >= 90 && <Tag size="sm" color="danger">Urgent</Tag>} {why}</td>
                  <td>{fmtDate(r.sla.due)}</td>
                  <td><Link className="obtn" to={open(r.c.id)}>{go}<span className="sr-only"> {r.c.id}</span></Link></td>
                </tr>))}</tbody>
            </table>
          ) : <p className="st-muted">Nothing needs action right now.</p>}
        </Panel>

        <Panel title="Waiting on Transport" count={withTransport.length} tone="warn" action={<Link to="/staff/queue/reviews?view=awaiting">View all</Link>} wide>
          {withTransport.length ? (
            <table className="otable">
              <thead><tr><th>Case</th><th>Request</th><th>Request age</th><th>Technical team</th><th>Status</th><th>Target response</th><th>Escalation</th></tr></thead>
              <tbody>{withTransport.map((t) => {
                const esc = escalation(t, now, state.targets.tech);
                return (
                  <tr key={t.id}>
                    <td><Link to={open(t.caseId)}><strong>{t.caseId}</strong></Link></td>
                    <td><Link to={`/staff/request/${t.id}`}>{t.id}</Link><small className="st-sub">{categoryLabel(t.category)}</small></td>
                    <td>{human(now - requestedAt(t))}</td>
                    <td>{t.assignee ? findStaff(t.assignee).name : 'Not yet acknowledged'}</td>
                    <td><Tag size="sm" color={REQUEST_STATUS[t.status].tone}>{REQUEST_STATUS[t.status].label}</Tag></td>
                    <td>{fmtDate(new Date(dueMs(t, state.targets.tech)).toISOString().slice(0, 10))}</td>
                    <td><Tag size="sm" color={esc.tone}>{esc.label}</Tag></td>
                  </tr>);
              })}</tbody>
            </table>
          ) : <p className="st-muted">No requests are waiting on Transport.</p>}
        </Panel>

        <Activity agency="rnsw" />

        <Panel title="Certification alerts affecting open cases" count={state.alerts.length || undefined} tone="bad">
          {state.alerts.length ? (
            <ul className="act">{state.alerts.map((a) => (
              <li key={a.id}><Link to={list(`case IN (${a.cases.map((c) => `"${c}"`).join(', ')})`)}><strong>{a.cert}</strong> {a.kind === 'withdrawal' ? 'withdrawn' : 'restored'}: {a.cases.length} open case{a.cases.length === 1 ? '' : 's'} ({a.cases.join(', ')})</Link><small>{a.at}. Simulated notice from Transport.</small>
                <button type="button" className="st-link" onClick={() => dispatch({ type: 'dismissAlert', id: a.id })}>Dismiss</button></li>))}</ul>
          ) : <p className="st-muted">No certificate changes affect your open cases.</p>}
        </Panel>
      </div>

      {user.perms.includes('team:manage') && <TeamWorkload people={[...STAFF.filter((p) => p.agency === 'rnsw' && p.perms.includes('case:decide')).map((p) => {
        const mine = all.filter((r) => !r.decided && r.assignee === p.id);
        return { id: p.id, name: p.name, role: p.role, open: mine.length, risk: mine.filter((r) => r.sla.left <= 5).length, to: `/staff/queue/reviews?q=${q(`assignee = "${p.name}" AND status = open`)}` };
      }), { id: 'none', name: 'Unassigned', role: 'Waiting for an owner', open: all.filter((r) => !r.decided && !r.assignee).length, risk: all.filter((r) => !r.decided && !r.assignee && r.sla.left <= 5).length, to: `/staff/queue/reviews?q=${q('assignee IS EMPTY AND status = open')}` }]} />}
      <StageStrip to="/staff/queue/reviews?view=awaiting" />
      <p className="ops-foot"><Link to="/staff/insights">Trends and analytics →</Link> <span className="st-muted">Targets (reviews {state.targets.review} days, court {state.targets.court}, Transport advice {state.targets.tech}) are internal and configurable, not statutory.</span></p>
    </div>
  );
}
