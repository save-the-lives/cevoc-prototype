import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, Kbd, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nswds/ui';
import { go } from '../../lib/router.js';
import { evaluate } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';
import { CASES, PROGRAMS, STAFF, notice as findNotice, site as findSite, staff as findStaff } from '../../data.js';
import { useHotkeys } from '../hooks/useHotkeys.js';
import { useColumns } from '../hooks/useColumns.js';
import { slaOf } from './sla.js';
import { COLUMN_BY_ID } from './columns.jsx';
import CasePreview from './CasePreview.jsx';
import ColumnChooser from './ColumnChooser.jsx';

// A work queue: search, filters, sortable and rearrangeable columns, selection with bulk actions,
// a docked quick view and keyboard shortcuts (j/k, Enter, p, x, a).
export default function WorkQueue({ name, user }) {
  const { state, dispatch, statusOf } = useStore();
  const type = name === 'court' ? 'court' : 'review';
  const canAssign = user.perms.includes('case:decide');
  const cols = useColumns();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('all');
  const [certOnly, setCertOnly] = useState(false);
  const [sort, setSort] = useState({ key: 'sla', dir: 'asc' });
  const [picked, setPicked] = useState(() => new Set());
  const [cursor, setCursor] = useState(0);
  const [dock, setDock] = useState(false);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
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
    const f = COLUMN_BY_ID[sort.key]?.sort || COLUMN_BY_ID.sla.sort;
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
  const cursorRow = rows[cursor];
  const targets = () => (picked.size ? [...picked] : cursorRow ? [cursorRow.c.id] : []);

  useHotkeys({
    j: () => setCursor((c) => Math.min(c + 1, rows.length - 1)),
    k: () => setCursor((c) => Math.max(c - 1, 0)),
    Enter: () => cursorRow && go(`/staff/case/${cursorRow.c.id}`),
    p: () => setDock((d) => !d),
    x: () => cursorRow && toggle(cursorRow.c.id),
    a: () => canAssign && assign(targets(), user.id),
    Escape: () => (dock ? setDock(false) : setPicked(new Set())),
  });

  const open = all.filter((r) => !r.decision).length;
  const mine = all.filter((r) => r.assignee === user.id).length;
  const title = type === 'court' ? 'Court elections' : 'Reviews';
  const docked = dock && cursorRow;

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
        <span className="st-toolbar__end">
          <Button size="sm" variant={cols.density === 'compact' ? 'solid' : 'outline'} aria-pressed={cols.density === 'compact'} onClick={() => cols.setDensity(cols.density === 'compact' ? 'comfortable' : 'compact')}>Compact rows</Button>
          <ColumnChooser cols={cols} />
        </span>
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
      <div className={`st-pane ${docked ? 'has-dock' : ''}`}>
        <div className={`st-grid-wrap ${cols.density === 'compact' || docked ? 'is-compact' : ''}`}>
          <Table aria-label={title} className="st-queue">
            <TableHeader>
              <TableRow>
                <TableHead className="st-col-check"><Checkbox aria-label="Select all rows" checked={allOn} indeterminate={!allOn && picked.size > 0} onCheckedChange={(v) => setPicked(v ? new Set(rows.map((r) => r.c.id)) : new Set())} /></TableHead>
                {cols.visible.map((c) => {
                  const on = sort.key === c.id;
                  return (
                    <TableHead key={c.id} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} draggable
                      className={`st-th ${drag === c.id ? 'is-dragging' : ''} ${over === c.id && drag !== c.id ? 'is-over' : ''}`}
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); setDrag(c.id); }}
                      onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(c.id); } }}
                      onDrop={(e) => { e.preventDefault(); cols.moveTo(drag, c.id); setDrag(null); setOver(null); }}
                      onDragEnd={() => { setDrag(null); setOver(null); }}>
                      <button type="button" className="st-sort" title="Click to sort. Drag to move this column." onClick={() => toggleSort(c.id)}>{c.label}<span aria-hidden="true">{on ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span></button>
                    </TableHead>
                  );
                })}
                <TableHead className="st-col-menu"><span className="sr-only">Row actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={bodyRef}>
              {rows.map((r, i) => (
                <TableRow key={r.c.id} data-cursor={i === cursor} data-selected={picked.has(r.c.id)} className="st-qrow" onClick={() => { setCursor(i); setDock(true); }}>
                  <TableCell onClick={(e) => e.stopPropagation()}><Checkbox aria-label={`Select ${r.c.id}`} checked={picked.has(r.c.id)} onCheckedChange={() => toggle(r.c.id)} /></TableCell>
                  {cols.visible.map((c) => <TableCell key={c.id}>{c.cell(r)}</TableCell>)}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="st-rowmenu" aria-label={`Actions for ${r.c.id}`}>⋯</DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => go(`/staff/case/${r.c.id}`)}>Open case</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setCursor(i); setDock(true); }}>Quick view</DropdownMenuItem>
                        {canAssign && <DropdownMenuSeparator />}
                        {canAssign && <DropdownMenuItem onClick={() => assign([r.c.id], user.id)}>Assign to me</DropdownMenuItem>}
                        {canAssign && r.assignee && <DropdownMenuItem onClick={() => assign([r.c.id], null)}>Unassign</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={cols.visible.length + 2} className="st-muted">No cases match. Clear the filters to see everything.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        {docked && (
          <CasePreview row={cursorRow} index={cursor} total={rows.length} canAssign={canAssign}
            onPrev={() => setCursor((c) => Math.max(c - 1, 0))} onNext={() => setCursor((c) => Math.min(c + 1, rows.length - 1))}
            onClose={() => setDock(false)} onAssignMe={(r) => assign([r.c.id], user.id)} />
        )}
      </div>
      <p className="st-hint">Keyboard: <Kbd>j</Kbd> <Kbd>k</Kbd> move · <Kbd>Enter</Kbd> open · <Kbd>p</Kbd> quick view · <Kbd>x</Kbd> select{canAssign && <> · <Kbd>a</Kbd> assign to me</>} · <Kbd>?</Kbd> all shortcuts · drag a column header to move it</p>
    </>
  );
}
