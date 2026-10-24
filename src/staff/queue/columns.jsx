import { Avatar, AvatarFallback, Tag, Tooltip, TooltipContent, TooltipTrigger } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { fmtDate } from '../../lib/format.js';
import { staff as findStaff } from '../../data.js';
import { PRIORITY } from './sla.js';

const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2);

export function Assignee({ id }) {
  if (!id) return <span className="st-muted">Unassigned</span>;
  const p = findStaff(id);
  return <span className="st-assignee"><Avatar><AvatarFallback>{initials(p.name)}</AvatarFallback></Avatar>{p.name}</span>;
}

// The known set of queue columns. `def` marks the ones shown by default. Staff can show, hide and reorder them.
// `sort` returns the value to sort by; `cell` renders the table cell content for one row.
export const COLUMNS = [
  { id: 'priority', label: 'Priority', def: true, sort: (r) => PRIORITY[r.c.priority].rank, cell: (r) => <Tag size="sm" color={PRIORITY[r.c.priority].tone}>{PRIORITY[r.c.priority].label}</Tag> },
  { id: 'id', label: 'Case', def: true, locked: true, sort: (r) => r.c.id, cell: (r) => <><Link to={`/staff/case/${r.c.id}`} onClick={(e) => e.stopPropagation()}><strong>{r.c.id}</strong></Link><small className="st-sub">{r.c.notice}</small></> },
  { id: 'customer', label: 'Customer', def: true, sort: (r) => r.n.holder, cell: (r) => <>{r.n.holder}<small className="st-sub">{r.n.rego}</small></> },
  { id: 'program', label: 'Program', def: true, sort: (r) => r.program, cell: (r) => r.program },
  { id: 'waiting', label: 'Waiting', def: true, sort: (r) => r.sla.waited, cell: (r) => <Tooltip><TooltipTrigger render={<span><Tag size="sm" color={r.sla.tone}>{r.sla.label}</Tag></span>} /><TooltipContent>Asked {fmtDate(r.c.lodged)}. {r.sla.hint}.</TooltipContent></Tooltip> },
  { id: 'cert', label: 'Certification', def: true, sort: (r) => -r.ev.notCurrent, cell: (r) => <Tag size="sm" color={r.ev.current ? 'success' : 'warning'}>{r.ev.current ? 'Current' : `${r.ev.notCurrent} not current`}</Tag> },
  { id: 'assignee', label: 'Assigned to', def: true, sort: (r) => (r.assignee ? findStaff(r.assignee).name : '~'), cell: (r) => <Assignee id={r.assignee} /> },
  { id: 'status', label: 'Decision', sort: (r) => (r.decision ? r.decision.label : ''), cell: (r) => (r.decision ? <Tag size="sm" color="primary">{r.decision.label}</Tag> : 'Open') },
  { id: 'lodged', label: 'Asked on', sort: (r) => r.c.lodged, cell: (r) => fmtDate(r.c.lodged) },
  { id: 'camera', label: 'Camera', sort: (r) => r.n.site, cell: (r) => r.n.site },
  { id: 'offence', label: 'Offence', sort: (r) => r.n.offence, cell: (r) => r.n.offence },
  { id: 'channel', label: 'Lodged via', sort: (r) => r.c.channel, cell: (r) => r.c.channel },
  { id: 'due', label: 'Target reply', sort: (r) => r.sla.due, cell: (r) => fmtDate(r.sla.due) },
];

export const COLUMN_BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));
