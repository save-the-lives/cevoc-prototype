import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Kbd, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nswds/ui';
import { go } from '../../lib/router.js';
import { evaluate } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';
import { CASES, PROGRAMS, STAFF, notice as findNotice, site as findSite, staff as findStaff } from '../../data.js';
import { useHotkeys } from '../hooks/useHotkeys.js';
import { useColumns } from '../hooks/useColumns.js';
import { slaOf } from './sla.js';
import { COLUMN_BY_ID } from './columns.jsx';
import { PRESETS, compile, orderRows } from './query.js';
import QueryBar from './QueryBar.jsx';
import CasePreview from './CasePreview.jsx';
import ColumnChooser from './ColumnChooser.jsx';
import ColumnResizer from './ColumnResizer.jsx';

// A work queue: search, filters, sortable and rearrangeable columns, selection with bulk actions,
// a docked quick view and keyboard shortcuts (j/k, Enter, p, x, a).
export default function WorkQueue({ name, user }) {
  const { state, dispatch, statusOf } = useStore();
  const type = name === 'court' ? 'court' : 'review';
  const canAssign = user.perms.includes('case:decide');
  const cols = useColumns();
  const [query, setQuery] = useState('');
  const queryRef = useRef(null);
  const lastGood = useRef(null);
  const [sort, setSort] = useState({ key: 'waiting', dir: 'desc' });
  const [picked, setPicked] = useState(() => new Set());
  const [cursor, setCursor] = useState(0);
  const [dock, setDock] = useState(false);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [live, setLive] = useState(null);
  const bodyRef = useRef(null);

  const assigneeOf = (c) => (c.id in state.assign ? state.assign[c.id] : c.assignee);
  const all = useMemo(() => CASES.filter((c) => c.type === type).map((c) => {
    const n = findNotice(c.notice);
    return { c, n, ev: evaluate(n, statusOf), program: PROGRAMS[findSite(n.site).program].label, sla: slaOf(c), assignee: c.id in state.assign ? state.assign[c.id] : c.assignee, decision: state.decisions[c.id] };
  }), [type, state.assign, state.decisions, statusOf]);

  const compiled = useMemo(() => compile(query, { me: user.id }), [query, user.id]);
  if (compiled.ok) lastGood.current = compiled;
  const active = compiled.ok ? compiled : (lastGood.current || compiled);
  const rows = useMemo(() => {
    const list = all.filter(active.test);
    if (active.order.length) return orderRows(list, active.order);
    const f = COLUMN_BY_ID[sort.key]?.sort || COLUMN_BY_ID.waiting.sort;
    return [...list].sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1));
  }, [all, active, sort]);

  useEffect(() => { setCursor((c) => Math.min(c, Math.max(rows.length - 1, 0))); }, [rows.length]);
  useEffect(() => { bodyRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' }); }, [cursor]);

  const toggleSort = (key) => { setQuery((t) => t.replace(/\s*order\s+by[\s\S]*$/i, '')); setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })); };
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
    f: () => queryRef.current?.focus(),
    x: () => cursorRow && toggle(cursorRow.c.id),
    a: () => canAssign && assign(targets(), user.id),
    Escape: () => (dock ? setDock(false) : setPicked(new Set())),
  });

  const mine = all.filter((r) => r.assignee === user.id).length;
  const title = type === 'court' ? 'Court elections' : 'Reviews';
  const widthOf = (id) => (live && live.id === id ? live.w : cols.width(id));
  const tableW = 44 + 52 + cols.visible.reduce((n, c) => n + widthOf(c.id), 0);
  const docked = dock && cursorRow;

  return (
    <>
      <div className="st-qhead">
        <h1>{title}</h1>
        <p className="st-muted">{mine} assigned to you · aim to reply within {type === 'court' ? '42' : '28'} days of the request</p>
      </div>

      <div className="st-toolbar" role="search">
        <QueryBar value={query} onChange={(v) => { setQuery(v); setCursor(0); }} inputRef={queryRef} error={compiled.ok ? null : compiled.error} shown={rows.length} total={all.length} />
        <div className="st-toolbar__chips">
          <div className="st-seg" role="group" aria-label="Saved filters">
            {PRESETS.map((p) => <Button key={p.label} size="sm" variant={query.trim() === p.q ? 'solid' : 'outline'} aria-pressed={query.trim() === p.q} onClick={() => { setQuery(p.q); setCursor(0); }}>{p.label}</Button>)}
          </div>
          <span className="st-toolbar__end">
            <Button size="sm" variant={cols.density === 'compact' ? 'solid' : 'outline'} aria-pressed={cols.density === 'compact'} onClick={() => cols.setDensity(cols.density === 'compact' ? 'comfortable' : 'compact')}>Compact rows</Button>
            <ColumnChooser cols={cols} />
          </span>
        </div>
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
          <Table aria-label={title} className="st-queue" style={{ tableLayout: 'fixed', width: `max(100%, ${tableW}px)` }}>
            <colgroup>
              <col style={{ width: 44 }} />
              {cols.visible.map((c) => <col key={c.id} style={{ width: widthOf(c.id) }} />)}
              <col style={{ width: 52 }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="st-col-check"><Checkbox aria-label="Select all rows" checked={allOn} indeterminate={!allOn && picked.size > 0} onCheckedChange={(v) => setPicked(v ? new Set(rows.map((r) => r.c.id)) : new Set())} /></TableHead>
                {cols.visible.map((c) => {
                  const ord = active.order[0]; const on = ord ? ord.key === c.id : sort.key === c.id; const dir = ord ? ord.dir : sort.dir;
                  return (
                    <TableHead key={c.id} aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} draggable
                      className={`st-th ${drag === c.id ? 'is-dragging' : ''} ${over === c.id && drag !== c.id ? 'is-over' : ''}`}
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); setDrag(c.id); }}
                      onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(c.id); } }}
                      onDrop={(e) => { e.preventDefault(); cols.moveTo(drag, c.id); setDrag(null); setOver(null); }}
                      onDragEnd={() => { setDrag(null); setOver(null); }}>
                      <button type="button" className="st-sort" title="Click to sort. Drag to move this column." onClick={() => toggleSort(c.id)}>{c.label}<span aria-hidden="true">{on ? (dir === 'asc' ? '▲' : '▼') : ''}</span></button>
                      <ColumnResizer label={c.label} width={widthOf(c.id)} onLive={(w) => setLive({ id: c.id, w })} onCommit={(w) => { cols.setWidth(c.id, w); setLive(null); }} onReset={() => cols.resetWidth(c.id)} />
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
      <p className="st-hint">Keyboard: <Kbd>j</Kbd> <Kbd>k</Kbd> move · <Kbd>Enter</Kbd> open · <Kbd>p</Kbd> quick view · <Kbd>x</Kbd> select{canAssign && <> · <Kbd>a</Kbd> assign to me</>} · <Kbd>?</Kbd> all shortcuts · drag a column header to move it, its edge to resize · <Kbd>f</Kbd> filter</p>
    </>
  );
}
