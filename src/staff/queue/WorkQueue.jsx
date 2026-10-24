import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Kbd, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nswds/ui';
import { go } from '../../lib/router.js';
import { evaluate } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';
import { CASES, PROGRAMS, STAFF, notice as findNotice, site as findSite, staff as findStaff } from '../../data.js';
import { useHotkeys } from '../hooks/useHotkeys.js';
import { useColumns } from '../hooks/useColumns.js';
import { TARGETS, slaOf } from './sla.js';
import { planFaults } from '../../lib/faults.js';
import { caseState, nextAction, validationOf } from '../../lib/workflow.js';
import { COLUMN_BY_ID } from './columns.jsx';
import { PRESETS, REVENUE_VIEWS, compile, orderRows } from './query.js';
import QueryBar from './QueryBar.jsx';
import CaseWorkbench from './CaseWorkbench.jsx';
import CaseRail from './CaseRail.jsx';
import ColumnChooser from './ColumnChooser.jsx';
import ColumnResizer from './ColumnResizer.jsx';

// A work queue: search, filters, sortable and rearrangeable columns, selection with bulk actions,
// a docked quick view and keyboard shortcuts (j/k, Enter, p, x, a).
export default function WorkQueue({ name, user, initialQuery = '', view = '' }) {
  const { state, dispatch, statusOf, faultSettings } = useStore();
  const type = name === 'court' ? 'court' : 'review';
  const revenue = user.agency === 'rnsw';
  const startQuery = initialQuery || REVENUE_VIEWS.find((v) => v.id === view)?.q || (revenue && name !== 'court' ? REVENUE_VIEWS[0].q : '');
  const canAssign = user.perms.includes('case:decide');
  const cols = useColumns(user.agency);
  const [query, setQuery] = useState(startQuery);
  const queryRef = useRef(null);
  const lastGood = useRef(null);
  const [sort, setSort] = useState({ key: revenue ? 'due' : 'waiting', dir: 'desc' });
  const [picked, setPicked] = useState(() => new Set());
  const [cursor, setCursor] = useState(0);
  const [dock, setDock] = useState(false);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [live, setLive] = useState(null);
  const bodyRef = useRef(null);
  const lastAssign = useRef(null);

  const assigneeOf = (c) => (c.id in state.assign ? state.assign[c.id] : c.assignee);
  // The Revenue review queue holds reviews and court elections together; the Court view narrows it.
  const all = useMemo(() => CASES.filter((c) => name === 'court' ? c.type === 'court' : true).map((c) => {
    const n = findNotice(c.notice);
    const ev = evaluate(n, statusOf);
    const assignee = c.id in state.assign ? state.assign[c.id] : c.assignee;
    const st = caseState(c.id, state, assignee);
    const fault = planFaults(n, faultSettings).certs;
    const validation = validationOf(ev, fault === 'error' || fault === 'missing' ? 'error' : 'ready');
    return { c, n, ev, program: PROGRAMS[findSite(n.site).program].label, sla: slaOf(c), assignee, decision: state.decisions[c.id], state: st, validation, next: nextAction(st, validation) };
  }), [name, state.assign, state.decisions, state.tech, state.reopened, state.targets, statusOf, JSON.stringify(faultSettings)]); // eslint-disable-line

  const compiled = useMemo(() => compile(query, { me: user.id }), [query, user.id]);
  if (compiled.ok) lastGood.current = compiled;
  const active = compiled.ok ? compiled : (lastGood.current || compiled);
  const rows = useMemo(() => {
    const list = all.filter(active.test);
    if (active.order.length) return orderRows(list, active.order);
    const f = COLUMN_BY_ID[sort.key]?.sort || COLUMN_BY_ID.due.sort;
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
    lastAssign.current = { before, ids };
    toast.success(to ? `${ids.length === 1 ? ids[0] : `${ids.length} cases`} assigned to ${to === user.id ? 'you' : who}` : `${ids.length === 1 ? ids[0] : `${ids.length} cases`} unassigned`, {
      action: { label: 'Undo', onClick: () => dispatch({ type: 'assign', map: before, by: user.id, what: `Undid assignment of ${ids.join(', ')}`, ref: ids[0] }) },
    });
  };
  const cursorRow = rows[cursor];
  const targets = () => (picked.size ? [...picked] : cursorRow ? [cursorRow.c.id] : []);

  const typing = () => /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '');
  const move = (to) => setCursor(Math.max(0, Math.min(to, rows.length - 1)));
  const assignMine = () => {
    if (!canAssign) return;
    const ids = targets().filter((id) => assigneeOf(CASES.find((c) => c.id === id)) !== user.id);
    if (ids.length) assign(ids, user.id); else toast.info('Already assigned to you');
  };
  const undoAssign = () => {
    if (typing()) return false;
    const last = lastAssign.current;
    if (!last) { toast.info('Nothing to undo'); return undefined; }
    dispatch({ type: 'assign', map: last.before, by: user.id, what: `Undid assignment of ${last.ids.join(', ')}`, ref: last.ids[0] });
    lastAssign.current = null;
    toast.success('Assignment undone');
    return undefined;
  };

  // Familiar list keys (arrows, Home/End, Page Up/Down, Space, Ctrl+A, Ctrl+Z) alongside the quick ones (j/k, x, a, f).
  // Ctrl+A only when no text is selected; Home, End and Page keys step aside while a case is open.
  useHotkeys({
    j: () => move(cursor + 1), k: () => move(cursor - 1),
    ArrowDown: () => move(cursor + 1), ArrowUp: () => move(cursor - 1),
    // Home, End and Page keys only drive the list when no case is open, so they can scroll the review panes
    Home: () => (dock ? undefined : move(0)), End: () => (dock ? undefined : move(rows.length - 1)),
    PageDown: () => (dock ? undefined : move(cursor + 8)), PageUp: () => (dock ? undefined : move(cursor - 8)),
    Enter: () => cursorRow && setDock(true),
    o: () => cursorRow && go(`/staff/case/${cursorRow.c.id}`),
    p: () => setDock((d) => !d),
    d: () => { if (dock) document.getElementById('qd-outcome')?.focus(); },
    f: () => queryRef.current?.focus(),
    x: () => cursorRow && toggle(cursorRow.c.id),
    ' ': () => cursorRow && toggle(cursorRow.c.id),
    'mod+a': () => { if (typing() || !window.getSelection()?.isCollapsed) return false; setPicked(new Set(rows.map((r) => r.c.id))); return undefined; },
    'mod+z': undoAssign,
    a: assignMine,
    Escape: () => (dock ? setDock(false) : setPicked(new Set())),
  });

  const mine = all.filter((r) => r.assignee === user.id && !r.decision).length;
  const title = name === 'court' ? 'Court elections' : 'Review queue';
  const views = revenue ? REVENUE_VIEWS : PRESETS.map((p) => ({ ...p, id: p.label }));
  const widthOf = (id) => (live && live.id === id ? live.w : cols.width(id));
  const tableW = 44 + 52 + cols.visible.reduce((n, c) => n + widthOf(c.id), 0);
  const docked = dock && cursorRow;

  return (
    <>
      <div className="st-qhead">
        <h1>{title}</h1>
        <p className="st-muted">{mine} unresolved with you · internal reply target {TARGETS.review} days for reviews, {TARGETS.court} for court elections</p>
      </div>

      <div className="st-toolbar" role="search">
        <QueryBar value={query} onChange={(v) => { setQuery(v); setCursor(0); }} inputRef={queryRef} error={compiled.ok ? null : compiled.error} shown={rows.length} total={all.length} />
        {!docked && <div className="st-toolbar__chips">
          <div className="st-seg" role="group" aria-label="Saved filters">
            {views.map((p) => <Button key={p.id} size="sm" variant={query.trim() === p.q ? 'solid' : 'outline'} aria-pressed={query.trim() === p.q} onClick={() => { setQuery(p.q); setCursor(0); }}>{p.label}</Button>)}
          </div>
          <span className="st-toolbar__end">
            <Button size="sm" variant={cols.density === 'compact' ? 'solid' : 'outline'} aria-pressed={cols.density === 'compact'} onClick={() => cols.setDensity(cols.density === 'compact' ? 'comfortable' : 'compact')}>Compact rows</Button>
            <ColumnChooser cols={cols} />
          </span>
        </div>}
      </div>

      {picked.size > 0 && (
        <div className="st-bulk" role="region" aria-label="Bulk actions">
          <strong>{picked.size} selected</strong>
          {canAssign ? (
            <>
              {[...picked].some((id) => assigneeOf(CASES.find((c) => c.id === id)) !== user.id) && <Button size="sm" onClick={() => assign([...picked].filter((id) => assigneeOf(CASES.find((c) => c.id === id)) !== user.id), user.id)}>Assign to me</Button>}
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
      {docked ? (
        <div className="st-pane has-dock">
          <CaseRail rows={rows} cursor={cursor} onSelect={(i) => setCursor(i)} />
          <CaseWorkbench row={cursorRow} agency={user.agency} index={cursor} total={rows.length} user={user}
            onPrev={() => setCursor((c) => Math.max(c - 1, 0))} onNext={() => setCursor((c) => Math.min(c + 1, rows.length - 1))} onClose={() => setDock(false)}
            onDecided={(id) => { const from = rows.findIndex((r) => r.c.id === id); const next = rows.findIndex((r, i) => i > from && !r.decision); const first = rows.findIndex((r) => r.c.id !== id && !r.decision); const to = next >= 0 ? next : first; if (to >= 0) setCursor(to); else toast.success('That was the last open case in this view'); }} />
        </div>
      ) : (
        <div className="st-pane">
        <div className={`st-grid-wrap ${cols.density === 'compact' ? 'is-compact' : ''}`}>
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
                        <DropdownMenuItem onClick={() => { setCursor(i); setDock(true); }}>Review here</DropdownMenuItem>
                        {canAssign && <DropdownMenuSeparator />}
                        {canAssign && r.assignee !== user.id && <DropdownMenuItem onClick={() => assign([r.c.id], user.id)}>{r.assignee ? `Take over from ${findStaff(r.assignee)?.name}` : 'Assign to me'}</DropdownMenuItem>}
                        {canAssign && r.assignee && <DropdownMenuItem onClick={() => assign([r.c.id], null)}>{r.assignee === user.id ? 'Release (unassign)' : 'Unassign'}</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={cols.visible.length + 2} className="st-muted">No cases match. Clear the filters to see everything.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        </div>
      )}
      <p className="st-hint">Keyboard: <Kbd>↑</Kbd> <Kbd>↓</Kbd> move · <Kbd>Enter</Kbd> review · <Kbd>o</Kbd> full case · <Kbd>Space</Kbd> select · <Kbd>Ctrl</Kbd>+<Kbd>A</Kbd> all{canAssign && <> · <Kbd>a</Kbd> assign to me · <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> undo</>} · <Kbd>?</Kbd> all shortcuts · drag a column header to move it, its edge to resize · <Kbd>f</Kbd> filter</p>
    </>
  );
}
