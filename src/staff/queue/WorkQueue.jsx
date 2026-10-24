import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, Button, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, Kbd, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag, Tooltip, TooltipContent, TooltipTrigger } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { go } from '../../lib/router.js';
import { fmtDate } from '../../lib/format.js';
import { evaluate } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';
import { CASES, PROGRAMS, STAFF, notice as findNotice, site as findSite, staff as findStaff } from '../../data.js';
import { useHotkeys } from '../hooks/useHotkeys.js';
import { PRIORITY, slaOf } from './sla.js';
import CasePreview from './CasePreview.jsx';

const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2);
const SORTS = {
  priority: (r) => PRIORITY[r.c.priority].rank, id: (r) => r.c.id, customer: (r) => r.n.holder, program: (r) => r.program,
  lodged: (r) => r.c.lodged, sla: (r) => r.sla.days, cert: (r) => -r.ev.notCurrent, assignee: (r) => (r.assignee ? findStaff(r.assignee).name : '~'),
};

function Assignee({ id }) {
  if (!id) return <span className="st-muted">Unassigned</span>;
  const p = findStaff(id);
  return <span className="st-assignee"><Avatar><AvatarFallback>{initials(p.name)}</AvatarFallback></Avatar>{p.name}</span>;
}

function SortHead({ id, sort, onSort, children }) {
  const on = sort.key === id;
  return (
    <TableHead aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="st-sort" onClick={() => onSort(id)}>{children}<span aria-hidden="true">{on ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span></button>
    </TableHead>
  );
}

// A work queue: search, filters, sortable columns, selection with bulk actions, a quick-view
// flyout and a full set of keyboard shortcuts (j/k, Enter, p, x, a).
export default function WorkQueue({ name, user }) {
  const { state, dispatch, statusOf } = useStore();
  const type = name === 'court' ? 'court' : 'review';
  const canAssign = user.perms.includes('case:decide');
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('all');
  const [certOnly, setCertOnly] = useState(false);
  const [sort, setSort] = useState({ key: 'sla', dir: 'asc' });
  const [picked, setPicked] = useState(() => new Set());
  const [cursor, setCursor] = useState(0);
  const [previewId, setPreviewId] = useState(null);
  const bodyRef = useRef(null);

  const assigneeOf = (c) => (c.id in state.assign ? state.assign[c.id] : c.assignee);
  const all = useMemo(() => CASES.filter((c) => c.type === type).map((c) => {
    const n = findNotice(c.notice);
    return { c, n, ev: evaluate(n, statusOf), program: PROGRAMS[findSite(n.site).program].label, sla: slaOf(c), assignee: c.id in state.assign ? state.assign[c.id] : c.assignee, decision: state.decisions[c.id] };
  }), [type, state.assign, state.decisions, statusOf]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = all.filter((r) => (!t || `${r.c.id} ${r.c.notice} ${r.n.holder} ${r.n.rego} ${r.program}`.toLowerCase().includes(t))
      && (scope === 'all' || (scope === 'mine' ? r.assignee === user.id : !r.assignee)) && (!certOnly || !r.ev.current));
    const f = SORTS[sort.key];
    return [...list].sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1));
  }, [all, q, scope, certOnly, sort, user.id]);

  useEffect(() => { setCursor((c) => Math.min(c, Math.max(rows.length - 1, 0))); }, [rows.length]);
  useEffect(() => { bodyRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' }); }, [cursor]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const toggle = (id) => setPicked((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const allOn = rows.length > 0 && rows.every((r) => picked.has(r.c.id));

  const assign = (ids, to) => {
    if (!ids.length) return;
    const before = Object.fromEntries(ids.map((id) => [id, assigneeOf(CASES.find((c) => c.id === id))]));
    const who = to ? findStaff(to).name : 'nobody';
    dispatch({ type: 'assign', map: Object.fromEntries(ids.map((id) => [id, to])), by: user.id, what: `Assigned ${ids.join(', ')} to ${who}`, ref: ids[0] });
    setPicked(new Set());
    toast.success(to ? `${ids.length === 1 ? ids[0] : `${ids.length} cases`} assigned to ${to === user.id ? 'you' : who}` : `${ids.length === 1 ? ids[0] : `${ids.length} cases`} unassigned`, {
      action: { label: 'Undo', onClick: () => dispatch({ type: 'assign', map: before, by: user.id, what: `Undid assignment of ${ids.join(', ')}`, ref: ids[0] }) },
    });
  };
  const targets = (extra) => (picked.size ? [...picked] : extra ? [extra] : []);
  const cursorRow = rows[cursor];

  useHotkeys({
    j: () => setCursor((c) => Math.min(c + 1, rows.length - 1)),
    k: () => setCursor((c) => Math.max(c - 1, 0)),
    Enter: () => cursorRow && go(`/staff/case/${cursorRow.c.id}`),
    p: () => cursorRow && setPreviewId(cursorRow.c.id),
    x: () => cursorRow && toggle(cursorRow.c.id),
    a: () => canAssign && assign(targets(cursorRow?.c.id), user.id),
    Escape: () => setPicked(new Set()),
  });

  const open = all.filter((r) => !r.decision).length;
  const mine = all.filter((r) => r.assignee === user.id).length;
  const preview = all.find((r) => r.c.id === previewId) || null;
  const title = type === 'court' ? 'Court elections' : 'Reviews';

  return (
    <>
      <div className="st-qhead">
        <h1>{title}</h1>
        <p className="st-muted">{open} open · {mine} assigned to you · response due {type === 'court' ? '42' : '28'} days after lodging</p>
      </div>

      <div className="st-toolbar" role="search">
        <Input className="st-toolbar__q" type="search" aria-label={`Filter ${title.toLowerCase()}`} placeholder="Filter by case, notice, customer, plate or program" value={q} onChange={(e) => { setQ(e.target.value); setCursor(0); }} />
        <div className="st-seg" role="group" aria-label="Assignment">
          {[['all', 'All'], ['mine', 'Mine'], ['unassigned', 'Unassigned']].map(([v, l]) => (
            <Button key={v} size="sm" variant={scope === v ? 'solid' : 'outline'} aria-pressed={scope === v} onClick={() => setScope(v)}>{l}</Button>
          ))}
        </div>
        <Button size="sm" variant={certOnly ? 'solid' : 'outline'} color={certOnly ? 'warning' : 'primary'} aria-pressed={certOnly} onClick={() => setCertOnly((v) => !v)}>Certificate not current</Button>
      </div>

      {picked.size > 0 && (
        <div className="st-bulk" role="region" aria-label="Bulk actions">
          <strong>{picked.size} selected</strong>
          {canAssign ? (
            <>
              <Button size="sm" onClick={() => assign([...picked], user.id)}>Assign to me</Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="sm" variant="outline">Assign to…</Button>} />
                <DropdownMenuContent align="start">
                  {STAFF.filter((p) => p.perms.includes('case:decide')).map((p) => <DropdownMenuItem key={p.id} onClick={() => assign([...picked], p.id)}>{p.name}</DropdownMenuItem>)}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => assign([...picked], null)}>Unassign</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : <span className="st-muted">Revenue NSW assigns and decides these cases.</span>}
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear <Kbd>Esc</Kbd></Button>
        </div>
      )}

      <p className="sr-only" aria-live="polite">{rows.length} cases shown{cursorRow ? `. Row ${cursor + 1}: ${cursorRow.c.id}` : ''}</p>
      <div className="st-grid-wrap">
        <Table aria-label={title} className="st-queue">
          <TableHeader>
            <TableRow>
              <TableHead className="st-col-check"><Checkbox aria-label="Select all rows" checked={allOn} indeterminate={!allOn && picked.size > 0} onCheckedChange={(v) => setPicked(v ? new Set(rows.map((r) => r.c.id)) : new Set())} /></TableHead>
              <SortHead id="priority" sort={sort} onSort={toggleSort}>Priority</SortHead>
              <SortHead id="id" sort={sort} onSort={toggleSort}>Case</SortHead>
              <SortHead id="customer" sort={sort} onSort={toggleSort}>Customer</SortHead>
              <SortHead id="program" sort={sort} onSort={toggleSort}>Program</SortHead>
              <SortHead id="lodged" sort={sort} onSort={toggleSort}>Lodged</SortHead>
              <SortHead id="sla" sort={sort} onSort={toggleSort}>Response</SortHead>
              <SortHead id="cert" sort={sort} onSort={toggleSort}>Certification</SortHead>
              <SortHead id="assignee" sort={sort} onSort={toggleSort}>Assigned to</SortHead>
              <TableHead>Status</TableHead>
              <TableHead className="st-col-menu"><span className="sr-only">Row actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={bodyRef}>
            {rows.map((r, i) => (
              <TableRow key={r.c.id} data-cursor={i === cursor} data-selected={picked.has(r.c.id)} className="st-qrow" onClick={() => { setCursor(i); setPreviewId(r.c.id); }}>
                <TableCell onClick={(e) => e.stopPropagation()}><Checkbox aria-label={`Select ${r.c.id}`} checked={picked.has(r.c.id)} onCheckedChange={() => toggle(r.c.id)} /></TableCell>
                <TableCell><Tag size="sm" color={PRIORITY[r.c.priority].tone}>{PRIORITY[r.c.priority].label}</Tag></TableCell>
                <TableCell><Link to={`/staff/case/${r.c.id}`} onClick={(e) => e.stopPropagation()}><strong>{r.c.id}</strong></Link><small className="st-sub">{r.c.notice}</small></TableCell>
                <TableCell>{r.n.holder}<small className="st-sub">{r.n.rego}</small></TableCell>
                <TableCell>{r.program}</TableCell>
                <TableCell>{fmtDate(r.c.lodged)}</TableCell>
                <TableCell><Tooltip><TooltipTrigger render={<span><Tag size="sm" color={r.sla.tone}>{r.sla.label}</Tag></span>} /><TooltipContent>Response due {fmtDate(r.sla.due)}</TooltipContent></Tooltip></TableCell>
                <TableCell><Tag size="sm" color={r.ev.current ? 'success' : 'warning'}>{r.ev.current ? 'Current' : `${r.ev.notCurrent} not current`}</Tag></TableCell>
                <TableCell><Assignee id={r.assignee} /></TableCell>
                <TableCell>{r.decision ? <Tag size="sm" color="primary">{r.decision.label}</Tag> : 'Open'}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="st-rowmenu" aria-label={`Actions for ${r.c.id}`}>⋯</DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => go(`/staff/case/${r.c.id}`)}>Open case</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPreviewId(r.c.id)}>Quick view</DropdownMenuItem>
                      {canAssign && <DropdownMenuSeparator />}
                      {canAssign && <DropdownMenuItem onClick={() => assign([r.c.id], user.id)}>Assign to me</DropdownMenuItem>}
                      {canAssign && r.assignee && <DropdownMenuItem onClick={() => assign([r.c.id], null)}>Unassign</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={11} className="st-muted">No cases match. Clear the filters to see everything.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="st-hint">Keyboard: <Kbd>j</Kbd> <Kbd>k</Kbd> move · <Kbd>Enter</Kbd> open · <Kbd>p</Kbd> quick view · <Kbd>x</Kbd> select{canAssign && <> · <Kbd>a</Kbd> assign to me</>} · <Kbd>?</Kbd> all shortcuts</p>

      <CasePreview row={preview} onClose={() => setPreviewId(null)} canAssign={canAssign} onAssignMe={(r) => { assign([r.c.id], user.id); setPreviewId(null); }} />
    </>
  );
}
