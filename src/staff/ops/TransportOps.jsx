import { useMemo, useState } from 'react';
import { Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { fmtDate } from '../../lib/format.js';
import { useStore } from '../../lib/store.jsx';
import { useNow } from '../../lib/useNow.js';
import { CASES, CERTS, NOTICES, staff as findStaff, site as findSite } from '../../data.js';
import { evaluate } from '../../lib/rules.js';
import { REQUEST_STATUS, categoryLabel, escalation, human, impactLevel, isWithTransport, requestedAt, dueMs } from '../../lib/workflow.js';
import { Activity, Panel, Scope, StageStrip, TeamWorkload, Tile } from './Parts.jsx';
import { STAFF } from '../../data.js';
import LiveStatus from './LiveStatus.jsx';
import Proposed from '../../shared/Proposed.jsx';

const RANK = { escalated: 0, overdue: 1, soon: 2, none: 3 };

// Transport for NSW: which technical issues need attention, and what delay would cost downstream.
export default function TransportOps({ user, canApprove }) {
  const { state, dispatch, statusOf } = useStore();
  const now = useNow();
  const [scope, setScope] = useState('team');
  const days = state.targets.tech;

  const live = state.tech.filter((r) => isWithTransport(r.status));
  const mine = scope === 'team' ? live : live.filter((r) => r.assignee === user.id);
  const esc = (r) => escalation(r, now, days);
  const incoming = [...mine].sort((a, b) => RANK[esc(a).level] - RANK[esc(b).level] || dueMs(a, days) - dueMs(b, days));
  const urgent = mine.filter((r) => ['overdue', 'escalated'].includes(esc(r).level) || impactLevel(r, state.tech) === 'Systemic');
  const near = mine.filter((r) => esc(r).level !== 'none');
  const fresh = mine.filter((r) => r.status === 'AWAITING_TRANSPORT');
  const unassigned = live.filter((r) => !r.assignee);

  // Camera and certificate exceptions with their downstream reach (notices and open Revenue cases).
  const exceptions = useMemo(() => {
    const out = [];
    const sites = [...new Set(NOTICES.map((n) => n.site))];
    sites.forEach((code) => {
      const bad = NOTICES.filter((n) => n.site === code && !evaluate(n, statusOf).current);
      if (!bad.length) return;
      const openCases = CASES.filter((c) => bad.some((n) => n.number === c.notice) && !state.decisions[c.id]);
      const item = evaluate(bad[0], statusOf).items.find((i) => !i.current);
      const hasReq = state.tech.some((r) => r.site === code && isWithTransport(r.status));
      out.push({ key: `risk-${code}`, type: 'Certification not current', where: `${code} (${findSite(code).suburb})`, detail: item?.req.label || 'Certificate', notices: bad.length, cases: openCases.length, status: hasReq ? 'Under investigation' : 'No technical request', to: item?.cert ? `/staff/cert/${item.cert.id}` : `/staff/camera/${code}`, tone: openCases.length > 1 ? 'danger' : 'warning' });
    });
    state.pending.forEach((p) => out.push({ key: p.id, type: p.kind === 'withdrawal' ? 'Certificate withdrawal pending' : 'Certificate restoration pending', where: `${p.cert}`, detail: p.reason, notices: p.affected, cases: null, status: 'Awaiting approval', to: `/staff/cert/${p.cert}`, tone: 'warning' }));
    state.alerts.forEach((a) => { const c = CERTS.find((x) => x.id === a.cert); out.push({ key: a.id, type: a.kind === 'withdrawal' ? 'Certificate withdrawn' : 'Certificate restored', where: c ? `${c.site}` : a.cert, detail: a.cert, notices: null, cases: a.cases.length, status: 'Revenue NSW notified (simulated)', to: `/staff/cert/${a.cert}`, tone: 'danger' }); });
    const bySite = {};
    state.tech.filter((r) => r.status !== 'CANCELLED').forEach((r) => { (bySite[r.site] ||= []).push(r); });
    Object.entries(bySite).filter(([, rs]) => rs.length > 1).forEach(([code, rs]) => out.push({ key: `rep-${code}`, type: 'Repeated technical question', where: code, detail: `${rs.length} requests`, notices: null, cases: rs.length, status: 'Possible systemic issue', to: '/staff/requests?view=all', tone: 'warning' }));
    return out;
  }, [state.tech, state.pending, state.alerts, state.decisions, statusOf]);
  const systemic = exceptions.filter((e) => e.type === 'Repeated technical question' || e.cases > 1 || e.notices > 1).length;
  const reach = new Set([...live.map((r) => r.caseId), ...state.alerts.flatMap((a) => a.cases), ...exceptions.filter((e) => e.type === 'Certification not current').flatMap((e) => CASES.filter((c) => NOTICES.find((n) => n.number === c.notice)?.site === e.where.split(' ')[0] && !state.decisions[c.id]).map((c) => c.id))]).size;

  return (
    <div className="ops">
      <div className="ops-top">
        <div><h1>Operational dashboard <Proposed note="Targets, escalation, event feed and referral tracking are proposals that need business approval." /></h1><p className="st-muted">Live view of technical requests and certification issues.</p></div>
        <div className="ops-ctl"><Scope value={scope} onChange={setScope} label="Whose work" /><LiveStatus /></div>
      </div>

      <div className="otiles">
        <Tile label="New requests" n={fresh.length} sub="From Revenue NSW" to="/staff/requests?view=new" tone="primary" urgent />
        <Tile label="Unassigned" n={unassigned.length} sub="Need an owner" to="/staff/requests?view=unassigned" tone="warn" urgent />
        <Tile label="Urgent advice" n={urgent.length} sub="Overdue or systemic" to="/staff/requests?view=urgent" tone="bad" urgent />
        <Tile label="Near or past target" n={near.length} sub={`${days}-day response target`} to="/staff/requests?view=target" tone="bad" urgent />
        <Tile label="Approvals" n={state.pending.length} sub={canApprove ? 'Withdraw or restore' : 'Awaiting a program manager'} to="/staff/queue/approvals" tone="warn" urgent={canApprove} />
        <Tile label="Possible systemic" n={systemic} sub="Camera or evidence issues" to="/staff/requests?view=all" tone="primary" />
        <Tile label="Revenue cases reached" n={reach} sub="Related notices and cases" to="/staff/requests?view=all" tone="grey" />
      </div>

      <div className="ogrid">
        <Panel title="Incoming technical requests" count={incoming.length} tone="warn" action={<Link to="/staff/requests?view=open">View all</Link>} wide>
          {incoming.length ? (
            <table className="otable">
              <thead><tr><th>Request</th><th>Review ID</th><th>Category</th><th>Age</th><th>Target</th><th>Status</th><th>Escalation</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>{incoming.map((r) => {
                const e = esc(r);
                return (
                  <tr key={r.id}>
                    <td><Link to={`/staff/request/${r.id}`}><strong>{r.id}</strong></Link><small className="st-sub">{r.assignee ? findStaff(r.assignee).name : 'Unassigned'}</small></td>
                    <td>{r.caseId}</td><td>{categoryLabel(r.category)}<small className="st-sub">{r.site}</small></td>
                    <td>{human(now - requestedAt(r))}</td><td>{fmtDate(new Date(dueMs(r, days)).toISOString().slice(0, 10))}</td>
                    <td><Tag size="sm" color={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Tag></td>
                    <td><Tag size="sm" color={e.tone}>{e.label}</Tag></td>
                    <td>{r.status === 'AWAITING_TRANSPORT' && user.perms.includes('inspect:request')
                      ? <button type="button" className="obtn" onClick={() => dispatch({ type: 'techAck', id: r.id, by: user.id })}>Acknowledge<span className="sr-only"> {r.id}</span></button>
                      : <Link className="obtn" to={`/staff/request/${r.id}`}>{r.status === 'ACKNOWLEDGED' ? 'Investigate' : 'Open'}<span className="sr-only"> {r.id}</span></Link>}</td>
                  </tr>);
              })}</tbody>
            </table>
          ) : <p className="st-muted">No technical requests need your attention.</p>}
        </Panel>

        <Panel title="Operational exceptions" count={exceptions.length} tone="bad" wide>
          {exceptions.length ? (
            <table className="otable">
              <thead><tr><th>Type</th><th>Camera / certificate</th><th>Downstream impact</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
              <tbody>{exceptions.slice(0, 7).map((x) => (
                <tr key={x.key}>
                  <td><Tag size="sm" color={x.tone}>{x.type}</Tag></td>
                  <td>{x.where}<small className="st-sub">{x.detail}</small></td>
                  <td>{[x.notices != null && `${x.notices} notice${x.notices === 1 ? '' : 's'}`, x.cases != null && `${x.cases} Revenue case${x.cases === 1 ? '' : 's'}`].filter(Boolean).join(', ') || '—'}</td>
                  <td>{x.status}</td>
                  <td><Link className="obtn" to={x.to}>Investigate<span className="sr-only"> {x.type} {x.where}</span></Link></td>
                </tr>))}</tbody>
            </table>
          ) : <p className="st-muted">No certification or camera exceptions.</p>}
        </Panel>

        <Activity agency="tfnsw" />
      </div>

      {user.perms.includes('team:manage') && <TeamWorkload people={[...STAFF.filter((p) => p.agency === 'tfnsw' && p.perms.includes('inspect:request')).map((p) => {
        const m = live.filter((r) => r.assignee === p.id);
        return { id: p.id, name: p.name, role: p.role, open: m.length, risk: m.filter((r) => esc(r).level !== 'none').length, to: '/staff/requests?view=open' };
      }), { id: 'none', name: 'Unassigned', role: 'Waiting for an owner', open: unassigned.length, risk: unassigned.filter((r) => esc(r).level !== 'none').length, to: '/staff/requests?view=unassigned' }]} />}
      <StageStrip to="/staff/requests?view=all" />
      <p className="ops-foot"><Link to="/staff/insights">Trends and analytics →</Link> <span className="st-muted">The {days}-day response target is internal and configurable, not statutory.</span></p>
    </div>
  );
}
