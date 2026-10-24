import { useEffect, useMemo, useState } from 'react';
import { Button, Kbd, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { go } from '../../lib/router.js';
import { fmtDate } from '../../lib/format.js';
import { useStore } from '../../lib/store.jsx';
import { TODAY } from '../../lib/format.js';
import { TARGETS } from '../queue/sla.js';
import { REQUEST_STATUS, categoryLabel, escalation, human, impactLevel, isWithTransport, requestedAt, dueMs } from '../../lib/workflow.js';
import { useNow } from '../../lib/useNow.js';
import { site as findSite, staff as findStaff } from '../../data.js';
import { useHotkeys } from '../hooks/useHotkeys.js';

export const TECH_VIEWS = [
  { id: 'open', label: 'Active', test: (r) => isWithTransport(r.status) },
  { id: 'new', label: 'New', test: (r) => r.status === 'AWAITING_TRANSPORT' },
  { id: 'urgent', label: 'Urgent', test: (r, c) => isWithTransport(r.status) && (['overdue', 'escalated'].includes(escalation(r, c.now, c.days).level) || impactLevel(r, c.tech) === 'Systemic') },
  { id: 'target', label: 'Near or past target', test: (r, c) => isWithTransport(r.status) && escalation(r, c.now, c.days).level !== 'none' },
  { id: 'unassigned', label: 'Unassigned', test: (r) => isWithTransport(r.status) && !r.assignee },
  { id: 'progress', label: 'In progress', test: (r) => r.status === 'ACKNOWLEDGED' || r.status === 'INVESTIGATING' },
  { id: 'revenue', label: 'Awaiting Revenue NSW', test: (r) => r.status === 'MORE_INFORMATION_REQUIRED' },
  { id: 'answered', label: 'Answered', test: (r) => r.status === 'ADVICE_RECEIVED' },
  { id: 'history', label: 'Technical history', test: (r) => r.status === 'ADVICE_RECEIVED' || r.status === 'CANCELLED' },
  { id: 'all', label: 'All', test: () => true },
];

// Transport's inbox: only technical questions, never the whole Revenue NSW review queue.
export default function TechInbox({ user, view = 'open' }) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const [cur, setCur] = useState(0);
  const v = TECH_VIEWS.find((x) => x.id === view) || TECH_VIEWS[0];
  const rows = useMemo(() => state.tech.filter((r) => v.test(r, { now, days: state.targets.tech, tech: state.tech })).map((r) => ({ r, impact: impactLevel(r, state.tech), age: now - requestedAt(r), due: dueMs(r, state.targets.tech) }))
    .sort((a, b) => a.due - b.due), [state.tech, v, state.targets, now]); // eslint-disable-line
  useEffect(() => { setCur((c) => Math.min(c, Math.max(rows.length - 1, 0))); }, [rows.length]);
  const sel = rows[cur];
  useHotkeys({ j: () => setCur((c) => Math.min(c + 1, rows.length - 1)), k: () => setCur((c) => Math.max(c - 1, 0)), ArrowDown: () => setCur((c) => Math.min(c + 1, rows.length - 1)), ArrowUp: () => setCur((c) => Math.max(c - 1, 0)),
    Enter: () => sel && go(`/staff/request/${sel.r.id}`), a: () => { if (sel && sel.r.status === 'AWAITING_TRANSPORT' && user.perms.includes('inspect:request')) dispatch({ type: 'techAck', id: sel.r.id, by: user.id }); } });

  return (
    <>
      <div className="st-qhead">
        <h1>{view === 'history' ? 'Technical history' : 'Technical requests'}</h1>
        <p className="st-muted">Technical questions from Revenue NSW. You advise; Revenue NSW decides the customer’s case. Internal response target {TARGETS.tech} days.</p>
      </div>
      <div className="st-toolbar"><div className="st-toolbar__chips"><div className="st-seg" role="group" aria-label="Saved views">
        {TECH_VIEWS.map((x) => <Button key={x.id} size="sm" variant={x.id === v.id ? 'solid' : 'outline'} aria-pressed={x.id === v.id} onClick={() => go(`/staff/requests?view=${x.id}`)}>{x.label}</Button>)}
      </div></div></div>
      <div className="st-pane"><div className="st-grid-wrap is-compact">
        <Table aria-label="Technical requests" className="st-queue">
          <TableHeader><TableRow>
            <TableHead>Request</TableHead><TableHead>Category</TableHead><TableHead>Camera / site</TableHead><TableHead>Problem summary</TableHead><TableHead>Impact</TableHead><TableHead>Requested by</TableHead><TableHead>Due / age</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(({ r, impact, age, due }, i) => {
              const esc = escalation(r, now, state.targets.tech);
              return (
                <TableRow key={r.id} className="st-qrow" data-cursor={i === cur} onClick={() => { setCur(i); go(`/staff/request/${r.id}`); }}>
                  <TableCell><Link to={`/staff/request/${r.id}`} onClick={(e) => e.stopPropagation()}><strong>{r.id}</strong></Link><small className="st-sub">{r.assignee ? findStaff(r.assignee).name : 'Not picked up'}</small></TableCell>
                  <TableCell>{categoryLabel(r.category)}</TableCell>
                  <TableCell>{r.site}<small className="st-sub">{findSite(r.site).suburb}</small></TableCell>
                  <TableCell>{r.summary}</TableCell>
                  <TableCell><Tag size="sm" color={impact === 'Systemic' ? 'danger' : impact === 'Multiple' ? 'warning' : 'grey'}>{impact}</Tag></TableCell>
                  <TableCell>{r.caseId}<small className="st-sub">{findStaff(r.by)?.name}</small></TableCell>
                  <TableCell><Tag size="sm" color={esc.tone}>{human(age)} old</Tag><small className="st-sub">{esc.level === 'overdue' || esc.level === 'escalated' ? `${esc.label}, was due` : 'due'} {fmtDate(new Date(due).toISOString().slice(0, 10))}</small></TableCell>
                  <TableCell><Tag size="sm" color={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Tag>{r.status === 'AWAITING_TRANSPORT' && user.perms.includes('inspect:request') && <Button size="sm" variant="outline" className="st-ack" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'techAck', id: r.id, by: user.id }); }}>Acknowledge</Button>}</TableCell>
                </TableRow>
              );
            })}
            {!rows.length && <TableRow><TableCell colSpan={8} className="st-muted">Nothing here. Requests appear when Revenue NSW asks a technical question.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div></div>
      <p className="st-hint">Keyboard: <Kbd>↑</Kbd> <Kbd>↓</Kbd> move · <Kbd>Enter</Kbd> open · <Kbd>a</Kbd> acknowledge</p>
    </>
  );
}
