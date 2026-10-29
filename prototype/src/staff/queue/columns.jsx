import { Avatar, AvatarFallback, Tag, Tooltip, TooltipContent, TooltipTrigger } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { fmtDate } from '../../lib/format.js';
import { staff as findStaff } from '../../data.js';
import { PRIORITY } from './sla.js';
import { CASE_STATE } from '../../lib/workflow.js';

const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2);

export function Assignee({ id }) {
  if (!id) return <span className="st-muted">Unassigned</span>;
  const p = findStaff(id);
  return <span className="st-assignee"><Avatar><AvatarFallback>{initials(p.name)}</AvatarFallback></Avatar>{p.name}</span>;
}

// The known set of queue columns. `def` marks the ones shown by default. Staff can show, hide and reorder them.
// `sort` returns the value to sort by; `cell` renders the table cell content for one row.
export const COLUMNS = [
  { id: 'ref', w: 92, label: 'Review ID', locked: true, sort: (r) => r.c.id, cell: (r) => <Link to={`/staff/case/${r.c.id}`} onClick={(e) => e.stopPropagation()}><strong>{r.c.id}</strong></Link> },
  { id: 'noticeNo', w: 110, label: 'Penalty notice', sort: (r) => r.c.notice, cell: (r) => r.c.notice },
  { id: 'category', w: 140, label: 'Reason', sort: (r) => r.c.category, cell: (r) => <>{r.c.category}{r.c.type === 'court' && <small className="st-sub">Court election</small>}</> },
  { id: 'validation', w: 120, label: 'Validation', sort: (r) => r.validation.label, cell: (r) => <Tag size="sm" color={r.validation.tone}>{r.validation.label}</Tag> },
  { id: 'state', w: 175, label: 'Status', sort: (r) => r.state, cell: (r) => <Tag size="sm" color={CASE_STATE[r.state].tone}>{CASE_STATE[r.state].label}</Tag> },
  { id: 'due', w: 135, label: 'Waiting / due', sort: (r) => r.sla.waited, cell: (r) => <Tooltip><TooltipTrigger render={<span><Tag size="sm" color={r.sla.tone}>{r.sla.label}</Tag><small className="st-sub">due {fmtDate(r.sla.due)}</small></span>} /><TooltipContent>Asked {fmtDate(r.c.lodged)}. {r.sla.hint}.</TooltipContent></Tooltip> },
  { id: 'next', w: 125, label: 'Next action', sort: (r) => r.next.label, cell: (r) => <Tag size="sm" color={r.next.tone}>{r.next.label}</Tag> },
  { id: 'priority', w: 96, label: 'Priority', sort: (r) => PRIORITY[r.c.priority].rank, cell: (r) => <Tag size="sm" color={PRIORITY[r.c.priority].tone}>{PRIORITY[r.c.priority].label}</Tag> },
  { id: 'id', w: 150, label: 'Case and notice', sort: (r) => r.c.id, cell: (r) => <><Link to={`/staff/case/${r.c.id}`} onClick={(e) => e.stopPropagation()}><strong>{r.c.id}</strong></Link><small className="st-sub">{r.c.notice}</small></> },
  { id: 'customer', w: 180, label: 'Customer', sort: (r) => r.n.holder, cell: (r) => <>{r.n.holder}<small className="st-sub">{r.n.rego}</small></> },
  { id: 'program', w: 200, label: 'Program', sort: (r) => r.program, cell: (r) => r.program },
  { id: 'waiting', w: 120, label: 'Waiting', sort: (r) => r.sla.waited, cell: (r) => <Tooltip><TooltipTrigger render={<span><Tag size="sm" color={r.sla.tone}>{r.sla.label}</Tag></span>} /><TooltipContent>Asked {fmtDate(r.c.lodged)}. {r.sla.hint}.</TooltipContent></Tooltip> },
  { id: 'cert', w: 150, label: 'Certification', sort: (r) => -r.ev.notCurrent, cell: (r) => <Tag size="sm" color={r.ev.current ? 'success' : 'warning'}>{r.ev.current ? 'Current' : `${r.ev.notCurrent} not current`}</Tag> },
  { id: 'assignee', w: 170, label: 'Assigned to', sort: (r) => (r.assignee ? findStaff(r.assignee).name : '~'), cell: (r) => <Assignee id={r.assignee} /> },
  { id: 'status', w: 120, label: 'Decision', sort: (r) => (r.decision ? r.decision.label : ''), cell: (r) => (r.decision ? <Tag size="sm" color="primary">{r.decision.label}</Tag> : 'Open') },
  { id: 'lodged', w: 150, label: 'Asked on', sort: (r) => r.c.lodged, cell: (r) => fmtDate(r.c.lodged) },
  { id: 'camera', w: 110, label: 'Camera', sort: (r) => r.n.site, cell: (r) => r.n.site },
  { id: 'offence', w: 260, label: 'Offence', sort: (r) => r.n.offence, cell: (r) => r.n.offence },
  { id: 'channel', w: 190, label: 'Lodged via', sort: (r) => r.c.channel, cell: (r) => r.c.channel },
  { id: 'target', w: 150, label: 'Target reply', sort: (r) => r.sla.due, cell: (r) => fmtDate(r.sla.due) },
];

// Columns shown to start with, in order, for each agency. Everything else is available from the column chooser.
export const DEFAULT_COLUMNS = {
  rnsw: ['ref', 'noticeNo', 'category', 'validation', 'state', 'due', 'assignee', 'next'],
  tfnsw: ['id', 'program', 'cert', 'assignee'],
};

export const COLUMN_BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));

export const MIN_WIDTH = 64;
