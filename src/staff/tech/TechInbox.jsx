import { useEffect, useMemo, useState } from 'react';
import { Button, Kbd, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { go } from '../../lib/router.js';
import { fmtDate } from '../../lib/format.js';
import { useStore } from '../../lib/store.jsx';
import { TODAY } from '../../lib/format.js';
import { daysBetween } from '../../lib/rules.js';
import { TARGETS } from '../queue/sla.js';
import { REQUEST_STATUS, categoryLabel, impactLevel } from '../../lib/workflow.js';
import { site as findSite, staff as findStaff } from '../../data.js';
import { useHotkeys } from '../hooks/useHotkeys.js';

export const TECH_VIEWS = [
  { id: 'open', label: 'Open', test: (r) => r.status === 'AWAITING_TRANSPORT' },
  { id: 'unassigned', label: 'Not picked up', test: (r) => r.status === 'AWAITING_TRANSPORT' && !r.assignee },
  { id: 'revenue', label: 'Awaiting Revenue NSW', test: (r) => r.status === 'MORE_INFORMATION_REQUIRED' },
  { id: 'answered', label: 'Answered', test: (r) => r.status === 'ADVICE_RECEIVED' },
  { id: 'history', label: 'Technical history', test: (r) => r.status === 'ADVICE_RECEIVED' || r.status === 'CANCELLED' },
  { id: 'all', label: 'All', test: () => true },
];

export const dueOf = (r) => { const d = new Date(`${r.at}T00:00:00`); d.setDate(d.getDate() + TARGETS.tech); return d.toISOString().slice(0, 10); };

// Transport's inbox: only technical questions, never the whole Revenue NSW review queue.
export default function TechInbox({ user, view = 'open' }) {
  const { state, dispatch } = useStore();
  const [cur, setCur] = useState(0);
  const v = TECH_VIEWS.find((x) => x.id === view) || TECH_VIEWS[0];
  const rows = useMemo(() => state.tech.filter(v.test).map((r) => ({ r, impact: impactLevel(r, state.tech), age: Math.max(daysBetween(r.at, TODAY), 0), due: dueOf(r) }))
    .sort((a, b) => a.due.localeCompare(b.due)), [state.tech, v, state.targets]); // eslint-disable-line
  useEffect(() => { setCur((c) => Math.min(c, Math.max(rows.length - 1, 0))); }, [rows.length]);
  const sel = rows[cur];
  useHotkeys({ j: () => setCur((c) => Math.min(c + 1, rows.length - 1)), k: () => setCur((c) => Math.max(c - 1, 0)), ArrowDown: () => setCur((c) => Math.min(c + 1, rows.length - 1)), ArrowUp: () => setCur((c) => Math.max(c - 1, 0)),
    Enter: () => sel && go(`/staff/request/${sel.r.id}`), a: () => { if (sel && !sel.r.assignee && user.perms.includes('inspect:request')) dispatch({ type: 'techAssign', id: sel.r.id, to: user.id, by: user.id }); } });

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
              const late = due < TODAY && r.status === 'AWAITING_TRANSPORT';
              return (
                <TableRow key={r.id} className="st-qrow" data-cursor={i === cur} onClick={() => { setCur(i); go(`/staff/request/${r.id}`); }}>
                  <TableCell><Link to={`/staff/request/${r.id}`} onClick={(e) => e.stopPropagation()}><strong>{r.id}</strong></Link><small className="st-sub">{r.assignee ? findStaff(r.assignee).name : 'Not picked up'}</small></TableCell>
                  <TableCell>{categoryLabel(r.category)}</TableCell>
                  <TableCell>{r.site}<small className="st-sub">{findSite(r.site).suburb}</small></TableCell>
                  <TableCell>{r.summary}</TableCell>
                  <TableCell><Tag size="sm" color={impact === 'Systemic' ? 'danger' : impact === 'Multiple' ? 'warning' : 'grey'}>{impact}</Tag></TableCell>
                  <TableCell>{r.caseId}<small className="st-sub">{findStaff(r.by)?.name}</small></TableCell>
                  <TableCell><Tag size="sm" color={late ? 'danger' : 'grey'}>{age} day{age === 1 ? '' : 's'}</Tag><small className="st-sub">{late ? 'overdue, was due' : 'due'} {fmtDate(due)}</small></TableCell>
                  <TableCell><Tag size="sm" color={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Tag></TableCell>
                </TableRow>
              );
            })}
            {!rows.length && <TableRow><TableCell colSpan={8} className="st-muted">Nothing here. Requests appear when Revenue NSW asks a technical question.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div></div>
      <p className="st-hint">Keyboard: <Kbd>↑</Kbd> <Kbd>↓</Kbd> move · <Kbd>Enter</Kbd> open · <Kbd>a</Kbd> pick up</p>
    </>
  );
}
