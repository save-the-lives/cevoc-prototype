import { Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { fmtDate, TODAY } from '../../lib/format.js';
import { daysBetween } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';
import { staff as findStaff } from '../../data.js';
import { useWorkload } from './useWorkload.js';

const Stat = ({ to, n, label, tone, sub }) => (
  <Link to={to} className={`dash-stat ${tone ? `is-${tone}` : ''}`}>
    <strong>{n}</strong><span>{label}</span>{sub && <small>{sub}</small>}
  </Link>
);

// Stacked bar: mine / others / unassigned.
function Split({ q }) {
  const total = Math.max(q.open, 1);
  return (
    <div className="dash-split" role="img" aria-label={`${q.mine} yours, ${q.others} with others, ${q.unassigned} unassigned`}>
      <i className="is-mine" style={{ width: `${(q.mine / total) * 100}%` }} />
      <i className="is-others" style={{ width: `${(q.others / total) * 100}%` }} />
      <i className="is-none" style={{ width: `${(q.unassigned / total) * 100}%` }} />
    </div>
  );
}

function QueueCard({ title, to, q, q2 }) {
  const qs = (x) => `${to}?q=${encodeURIComponent(x)}`;
  return (
    <section className="dash-card">
      <header><h2><Link to={to}>{title}</Link></h2><span>{q.open} open</span></header>
      <Split q={q} />
      <ul className="dash-legend">
        <li><i className="is-mine" /><Link to={qs('assignee = me')}>{q.mine} yours</Link></li>
        <li><i className="is-others" /><Link to={qs('assignee IS NOT EMPTY AND assignee != me')}>{q.others} with others</Link></li>
        <li><i className="is-none" /><Link to={qs('assignee IS EMPTY')}>{q.unassigned} unassigned</Link></li>
      </ul>
      <div className="dash-flags">
        <Link to={qs('left < 0 ORDER BY waiting DESC')} className={q.past ? 'is-bad' : ''}>{q.past} past target</Link>
        <Link to={qs('certification = "not current"')} className={q.risk ? 'is-warn' : ''}>{q.risk} certification {q.risk === 1 ? 'risk' : 'risks'}</Link>
      </div>
    </section>
  );
}

// The "what's where" view: what needs you, where work is sitting, who has it, and how healthy the cameras are.
export default function Dashboard({ user, canApprove }) {
  const { state } = useStore();
  const w = useWorkload(user.id);
  const canDecide = user.perms.includes('case:decide');
  const myRequests = state.pending.filter((p) => p.by === user.id).length;
  const recent = state.audit.slice(0, 6);
  const total = w.review.open + w.court.open;
  const mine = w.review.mine + w.court.mine;
  const past = w.review.past + w.court.past;
  const risk = w.review.risk + w.court.risk;

  return (
    <div className="dash">
      <div className="st-qhead"><h1>Dashboard</h1><p className="st-muted">{user.name} · {user.role} · {fmtDate(TODAY)}</p></div>

      <div className="dash-stats">
        {canDecide && <Stat to="/staff/queue/reviews?q=assignee%20%3D%20me" n={mine} label="Yours to decide" tone={mine ? 'mine' : ''} />}
        <Stat to="/staff/queue/reviews?q=left%20%3C%200%20ORDER%20BY%20waiting%20DESC" n={past} label="Past target reply" tone={past ? 'bad' : ''} sub="Customers waiting too long" />
        <Stat to="/staff/queue/reviews?q=certification%20%3D%20%22not%20current%22" n={risk} label="With a certification risk" tone={risk ? 'warn' : ''} sub="May not survive a challenge" />
        <Stat to="/staff/queue/reviews?q=assignee%20IS%20EMPTY" n={w.review.unassigned + w.court.unassigned} label="Unassigned" sub={`of ${total} open`} />
        {canApprove && <Stat to="/staff/queue/approvals" n={state.pending.length} label="Approvals waiting" tone={state.pending.length ? 'warn' : ''} />}
        {!canApprove && user.perms.includes('withdraw:request') && <Stat to="/staff/certificates" n={myRequests} label="Your withdrawal requests" sub="Waiting for a program manager" />}
      </div>

      <div className="dash-grid">
        <QueueCard title="Reviews" to="/staff/queue/reviews" q={w.review} />
        <QueueCard title="Court elections" to="/staff/queue/court" q={w.court} />

        <section className="dash-card">
          <header><h2>Who has what</h2><span>open cases</span></header>
          <ul className="dash-people">
            {w.people.map(({ p, n, past: pp }) => (
              <li key={p.id} className={p.id === user.id ? 'is-me' : ''}>
                <span>{p.name}{p.id === user.id ? ' (you)' : ''}<small>{p.org}</small></span>
                <span className="dash-people__bar"><i style={{ width: `${Math.min(n * 24, 100)}%` }} /></span>
                <b>{n}</b>{pp > 0 && <Tag size="sm" color="danger">{pp} late</Tag>}
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card dash-wide">
          <header><h2>Needs attention first</h2><span>past target or a certification risk</span></header>
          {w.attention.length ? (
            <ul className="dash-attn">
              {w.attention.map((r) => (
                <li key={r.c.id}>
                  <Link to={`/staff/queue/${r.c.type === 'court' ? 'court' : 'reviews'}?q=${encodeURIComponent(`case = ${r.c.id}`)}`}><strong>{r.c.id}</strong></Link>
                  <span>{r.n.holder}</span>
                  <Tag size="sm" color={r.sla.tone}>Waiting {r.sla.label}</Tag>
                  {!r.ev.current && <Tag size="sm" color="warning">{r.ev.notCurrent} not current</Tag>}
                  <span className="st-muted">{r.assignee ? findStaff(r.assignee)?.name : 'Unassigned'}</span>
                </li>
              ))}
            </ul>
          ) : <p className="st-muted">Nothing is past target or at risk.</p>}
        </section>

        <section className="dash-card dash-wide">
          <header><h2><Link to="/staff/cameras">Camera certification</Link></h2><span>by camera, against open cases</span></header>
          <table className="dash-table">
            <thead><tr><th>Camera</th><th>Last inspection</th><th>Certificates</th><th>Open cases</th><th>At risk</th></tr></thead>
            <tbody>
              {w.cameras.map(({ s, certs, withdrawn, cases, risk: r, lastInspect }) => {
                const age = lastInspect ? daysBetween(lastInspect, TODAY) : null;
                return (
                  <tr key={s.code}>
                    <td><Link to={`/staff/camera/${s.code}`}><strong>{s.code}</strong></Link><small>{s.suburb}</small></td>
                    <td>{lastInspect ? <>{fmtDate(lastInspect)} <Tag size="sm" color={age > 90 ? 'warning' : 'success'}>{age} days</Tag></> : '—'}</td>
                    <td>{certs}{withdrawn > 0 && <Tag size="sm" color="warning">{withdrawn} withdrawn</Tag>}</td>
                    <td>{cases}</td>
                    <td>{r > 0 ? <Tag size="sm" color="warning">{r}</Tag> : <span className="st-muted">0</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="dash-card dash-wide">
          <header><h2>Recent activity</h2><span>this session</span></header>
          {recent.length ? <ul className="st-audit">{recent.map((a, i) => <li key={i}><time>{a.at}</time> {findStaff(a.who)?.name || a.who}: {a.what}</li>)}</ul> : <p className="st-muted">Nothing yet. Decisions, assignments and certificate changes appear here.</p>}
        </section>
      </div>
    </div>
  );
}
