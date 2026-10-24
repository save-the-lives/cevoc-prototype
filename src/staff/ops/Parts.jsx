import { Link } from '../../shared/ui.jsx';
import { STAFF } from '../../data.js';
import { Tag } from '@nswds/ui';
import { useStore } from '../../lib/store.jsx';
import { useNow } from '../../lib/useNow.js';
import { eventsFor } from './Notifications.jsx';
import { human, isWithTransport, REQUEST_STATUS } from '../../lib/workflow.js';

export const q = (text) => encodeURIComponent(text);

// A summary number that is also a link into the filtered work behind it. Tone says how urgent, and the words say it too.
export function Tile({ label, n, sub, to, tone = 'grey', urgent }) {
  return (
    <Link to={to} className={`otile is-${tone}`}>
      <span className="otile-l">{label}{urgent && n > 0 && <em> · action needed</em>}</span>
      <b className="otile-n">{n}</b>
      <small>{sub}</small>
    </Link>
  );
}

export function Panel({ title, count, tone, action, children, wide }) {
  return (
    <section className={`opanel ${wide ? 'is-wide' : ''}`} aria-label={title}>
      <header><h2>{title}{count !== undefined && <span className={`opanel-n is-${tone || 'grey'}`}>{count}</span>}</h2>{action}</header>
      {children}
    </section>
  );
}

export function Scope({ value, onChange, label = 'View' }) {
  return (
    <div className="seg2" role="group" aria-label={label}>
      {[['team', 'Team'], ['mine', 'My work']].map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

// Recent simulated events for this agency; unread ones are marked "New" in words.
export function Activity({ agency, limit = 6 }) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const list = eventsFor(state, agency).slice(0, limit);
  const unread = eventsFor(state, agency).filter((e) => e.at > state.seen[agency]).length;
  return (
    <Panel title="What changed" count={unread || undefined} tone="primary" action={unread ? <button type="button" className="st-link" onClick={() => dispatch({ type: 'seen', agency })}>Mark all read</button> : null}>
      {list.length ? (
        <ul className="act">{list.map((e) => (
          <li key={e.id} className={e.at > state.seen[agency] ? 'is-new' : ''}>
            <Link to={e.link || '#'}>{e.at > state.seen[agency] && <span className="act-new">New · </span>}{e.urgent && <strong>Action: </strong>}{e.text}</Link>
            <small>{human(now - e.at)} ago</small>
          </li>))}</ul>
      ) : <p className="st-muted">No activity yet. Events appear here as the other agency acts (simulated).</p>}
    </Panel>
  );
}

// How many live requests sit at each stage, so both agencies see where work is stuck.
export function StageStrip({ to }) {
  const { state } = useStore();
  const live = state.tech.filter((r) => r.status !== 'CANCELLED');
  const decided = (r) => !!state.decisions[r.caseId];
  const stages = [
    ['Revenue request', live.filter((r) => r.status === 'AWAITING_TRANSPORT').length, 'Requested, not yet acknowledged'],
    ['Transport acknowledgement', live.filter((r) => r.status === 'ACKNOWLEDGED').length, 'Acknowledged, investigation not started'],
    ['Technical investigation', live.filter((r) => r.status === 'INVESTIGATING' || r.status === 'MORE_INFORMATION_REQUIRED').length, 'Being investigated'],
    ['Advice returned', live.filter((r) => r.status === 'ADVICE_RECEIVED' && !decided(r)).length, 'Waiting for Revenue NSW to decide'],
    ['Revenue resolution', live.filter((r) => r.status === 'ADVICE_RECEIVED' && decided(r)).length, 'Decided: complete'],
  ];
  return (
    <section className="stages" aria-label="End-to-end lifecycle">
      <h2>End-to-end lifecycle <small>(both agencies see the same requests)</small></h2>
      <ol>{stages.map(([l, n, d], i) => <li key={l}><Link to={to}><span className="stages-n">{n}</span><span><strong>{i + 1}. {l}</strong><small>{d}</small></span></Link></li>)}</ol>
    </section>
  );
}

export const StatusTag = ({ status }) => <Tag size="sm" color={REQUEST_STATUS[status].tone}>{REQUEST_STATUS[status].label}</Tag>;
export { isWithTransport };

// For managers only: who is carrying what, so work can be moved before it goes late.
export function TeamWorkload({ people }) {
  return (
    <Panel title="Team workload" tone="grey">
      <table className="otable">
        <thead><tr><th>Person</th><th>Role</th><th>Open</th><th>At risk or overdue</th><th><span className="sr-only">Open</span></th></tr></thead>
        <tbody>{people.map((p) => (
          <tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.role}</td><td>{p.open}</td><td>{p.risk ? <Tag size="sm" color="danger">{p.risk}</Tag> : 0}</td><td>{p.to && <Link to={p.to}>View</Link>}</td></tr>))}
          {!people.length && <tr><td colSpan={5} className="st-muted">No one to show.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}
export { STAFF };
