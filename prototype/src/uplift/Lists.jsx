import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from '../shared/ui.jsx';
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxValue, useComboboxAnchor } from '@nswds/ui';
import { OPEN, PATHS, PHASES, PRIORITIES, QUESTIONS, STATUS, STORIES, USERS, isBacklog } from './data.js';
import { ADRS, ADR_STATUS } from './adrs.js';
import { compile, suggest, unknownField } from './jql.js';
import { exportXlsx, idNum, importXlsx, useItemState } from './state.js';
import { AC_BRD, CROSS, DOD, checkFor } from './acceptance.js';

// Hub Stories, Questions and ADRs pages (owner, 25-26 Nov 2026): tagged, filterable, JQL-style searchable with
// autocomplete, sortable; a pencil button edits each item in place; Add creates a new item with the next free ID;
// Delete is soft (hidden, restorable, exported with Deleted = Yes). Changes are kept on the server when the site runs
// on Apache/XAMPP with PHP (shared, no login), otherwise in this browser (see state.js). Export the latest state to
// Excel and import it back. Every question links to at least one story, or says why it can't.

const Tag = ({ open, children }) => <span className={`uh-tag ${open ? 'is-open' : 'is-done'}`}>{children}</span>;
const BRDS = ['BR_01', 'BR_02', 'BR_03', 'BR_04', 'BR_05', 'BR_06', 'BR_07', 'BR_08', 'BR_09', 'BR_10'];
const SCREENS = ['search', 'record', 'fields', 'entry', 'journey'];
const today = () => new Date().toISOString().slice(0, 10);
const split = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,;]+|\s+(?=BR_)/).map((x) => x.trim()).filter(Boolean));
const uniq = (xs) => [...new Set(xs.filter(Boolean))].sort();

// Published baselines and templates for new items (shared by all three pages, so links stay consistent).
const STORY_BASE = STORIES.map((s) => ({ ...s, comment: '', tags: s.tags || '', phase: s.phase || PHASES[0] }));
const Q_BASE = QUESTIONS.map((x) => ({ ...x, answer: '', tags: x.tags || '', priority: x.priority || '', phase: x.phase || PHASES[0] }));
const ADR_BASE = ADRS.map((a) => ({ ...a, notes: '', tags: '' }));
const STORY_NEW = { phase: PHASES[0], role: '', want: '', so: '', screen: 'search', acText: '', qs: [], priority: 'Medium', user: USERS[0], path: PATHS[0], brd: [], tags: '', comment: '' };
const Q_NEW = { phase: PHASES[0], topic: '', q: '', why: '', assume: '', who: '', action: '', at: [], status: 'Assumption to validate', priority: '', tags: '', answer: '', noStoryReason: '' };
const ADR_NEW = { title: '', context: '', options: [], decision: '', consequences: '', qs: [], stories: [], status: 'Proposed', tags: '', notes: '' };

// Criteria as text, one per line. An edited or imported text (acText) wins over the published Given/When/Then list.
const acOf = (s) => (String(s.acText || '').trim() ? String(s.acText).split(/\n+/).map((x) => x.trim().replace(/^\d+\.\s*/, '')).filter(Boolean)
  : Array.isArray(s.ac) ? s.ac.map((a) => `Given ${a.g}, when ${a.w}, then ${a.t}.`) : []);
const acBrd = (s, n) => AC_BRD[`${s.id}.${n}`] || split(s.brd).join(', ') || '—';
// Phase (owner, 26 Nov 2026): an imported or typed value is mapped to one of the two phases.
const normPhase = (v) => (/backlog|phase\s*2|\b2\b/i.test(String(v)) ? PHASES[1] : PHASES[0]);
const PhaseChip = ({ x }) => <span className={`ls-chip ${isBacklog(x) ? 'is-backlog' : 'is-phase1'}`}>{isBacklog(x) ? 'Backlog (Phase 2): not in phase 1' : 'Phase 1'}</span>;
// Revenue NSW officer stories (owner, 27 Nov 2026): the page Revenue NSW staff are meant to use may get few or no hits, so these
// stories are likely to be de-scoped pending Revenue NSW's confirmation. Hidden by default (an editable JQL query), shown on request.
export const REVNSW_USER = 'Revenue NSW officer';
const REVNSW_Q = `user != "${REVNSW_USER}"`;
const REVNSW_NOTE = 'Pending Revenue NSW confirmation: likely to be de-scoped';
const coverage = (s) => { const n = acOf(s).length; const k = acOf(s).filter((_, i) => checkFor(s.id, i + 1)).length; return { n, k }; };

// Definition of Done and cross-cutting criteria, shown above the stories (owner, 26 Nov 2026).
function DoneAndCross() {
  return (
    <details className="uh-card ls-dod">
      <summary><strong>Definition of Done</strong> and cross-cutting acceptance criteria (X1 to X{CROSS.length})</summary>
      <ol>{DOD.map((x) => <li key={x}>{x}</li>)}</ol>
      <h3 className="uh-h3">Cross-cutting criteria (every story, every screen)</h3>
      <ol className="uh-ac ls-ac">{CROSS.map((c) => (
        <li key={c.id} id={c.id}><strong>{c.id} {c.area}.</strong> <b>Given</b> {c.g}, <b>when</b> {c.w}, <b>then</b> {c.t}. <AcCheck name={c.check} brd={c.brd} />{c.note && <span className="ls-meta"> {c.note}</span>}</li>
      ))}</ol>
    </details>
  );
}
const AcCheck = ({ name, brd }) => (
  <span className="ls-acmeta">
    {name ? <span className="ls-chip is-auto" title="Automated: Playwright check in tests/acceptance/run.cjs">✓ Automated: <code>{name}</code></span> : <span className="ls-chip is-manual">Manual</span>}
    {brd && brd !== '—' && <span className="ls-chip is-brd">{brd}</span>}
  </span>
);
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const readyOf = (s, qmap) => {
  if (s.readyOverride === 'Ready') return true;
  if (s.readyOverride === 'Not ready') return false;
  return acOf(s).length > 0 && !split(s.qs).some((id) => qmap[id] && !qmap[id].deleted && OPEN(qmap[id]));
};

// The three lists, live (published + changes), for cross-links on every page.
function useAll() {
  const stories = useItemState('stories', STORY_BASE, STORY_NEW);
  const questions = useItemState('questions', Q_BASE, Q_NEW);
  const adrs = useItemState('adrs', ADR_BASE, ADR_NEW);
  const qmap = byId(questions.all);
  return {
    stories, questions, adrs, qmap, smap: byId(stories.all), amap: byId(adrs.all),
    storiesFor: (qid) => stories.items.filter((s) => split(s.qs).includes(qid)),
    adrsFor: (key, id) => adrs.items.filter((a) => split(a[key]).includes(id)),
  };
}

// A link to another item; says so when it was deleted or does not exist.
function Ref({ kind, id, map, open }) {
  const it = map[id];
  const to = kind === 'q' ? `/uplift/hub/questions?q=${id}` : kind === 's' ? `/uplift/hub/stories?s=${id}` : `/uplift/hub/adr?a=${id}`;
  if (!it) return <span className="uh-qref is-gone">{id} (not found)</span>;
  return <Link to={to} className={`uh-qref${it.deleted ? ' is-gone' : ''}`}>{id}{it.deleted ? ' (deleted)' : open && OPEN(it) ? ' (open)' : ''}</Link>;
}
const Refs = ({ ids, ...p }) => split(ids).map((id) => <Ref key={id} id={id} {...p} />);

// Searchable multi-select for links (owner, 26 Nov 2026): the NSW Design System combobox with chips, as on the
// staff search. Items are "ID · title"; the value is a list of IDs. Escape closes the list and never clears the
// links (the combobox's default clears every chip on Escape).
const optLabel = { q: (x) => `${x.id} · ${x.topic || x.q || 'New question'}`, s: (x) => `${x.id} · ${x.want || 'New story'}`, a: (x) => `${x.id} · ${x.title || 'New ADR'}` };
const idOfLabel = (l) => String(l).split(' · ')[0];
function LinkPicker({ label, kind, items, value, onChange }) {
  const id = useId();
  const anchor = useComboboxAnchor();
  const all = items.map(optLabel[kind]);
  const byIdLabel = Object.fromEntries(items.map((x) => [x.id, optLabel[kind](x)]));
  const sel = split(value).map((v) => byIdLabel[v] || v);
  return (
    <div className="ls-pick is-wide">
      <label htmlFor={`${id}-in`}>{label}</label>
      <Combobox items={all} multiple value={sel} onValueChange={(v, d) => { if (d?.reason !== 'escape-key') onChange(v.map(idOfLabel)); }}>
        <ComboboxChips ref={anchor} className="uh-chips">
          <ComboboxValue>{(vals) => vals.map((item) => <ComboboxChip key={item} removeLabel={`Unlink ${idOfLabel(item)}`}>{item}</ComboboxChip>)}</ComboboxValue>
          <ComboboxChipsInput id={`${id}-in`} placeholder={sel.length ? 'Link another' : 'Type an ID or words to link'} />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>Nothing matches.</ComboboxEmpty>
          <ComboboxList>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

// Change links held on other items, so both sides stay in step: for each item in `list`, add or remove `id`
// in its `field` according to whether it is in `want`.
function relink(st, list, field, id, want) {
  const w = new Set(want);
  const changes = {};
  list.forEach((it) => {
    const has = split(it[field]).includes(id);
    if (has === w.has(it.id)) return;
    changes[it.id] = { [field]: has ? split(it[field]).filter((v) => v !== id) : [...split(it[field]), id] };
  });
  if (Object.keys(changes).length) st.editMany(changes);
}

function StateBar({ kind, st, columns, label, one, onAdd, flash, setFlash, showDeleted, setShowDeleted }) {
  const file = useRef(null);
  const [msg, setMsg] = useState('');
  const changes = Object.keys(st.local).length;
  const server = st.mode.mode === 'server';
  const where = server ? 'on this server' : 'in this browser';
  return (
    <div className="ls-state">
      <p className={`ls-store ${server ? 'is-server' : 'is-browser'}`} data-storage={st.mode.mode}>
        <strong>{st.mode.mode === 'checking' ? 'Checking storage…' : server ? 'Shared storage: changes are saved on this server for everyone who opens this site.' : 'Browser storage: changes are saved in this browser only.'}</strong>
        {server && ' There is no login: anyone who can open this site can change and delete items.'}
        {!server && st.mode.mode !== 'checking' && ' To share them, export to Excel and hand the file back, or run the site on Apache/XAMPP with PHP (see HOW-TO-RUN.txt).'}
      </p>
      {st.error && <p className="ls-err" role="alert">{st.error}</p>}
      <div className="ls-state__btns">
        <button type="button" onClick={() => exportXlsx(`cevoc-uplift-${kind}-${today()}.xlsx`, columns, st.all).then(() => setMsg('Exported.')).catch((e) => setMsg(`Export failed: ${e.message}`))}>Export to Excel</button>
        <button type="button" onClick={() => file.current?.click()}>Import from Excel</button>
        <button type="button" onClick={onAdd}>Add {one}</button>
        <input ref={file} type="file" accept=".xlsx" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          try {
            const rec = await importXlsx(f, columns);
            const pattern = { questions: /^U[1-9]\d{0,3}$/, stories: /^S[1-9]\d{0,3}$/, adrs: /^ADR-\d{3,4}$/ }[kind];
            const set = {}; const n = { changed: 0, added: 0, deleted: 0, same: 0, skipped: [] };
            Object.entries(rec).forEach(([id, r]) => {
              const cur = st.all.find((x) => x.id === id);
              const now = new Date().toISOString();
              if (cur?.base) {
                // Published item: keep only fields that differ from the baseline, so an untouched export changes nothing.
                const diff = Object.fromEntries(columns.filter((c) => c.key && r[c.key] !== undefined && String(r[c.key]) !== String(c.get(cur.base) ?? '')).map((c) => [c.key, r[c.key]]));
                if (r.deleted) n.deleted += 1;
                if (!Object.keys(diff).length && !r.deleted && !cur.deleted) { n.same += 1; return; }
                if (Object.keys(diff).length) n.changed += 1;
                set[id] = { ...(st.local[id] || {}), ...diff, deleted: !!r.deleted, updatedAt: now, imported: f.name };
                if (!r.deleted) { delete set[id].deleted; delete set[id].deletedAt; }
                return;
              }
              if (!pattern.test(id)) { n.skipped.push(id); return; }
              if (!cur) n.added += 1; else n.changed += 1;
              if (r.deleted) n.deleted += 1;
              const { deleted, ...fields } = r;
              set[id] = { ...(st.local[id] || {}), ...fields, isNew: true, updatedAt: now, imported: f.name, ...(deleted ? { deleted: true } : {}) };
              if (!deleted) delete set[id].deleted;
            });
            st.save({ ...st.local, ...set });
            setMsg(`Imported ${f.name}: ${n.changed} changed, ${n.added} new, ${n.deleted} marked deleted, ${n.same} unchanged ${label}${n.skipped.length ? `; skipped bad IDs ${n.skipped.join(', ')}` : ''}.`);
          } catch (err) { setMsg(`Import failed: ${err.message}`); }
        }} />
        {changes > 0 && <button type="button" onClick={() => { if (window.confirm(`Discard all ${changes} change(s) saved ${where}, including added and deleted ${label}? This cannot be undone.`)) st.reset(); }}>Discard all changes ({changes})</button>}
        {st.deleted.length > 0 && <label className="ls-check"><input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> Show deleted ({st.deleted.length})</label>}
      </div>
      <p className="ls-meta" role="status">
        {flash && <strong>{flash.text} {flash.undo && <button type="button" className="ls-link" onClick={() => { flash.undo(); setFlash(null); }}>Undo</button>} </strong>}
        {msg && <strong>{msg} </strong>}
        {changes > 0 ? `${changes} ${label} changed ${where}. ` : ''}{server ? 'Export to Excel keeps a copy.' : 'To make them permanent, export and hand the file back.'}
      </p>
    </div>
  );
}

// Delete / restore controls used in every edit panel and on deleted items.
function useDelete(st, label, setEditing, setFlash) {
  return {
    del: (id) => {
      if (!window.confirm(`Delete ${id}? It is hidden from the list and can be restored (tick “Show deleted”).`)) return;
      st.remove(id); setEditing(null);
      setFlash({ text: `Deleted ${id}.`, undo: () => st.restore(id) });
    },
    restore: (id) => { st.restore(id); setFlash({ text: `Restored ${id}.` }); },
  };
}
const DeletedBar = ({ it, restore }) => (it.deleted ? (
  <p className="ls-meta ls-deleted"><span className="uh-tag is-open">Deleted</span> {it.deletedAt ? `on ${String(it.deletedAt).slice(0, 10)}` : ''} <button type="button" className="ls-link" onClick={() => restore(it.id)}>Restore {it.id}</button></p>
) : null);

// Search box with Jira-style autocomplete: fields, then operators, then values from the data; AND / OR / NOT.
// Arrow keys move, Tab or Enter accepts, Esc closes.
function SearchBox({ value, onChange, fields, values, example, errors }) {
  const id = useId();
  const input = useRef(null);
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const sug = useMemo(() => suggest(value.slice(0, caret), fields, values), [value, caret, fields, values]);
  const items = sug.items.slice(0, 12);
  const show = open && items.length > 0;
  useEffect(() => setActive(0), [value, caret]);
  const accept = (it) => {
    const before = value.slice(0, sug.from); const after = value.slice(caret);
    const next = before + it.insert + after;
    onChange(next);
    const pos = (before + it.insert).length;
    requestAnimationFrame(() => { input.current?.setSelectionRange(pos, pos); setCaret(pos); });
  };
  const bad = unknownField(value, fields);
  const err = bad ? `Unknown field “${bad}”. Fields: ${Object.keys(fields).join(', ')}.` : errors[0];
  return (
    <div className="ls-search">
      <label htmlFor={`${id}-q`}>Search</label>
      <div className="ls-ac">
        <input ref={input} id={`${id}-q`} type="search" value={value} placeholder={example} spellCheck={false} autoComplete="off"
          role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list" aria-describedby={`${id}-help`}
          aria-activedescendant={show ? `${id}-o${active}` : undefined} aria-invalid={!!err}
          onChange={(e) => { onChange(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); setOpen(true); }}
          onSelect={(e) => setCaret(e.target.selectionStart ?? 0)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { if (show) { e.preventDefault(); setOpen(false); } return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else setActive((a) => (a + 1) % Math.max(items.length, 1)); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + items.length) % Math.max(items.length, 1)); return; }
            if ((e.key === 'Enter' || e.key === 'Tab') && show) { e.preventDefault(); accept(items[active]); }
          }} />
        {show && (
          <ul id={`${id}-list`} role="listbox" className="ls-ac__list" aria-label="Suggestions">
            {items.map((it, k) => (
              <li key={it.kind + it.label} id={`${id}-o${k}`} role="option" aria-selected={k === active} className={k === active ? 'is-active' : ''}
                onMouseDown={(e) => { e.preventDefault(); accept(it); }}>
                <span>{it.label}</span><span className="ls-ac__kind">{it.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={`${id}-help`} className="ls-meta">Type to get suggestions. Free text, or <code>field = value</code>, <code>!=</code>, <code>~</code> contains, <code>!~</code>, <code>IN (a, b)</code>, <code>NOT IN (…)</code>, joined with <code>AND</code> / <code>OR</code>, <code>NOT</code> in front of a clause, brackets to group. Fields: {Object.keys(fields).join(', ')}.</p>
      {err && <p className="ls-err" role="alert">{err}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="ls-sel">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

const Pencil = ({ id, on, toggle }) => (
  <button type="button" className={`ls-pencil${on ? ' on' : ''}`} aria-expanded={on} aria-label={on ? `Close editing ${id}` : `Edit ${id}`} title={on ? 'Close' : 'Edit'} onClick={toggle}>
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M13.6 2.6a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8L7.2 16.6 2.5 17.5l.9-4.7L13.6 2.6Zm-8.4 11 -.4 2 2-.4 8.2-8.2-1.6-1.6-8.2 8.2Z" fill="currentColor" /></svg>
  </button>
);

function EditedNote({ it, st }) {
  if (!it.local) return null;
  const where = st.mode.mode === 'server' ? 'on this server' : 'in this browser';
  const when = String(it.local.updatedAt || '').slice(0, 10);
  const from = it.local.imported ? `, imported from ${it.local.imported}` : '';
  if (!it.base) return <p className="ls-meta ls-edited">New, added {where}{when ? ` (last change ${when})` : ''}{from}.</p>;
  const edited = Object.keys(it.local).some((k) => !['updatedAt', 'imported', 'deleted', 'deletedAt'].includes(k));
  if (!edited) return null;
  return (
    <p className="ls-meta ls-edited">
      Edited {where} {when}{from}.{' '}
      <button type="button" className="ls-link" onClick={() => st.undo(it.id)}>Undo edits</button>
    </p>
  );
}

const Tags = ({ tags }) => split(tags).map((t) => <span key={t} className="ls-chip is-tag">#{t}</span>);

const sorter = (get, dir) => (a, b) => { const x = get(a); const y = get(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; };

const sortBtnOf = (sort, setSort) => (k, t) => <button type="button" className={`ls-sort${sort.k === k ? ' on' : ''}`} aria-pressed={sort.k === k} onClick={() => setSort((x) => ({ k, dir: x.k === k ? -x.dir : 1 }))}>{t}{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</button>;
const scrollTo = (id) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'center' }), 60);

// --------------------------------------------------------------------------------------------------------------
export function StoriesPage({ query = {} }) {
  const all = useAll();
  const st = all.stories;
  const [q, setQ] = useState(query.s || query.all ? '' : REVNSW_Q);
  const [f, setF] = useState({ user: '', path: '', screen: query.screen || '', ready: '', brd: '', priority: '', phase: '' });
  const [sort, setSort] = useState({ k: 'id', dir: 1 });
  const [editing, setEditing] = useState(query.s && query.edit ? query.s : null);
  const [flash, setFlash] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const { del, restore } = useDelete(st, 'stories', setEditing, setFlash);
  const ready = (s) => readyOf(s, all.qmap);
  const fields = useMemo(() => ({
    id: (s) => s.id, priority: (s) => s.priority, phase: (s) => s.phase, user: (s) => s.user, path: (s) => s.path, screen: (s) => s.screen, brd: (s) => split(s.brd),
    ready: (s) => (ready(s) ? 'yes' : 'no'), question: (s) => split(s.qs), adr: (s) => all.adrsFor('stories', s.id).map((a) => a.id), tag: (s) => split(s.tags), role: (s) => s.role,
    text: (s) => `${s.want} ${s.so} ${acOf(s).join(' ')} ${s.comment || ''}`,
  }), [all]); // eslint-disable-line react-hooks/exhaustive-deps
  const values = useMemo(() => ({
    id: st.items.map((s) => s.id), priority: PRIORITIES, phase: PHASES, user: USERS, path: PATHS, screen: ['search', 'record', 'fields'], brd: BRDS, ready: ['yes', 'no'],
    question: all.questions.items.map((x) => x.id), adr: all.adrs.items.map((a) => a.id), tag: uniq(st.items.flatMap((s) => split(s.tags))), role: uniq(st.items.map((s) => s.role)),
  }), [st.items, all.questions.items, all.adrs.items]);
  const { test, errors } = useMemo(() => compile(q, fields), [q, fields]);
  const rows = (showDeleted ? st.all : st.items)
    .filter((s) => (!f.user || s.user === f.user) && (!f.path || s.path === f.path) && (!f.screen || s.screen === f.screen) && (!f.ready || (f.ready === 'Ready') === ready(s)) && (!f.brd || split(s.brd).includes(f.brd)) && (!f.priority || s.priority === f.priority) && (!f.phase || s.phase === f.phase))
    .filter((s) => s.id === editing || test(s))
    .sort(sorter(sort.k === 'id' ? (s) => idNum(s.id) : sort.k === 'ready' ? (s) => (ready(s) ? 0 : 1) : sort.k === 'priority' ? (s) => PRIORITIES.indexOf(s.priority) : (s) => String(s[sort.k] || ''), sort.dir));
  useEffect(() => { if (query.s) document.getElementById(query.s)?.scrollIntoView({ block: 'center' }); }, [query.s]);
  const columns = [
    { header: 'ID', get: (s) => s.id },
    { header: 'Priority', key: 'priority', get: (s) => s.priority },
    { header: 'Phase', key: 'phase', norm: normPhase, get: (s) => s.phase || PHASES[0] },
    { header: 'User type', key: 'user', get: (s) => s.user },
    { header: 'Path', key: 'path', get: (s) => s.path },
    { header: 'BRD', key: 'brd', get: (s) => split(s.brd).join(', ') },
    { header: 'Tags', key: 'tags', get: (s) => split(s.tags).join(', ') },
    { header: 'Screen', key: 'screen', get: (s) => s.screen },
    { header: 'Role', key: 'role', get: (s) => s.role },
    { header: 'I want to', key: 'want', get: (s) => s.want },
    { header: 'So that', key: 'so', get: (s) => s.so },
    { header: 'Story', get: (s) => `As a ${s.role}, I want to ${s.want}, so ${s.so}.` },
    { header: 'Acceptance criteria', key: 'acText', get: (s) => acOf(s).map((a, i) => `${i + 1}. ${a}`).join('\n') },
    { header: 'Criteria BRD', get: (s) => acOf(s).map((_, i) => `${i + 1}. ${acBrd(s, i + 1)}`).join('\n') },
    { header: 'Automated checks', get: (s) => acOf(s).map((_, i) => `${i + 1}. ${checkFor(s.id, i + 1) || 'manual'}`).join('\n') },
    { header: 'Coverage', get: (s) => { const c = coverage(s); return `${c.k} of ${c.n} automated`; } },
    { header: 'Related questions', key: 'qs', get: (s) => split(s.qs).join(', ') },
    { header: 'Related ADRs', get: (s) => all.adrsFor('stories', s.id).map((a) => a.id).join(', ') },
    { header: 'Ready (computed)', get: (s) => (readyOf({ ...s, readyOverride: '' }, all.qmap) ? 'Ready' : 'Not ready') },
    { header: 'Ready override', key: 'readyOverride', get: (s) => s.readyOverride || '' },
    { header: 'Comment', key: 'comment', get: (s) => s.comment || '' },
  ];
  const sortBtn = sortBtnOf(sort, setSort);
  const onAdd = () => { const id = st.add(); setQ(''); setF({ user: '', path: '', screen: '', ready: '', brd: '', priority: '', phase: '' }); setEditing(id); setFlash({ text: `Added ${id}. Fill it in below.` }); scrollTo(id); };

  return (
    <>
      <StateBar kind="stories" st={st} columns={columns} label="stories" one="story" onAdd={onAdd} flash={flash} setFlash={setFlash} showDeleted={showDeleted} setShowDeleted={setShowDeleted} />
      <SearchBox value={q} onChange={setQ} errors={errors} fields={fields} values={values} example='user = "Revenue NSW officer" AND path = exception AND ready = no' />
      <div className="ls-filters">
        <Select label="User type" value={f.user} onChange={(v) => setF({ ...f, user: v })} options={USERS} />
        <Select label="Path" value={f.path} onChange={(v) => setF({ ...f, path: v })} options={PATHS} />
        <Select label="Screen" value={f.screen} onChange={(v) => setF({ ...f, screen: v })} options={['search', 'record', 'fields']} />
        <Select label="Ready" value={f.ready} onChange={(v) => setF({ ...f, ready: v })} options={['Ready', 'Not ready']} />
        <Select label="BRD" value={f.brd} onChange={(v) => setF({ ...f, brd: v })} options={BRDS} />
        <Select label="Priority" value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={PRIORITIES} />
        <Select label="Phase" value={f.phase} onChange={(v) => setF({ ...f, phase: v })} options={PHASES} />
        <span className="ls-sortby">Sort: {sortBtn('id', 'ID')} {sortBtn('user', 'User')} {sortBtn('path', 'Path')} {sortBtn('ready', 'Ready')} {sortBtn('priority', 'Priority')}</span>
      </div>
      <DoneAndCross />
      <p className="ls-meta ls-revnsw" role="note"><strong>Revenue NSW stories are hidden by default.</strong> The page Revenue NSW staff are meant to use appears to get few hits, so these {st.items.filter((s) => s.user === REVNSW_USER).length} stories are likely to be de-scoped, pending confirmation from Revenue NSW. {q === REVNSW_Q ? <button type="button" className="ls-linkbtn" onClick={() => setQ('')}>Show Revenue NSW stories</button> : <button type="button" className="ls-linkbtn" onClick={() => setQ(REVNSW_Q)}>Hide them again</button>}</p>
      <p className="ls-meta">{rows.length} of {st.items.length} stories ({st.items.filter((s) => !isBacklog(s)).length} in phase 1, {st.items.filter(isBacklog).length} in Backlog{st.items.some(isBacklog) ? `: ${st.items.filter(isBacklog).map((s) => s.id).join(', ')}` : ''}) · phase 1 acceptance criteria automated: {st.items.filter((s) => !isBacklog(s)).reduce((n, s) => n + coverage(s).k, 0)} of {st.items.filter((s) => !isBacklog(s)).reduce((n, s) => n + coverage(s).n, 0)} · phase 1 stories fully covered: {st.items.filter((s) => { const c = coverage(s); return !isBacklog(s) && c.n && c.k === c.n; }).length} · BRD requirements with no phase 1 story: {BRDS.filter((b) => !st.items.some((s) => !isBacklog(s) && split(s.brd).includes(b))).join(', ') || 'none'}</p>
      {rows.map((s) => {
        const adrs = all.adrsFor('stories', s.id);
        const ac = acOf(s);
        return (
          <article key={s.id} id={s.id} className={`uh-card uh-st${query.s === s.id ? ' is-hl' : ''}${s.deleted ? ' is-deleted' : ''}`}>
            <p className="uh-st__h">
              <strong>{s.id}</strong> <PhaseChip x={s} /> {isBacklog(s) ? <Tag open={false}>Backlog</Tag> : <Tag open={!ready(s)}>{ready(s) ? 'Ready for dev' : 'Not ready'}</Tag>}
              {(() => { const c = coverage(s); return <span className={`ls-chip ${c.n && c.k === c.n ? 'is-auto' : 'is-manual'}`}>{c.n && c.k === c.n ? 'Covered' : c.k ? 'Partly covered' : 'Not covered'}: {c.k} of {c.n} automated</span>; })()}
              {s.priority && <span className={`ls-chip is-prio is-${String(s.priority).toLowerCase()}`}>{s.priority} priority</span>}{s.user && <span className="ls-chip is-user">{s.user}</span>}{s.user === REVNSW_USER && <span className="ls-chip is-manual">{REVNSW_NOTE}</span>}{s.path && <span className={`ls-chip is-path is-${String(s.path).split(' ')[0]}`}>{s.path}</span>}
              {split(s.brd).map((b) => <span key={b} className="ls-chip is-brd">{b}</span>)}
              <Tags tags={s.tags} />
              <span className="uh-meta">{s.screen === 'search' ? 'Search screen' : s.screen === 'record' ? 'Record screen' : 'API'}</span>
              {!s.deleted && <Pencil id={s.id} on={editing === s.id} toggle={() => setEditing(editing === s.id ? null : s.id)} />}
            </p>
            <DeletedBar it={s} restore={restore} />
            <p>As a <strong>{s.role || '…'}</strong>, I want to {s.want || '…'}, so {s.so || '…'}.</p>
            {ac.length ? <ol className="uh-ac ls-ac">{ac.map((a, i) => <li key={a}>{a.replace(/^Given /, '').length !== a.length ? <><b>Given</b> {a.slice(6).replace(/, when /, '\u0001').replace(/, then /, '\u0002').split(/(\u0001|\u0002)/).map((p, j) => (p === '\u0001' ? <Fragment key={j}>, <b>when</b> </Fragment> : p === '\u0002' ? <Fragment key={j}>, <b>then</b> </Fragment> : p))}</> : a} <AcCheck name={checkFor(s.id, i + 1)} brd={acBrd(s, i + 1)} /></li>)}</ol> : <p className="ls-meta">No acceptance criteria yet.</p>}
            <p className="uh-meta">Related questions: {split(s.qs).length ? <Refs ids={s.qs} kind="q" map={all.qmap} open /> : 'none'}
              {adrs.length > 0 && <> · Related ADRs: {adrs.map((a) => <Ref key={a.id} id={a.id} kind="a" map={all.amap} />)}</>}</p>
            {s.comment && <p className="ls-ans"><strong>Comment:</strong> {s.comment}</p>}
            <EditedNote it={s} st={st} />
            {editing === s.id && !s.deleted && (
              <div className="ls-edit">
                <>
                  <label>As a (role)<input defaultValue={s.role} onBlur={(e) => st.edit(s.id, { role: e.target.value })} /></label>
                  <label className="is-wide">I want to<input defaultValue={s.want} onBlur={(e) => st.edit(s.id, { want: e.target.value })} /></label>
                  <label className="is-wide">So that<input defaultValue={s.so} onBlur={(e) => st.edit(s.id, { so: e.target.value })} /></label>
                  <label>Screen<select defaultValue={s.screen} onChange={(e) => st.edit(s.id, { screen: e.target.value })}>{['search', 'record', 'fields'].map((u) => <option key={u}>{u}</option>)}</select></label>
                </>
                <label className="is-wide">Acceptance criteria, one per line: Given …, when …, then …<textarea rows={4} defaultValue={acOf(s).join('\n')} onBlur={(e) => { const v = e.target.value.trim(); if (v !== acOf(s).join('\n')) st.edit(s.id, { acText: v }); }} /></label>
                <label className="is-wide">Comment<textarea rows={3} defaultValue={s.comment || ''} onBlur={(e) => st.edit(s.id, { comment: e.target.value })} /></label>
                <label>Ready<select defaultValue={s.readyOverride || ''} onChange={(e) => st.edit(s.id, { readyOverride: e.target.value })}><option value="">Computed ({readyOf({ ...s, readyOverride: '' }, all.qmap) ? 'Ready' : 'Not ready'})</option><option>Ready</option><option>Not ready</option></select></label>
                <label>Priority<select defaultValue={s.priority} onChange={(e) => st.edit(s.id, { priority: e.target.value })}>{PRIORITIES.map((u) => <option key={u}>{u}</option>)}</select></label>
                <label>Phase<select defaultValue={s.phase || PHASES[0]} onChange={(e) => st.edit(s.id, { phase: e.target.value })}>{PHASES.map((u) => <option key={u}>{u}</option>)}</select></label>
                <label>Tags (comma separated)<input defaultValue={split(s.tags).join(', ')} onBlur={(e) => st.edit(s.id, { tags: split(e.target.value).join(', ') })} /></label>
                <label>User type<select defaultValue={s.user} onChange={(e) => st.edit(s.id, { user: e.target.value })}>{USERS.map((u) => <option key={u}>{u}</option>)}</select></label>
                <label>Path<select defaultValue={s.path} onChange={(e) => st.edit(s.id, { path: e.target.value })}>{PATHS.map((u) => <option key={u}>{u}</option>)}</select></label>
                <label>BRD<input defaultValue={split(s.brd).join(', ')} onBlur={(e) => st.edit(s.id, { brd: split(e.target.value) })} /></label>
                <LinkPicker label="Related questions" kind="q" items={all.questions.items} value={s.qs} onChange={(ids) => st.edit(s.id, { qs: ids })} />
                <LinkPicker label="Related ADRs" kind="a" items={all.adrs.items} value={adrs.map((a) => a.id)} onChange={(ids) => relink(all.adrs, all.adrs.items, 'stories', s.id, ids)} />
                <button type="button" className="ls-btn" onClick={() => setEditing(null)}>Done</button>
                <button type="button" className="ls-btn is-danger" onClick={() => del(s.id)}>Delete {s.id}</button>
              </div>
            )}
          </article>
        );
      })}
    </>
  );
}

// --------------------------------------------------------------------------------------------------------------
export function QuestionsPage({ query = {} }) {
  const all = useAll();
  const st = all.questions;
  const [q, setQ] = useState('');
  const [f, setF] = useState({ status: '', owner: '', screen: query.screen || '', linked: '', phase: '' });
  const [sort, setSort] = useState({ k: 'id', dir: 1 });
  const [editing, setEditing] = useState(null);
  const [flash, setFlash] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const { del, restore } = useDelete(st, 'questions', setEditing, setFlash);
  const owners = useMemo(() => uniq(st.items.flatMap((x) => String(x.who || '').split(/,\s*|;\s*| and /).map((w) => w.replace(/\(.*?\)/g, '').trim()))), [st.items]);
  const fields = useMemo(() => ({
    id: (x) => x.id, status: (x) => x.status, phase: (x) => x.phase, owner: (x) => x.who, screen: (x) => split(x.at), topic: (x) => x.topic, priority: (x) => x.priority,
    tag: (x) => split(x.tags), answered: (x) => (x.answer ? 'yes' : 'no'), story: (x) => all.storiesFor(x.id).map((s) => s.id), adr: (x) => all.adrsFor('qs', x.id).map((a) => a.id),
    linked: (x) => (all.storiesFor(x.id).length ? 'yes' : 'no'),
    text: (x) => `${x.topic} ${x.q} ${x.why} ${x.assume} ${x.action} ${x.answer || ''}`,
  }), [all]);
  const values = useMemo(() => ({
    id: st.items.map((x) => x.id), status: STATUS, phase: PHASES, owner: owners, screen: SCREENS, topic: uniq(st.items.map((x) => x.topic)), priority: PRIORITIES,
    tag: uniq(st.items.flatMap((x) => split(x.tags))), answered: ['yes', 'no'], story: all.stories.items.map((s) => s.id), adr: all.adrs.items.map((a) => a.id), linked: ['yes', 'no'],
  }), [owners, st.items, all.stories.items, all.adrs.items]);
  const { test, errors } = useMemo(() => compile(q, fields), [q, fields]);
  const keyOf = { id: (x) => idNum(x.id), topic: (x) => x.topic, status: (x) => STATUS.indexOf(x.status), who: (x) => x.who, answer: (x) => (x.answer ? 0 : 1) };
  const rows = (showDeleted ? st.all : st.items)
    .filter((x) => (!f.status || x.status === f.status) && (!f.phase || x.phase === f.phase) && (!f.owner || String(x.who).includes(f.owner)) && (!f.screen || split(x.at).includes(f.screen)) && (!f.linked || (f.linked === 'No story linked') === !all.storiesFor(x.id).length))
    .filter((x) => x.id === editing || test(x))
    .sort(sorter(keyOf[sort.k], sort.dir));
  useEffect(() => { if (query.q) document.getElementById(`q-${query.q}`)?.scrollIntoView({ block: 'center' }); }, [query.q]);
  const orphans = st.items.filter((x) => !all.storiesFor(x.id).length);
  const columns = [
    { header: 'ID', get: (x) => x.id },
    { header: 'Topic', key: 'topic', get: (x) => x.topic },
    { header: 'Question', key: 'q', get: (x) => x.q },
    { header: 'Why it matters', key: 'why', get: (x) => x.why },
    { header: 'Current assumption', key: 'assume', get: (x) => x.assume },
    { header: 'Who can answer', key: 'who', get: (x) => x.who },
    { header: 'Status', key: 'status', get: (x) => x.status },
    { header: 'Priority', key: 'priority', get: (x) => x.priority || '' },
    { header: 'Phase', key: 'phase', norm: normPhase, get: (x) => x.phase || PHASES[0] },
    { header: 'Tags', key: 'tags', get: (x) => split(x.tags).join(', ') },
    { header: 'Answer', key: 'answer', get: (x) => x.answer || '' },
    { header: 'Next step', key: 'action', get: (x) => x.action },
    { header: 'Screens', key: 'at', get: (x) => split(x.at).join(', ') },
    { header: 'Related stories', get: (x) => all.storiesFor(x.id).map((s) => s.id).join(', ') || `No story linked${x.noStoryReason ? `: ${x.noStoryReason}` : ''}` },
    { header: 'No story reason', key: 'noStoryReason', get: (x) => x.noStoryReason || '' },
    { header: 'Related ADRs', get: (x) => all.adrsFor('qs', x.id).map((a) => a.id).join(', ') },
  ];
  const th = (k, t) => (
    <th scope="col" aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="ls-th" onClick={() => setSort((s) => ({ k, dir: s.k === k ? -s.dir : 1 }))}>{t}<span aria-hidden="true">{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ' ⇅'}</span></button>
    </th>
  );
  const onAdd = () => { const id = st.add(); setQ(''); setF({ status: '', owner: '', screen: '', linked: '', phase: '' }); setEditing(id); setFlash({ text: `Added ${id}. Fill it in below.` }); scrollTo(`q-${id}`); };
  return (
    <>
      <StateBar kind="questions" st={st} columns={columns} label="questions" one="question" onAdd={onAdd} flash={flash} setFlash={setFlash} showDeleted={showDeleted} setShowDeleted={setShowDeleted} />
      <SearchBox value={q} onChange={setQ} errors={errors} fields={fields} values={values} example='status IN ("Assumption to validate", "Confirmation required") AND owner ~ CMCS' />
      <div className="ls-filters">
        <Select label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={STATUS} />
        <Select label="Phase" value={f.phase} onChange={(v) => setF({ ...f, phase: v })} options={PHASES} />
        <Select label="Who can answer" value={f.owner} onChange={(v) => setF({ ...f, owner: v })} options={owners} />
        <Select label="Screen" value={f.screen} onChange={(v) => setF({ ...f, screen: v })} options={SCREENS} />
        <Select label="Stories" value={f.linked} onChange={(v) => setF({ ...f, linked: v })} options={['Linked to a story', 'No story linked']} />
      </div>
      <p className="ls-meta">{rows.length} of {st.items.length} questions · {st.items.filter(OPEN).length} open · {st.items.filter(isBacklog).length} in Backlog (Phase 2) · {orphans.length} with no story linked ({orphans.map((x) => x.id).join(', ') || 'none'}), each with a reason</p>
      <div className="up-scroll">
        <table className="uh-tbl ls-tbl">
          <thead><tr>{th('id', '#')}{th('topic', 'Question')}{th('status', 'Status')}{th('who', 'Who can answer')}{th('answer', 'Answer')}<th scope="col">Related</th><th scope="col">Edit</th></tr></thead>
          <tbody>{rows.map((x) => {
            const sts = all.storiesFor(x.id); const adrs = all.adrsFor('qs', x.id);
            return (
              <Fragment key={x.id}>
                <tr id={`q-${x.id}`} className={`${query.q === x.id ? 'is-hl' : ''}${x.deleted ? ' is-deleted' : ''}`}>
                  <td>{x.id}</td>
                  <td><strong>{x.topic || 'New question'}</strong><br />{x.q}{x.see && <><br /><Link to={x.see.to}>{x.see.label} ↗</Link></>}{x.see2 && <><br /><Link to={x.see2.to}>{x.see2.label} ↗</Link></>} <Tags tags={x.tags} />{isBacklog(x) && <PhaseChip x={x} />}{x.priority && <span className={`ls-chip is-prio is-${x.priority.toLowerCase()}`}>{x.priority} priority</span>}
                    <details className="ls-more"><summary>Why, assumption, next step</summary><p><b>Why it matters:</b> {x.why}</p><p><b>Current assumption:</b> {x.assume}</p><p><b>Next step:</b> {x.action}</p></details>
                    <DeletedBar it={x} restore={restore} /></td>
                  <td><Tag open={OPEN(x)}>{x.status}</Tag>{x.base && x.local?.status && x.local.status !== x.base.status && <span className="ls-meta"> (was {x.base.status})</span>}</td>
                  <td>{x.who}</td>
                  <td>{x.answer ? <p className="ls-ans">{x.answer}</p> : <span className="ls-meta">None yet</span>}<EditedNote it={x} st={st} /></td>
                  <td>
                    {sts.length ? <>Stories: {sts.map((s) => <Ref key={s.id} id={s.id} kind="s" map={all.smap} />)}</> : <><span className="uh-tag is-open">No story linked</span>{x.noStoryReason && <span className="ls-meta"> {x.noStoryReason}</span>}</>}
                    {adrs.length > 0 && <><br />ADRs: {adrs.map((a) => <Ref key={a.id} id={a.id} kind="a" map={all.amap} />)}</>}
                  </td>
                  <td>{!x.deleted && <Pencil id={x.id} on={editing === x.id} toggle={() => setEditing(editing === x.id ? null : x.id)} />}</td>
                </tr>
                {editing === x.id && !x.deleted && (
                  <tr className="ls-editrow"><td /><td colSpan={6}>
                    <div className="ls-edit">
                      <>
                        <label>Topic<input defaultValue={x.topic} onBlur={(e) => st.edit(x.id, { topic: e.target.value })} /></label>
                        <label className="is-wide">Question<textarea rows={2} defaultValue={x.q} onBlur={(e) => st.edit(x.id, { q: e.target.value })} /></label>
                        <label className="is-wide">Why it matters<textarea rows={2} defaultValue={x.why} onBlur={(e) => st.edit(x.id, { why: e.target.value })} /></label>
                        <label className="is-wide">Current assumption<textarea rows={2} defaultValue={x.assume} onBlur={(e) => st.edit(x.id, { assume: e.target.value })} /></label>
                        <label>Who can answer<input defaultValue={x.who} onBlur={(e) => st.edit(x.id, { who: e.target.value })} /></label>
                        <label className="is-wide">Next step<input defaultValue={x.action} onBlur={(e) => st.edit(x.id, { action: e.target.value })} /></label>
                        <label>Screens<input defaultValue={split(x.at).join(', ')} onBlur={(e) => st.edit(x.id, { at: split(e.target.value) })} /></label>
                      </>
                      <label className="is-wide">Answer<textarea rows={3} defaultValue={x.answer || ''} onBlur={(e) => st.edit(x.id, { answer: e.target.value })} /></label>
                      <label>Status<select defaultValue={x.status} onChange={(e) => st.edit(x.id, { status: e.target.value })}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
                      <label>Phase<select defaultValue={x.phase || PHASES[0]} onChange={(e) => st.edit(x.id, { phase: e.target.value })}>{PHASES.map((s) => <option key={s}>{s}</option>)}</select></label>
                      <label>Priority<select defaultValue={x.priority || ''} onChange={(e) => st.edit(x.id, { priority: e.target.value })}><option value="">Not set</option>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
                      <label>Tags (comma separated)<input defaultValue={split(x.tags).join(', ')} onBlur={(e) => st.edit(x.id, { tags: split(e.target.value).join(', ') })} /></label>
                      {!sts.length && <label className="is-wide">Why no story is linked<input defaultValue={x.noStoryReason || ''} onBlur={(e) => st.edit(x.id, { noStoryReason: e.target.value })} /></label>}
                      <LinkPicker label="Related stories" kind="s" items={all.stories.items} value={sts.map((y) => y.id)} onChange={(ids) => relink(all.stories, all.stories.items, 'qs', x.id, ids)} />
                      <LinkPicker label="Related ADRs" kind="a" items={all.adrs.items} value={adrs.map((a) => a.id)} onChange={(ids) => relink(all.adrs, all.adrs.items, 'qs', x.id, ids)} />
                      <button type="button" className="ls-btn" onClick={() => setEditing(null)}>Done</button>
                      <button type="button" className="ls-btn is-danger" onClick={() => del(x.id)}>Delete {x.id}</button>
                    </div>
                  </td></tr>
                )}
              </Fragment>
            );
          })}</tbody>
        </table>
      </div>
    </>
  );
}

// --------------------------------------------------------------------------------------------------------------
export function AdrPage({ query = {} }) {
  const all = useAll();
  const st = all.adrs;
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [flash, setFlash] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const { del, restore } = useDelete(st, 'ADRs', setEditing, setFlash);
  const fields = useMemo(() => ({
    id: (a) => a.id, status: (a) => a.status, title: (a) => a.title, question: (a) => split(a.qs), story: (a) => split(a.stories), tag: (a) => split(a.tags),
    text: (a) => `${a.title} ${a.context} ${(a.options || []).map((o) => `${o.name} ${o.how} ${o.pros.join(' ')} ${o.cons.join(' ')}`).join(' ')} ${a.decision} ${a.consequences} ${a.notes || ''}`,
  }), []);
  const values = useMemo(() => ({ id: st.items.map((a) => a.id), status: ADR_STATUS, title: st.items.map((a) => a.title), question: all.questions.items.map((x) => x.id), story: all.stories.items.map((s) => s.id), tag: uniq(st.items.flatMap((a) => split(a.tags))) }), [st.items, all.questions.items, all.stories.items]);
  const { test, errors } = useMemo(() => compile(q, fields), [q, fields]);
  const rows = (showDeleted ? st.all : st.items).filter((a) => a.id === editing || test(a));
  useEffect(() => { if (query.a) document.getElementById(query.a)?.scrollIntoView({ block: 'start' }); }, [query.a]);
  const columns = [
    { header: 'ID', get: (a) => a.id },
    { header: 'Title', key: 'title', get: (a) => a.title },
    { header: 'Status', key: 'status', get: (a) => a.status },
    { header: 'Context', key: 'context', get: (a) => a.context },
    { header: 'Options', get: (a) => (a.options || []).map((o) => `${o.name}: ${o.how} For: ${o.pros.join('; ')}. Against: ${o.cons.join('; ')}.`).join('\n') },
    { header: 'Decision', key: 'decision', get: (a) => a.decision },
    { header: 'Consequences', key: 'consequences', get: (a) => a.consequences },
    { header: 'Related questions', key: 'qs', get: (a) => split(a.qs).join(', ') },
    { header: 'Related stories', key: 'stories', get: (a) => split(a.stories).join(', ') },
    { header: 'Tags', key: 'tags', get: (a) => split(a.tags).join(', ') },
    { header: 'Notes', key: 'notes', get: (a) => a.notes || '' },
  ];
  const onAdd = () => { const id = st.add(); setQ(''); setEditing(id); setFlash({ text: `Added ${id}. Fill it in below.` }); scrollTo(id); };
  return (
    <>
      <StateBar kind="adrs" st={st} columns={columns} label="ADRs" one="ADR" onAdd={onAdd} flash={flash} setFlash={setFlash} showDeleted={showDeleted} setShowDeleted={setShowDeleted} />
      <SearchBox value={q} onChange={setQ} errors={errors} fields={fields} values={values} example='status = Proposed AND question = U16' />
      <p className="ls-meta">{rows.length} of {st.items.length} ADRs · {st.items.map((a) => <Fragment key={a.id}><a href={`#${a.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(a.id)?.scrollIntoView({ block: 'start' }); }}>{a.id}</a> </Fragment>)}</p>
      {rows.map((a) => (
        <article key={a.id} id={a.id} className={`uh-card ad${query.a === a.id ? ' is-hl' : ''}${a.deleted ? ' is-deleted' : ''}`}>
          <p className="uh-meta"><span className={`uh-tag ${a.status === 'Accepted' ? 'is-done' : 'is-open'}`}>{a.status}</span> <Tags tags={a.tags} />
            Related questions: {split(a.qs).length ? <Refs ids={a.qs} kind="q" map={all.qmap} /> : 'none'} · Related stories: {split(a.stories).length ? <Refs ids={a.stories} kind="s" map={all.smap} /> : 'none'}
            {!a.deleted && <Pencil id={a.id} on={editing === a.id} toggle={() => setEditing(editing === a.id ? null : a.id)} />}</p>
          <DeletedBar it={a} restore={restore} />
          <h2 className="uh-h2">{a.id}: {a.title || 'New ADR'}</h2>
          {a.context && <p><strong>Context.</strong> {a.context}</p>}
          {(a.options || []).length > 0 && <div className="ad-opts">
            {a.options.map((o) => (
              <section key={o.name} className="ad-opt">
                <h3>{o.name}</h3>
                <p>{o.how}</p>
                <p><strong>For</strong></p><ul>{o.pros.map((x) => <li key={x}>{x}</li>)}</ul>
                <p><strong>Against</strong></p><ul>{o.cons.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
            ))}
          </div>}
          {a.decision && <p><strong>Decision.</strong> {a.decision}</p>}
          {a.consequences && <p><strong>Consequences.</strong> {a.consequences}</p>}
          {a.notes && <p className="ls-ans"><strong>Notes:</strong> {a.notes}</p>}
          <EditedNote it={a} st={st} />
          {editing === a.id && !a.deleted && (
            <div className="ls-edit">
              <>
                <label className="is-wide">Title<input defaultValue={a.title} onBlur={(e) => st.edit(a.id, { title: e.target.value })} /></label>
                <label className="is-wide">Context<textarea rows={3} defaultValue={a.context} onBlur={(e) => st.edit(a.id, { context: e.target.value })} /></label>
              </>
              <label>Status<select defaultValue={a.status} onChange={(e) => st.edit(a.id, { status: e.target.value })}>{ADR_STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label>Tags (comma separated)<input defaultValue={split(a.tags).join(', ')} onBlur={(e) => st.edit(a.id, { tags: split(e.target.value).join(', ') })} /></label>
              <LinkPicker label="Related questions" kind="q" items={all.questions.items} value={a.qs} onChange={(ids) => st.edit(a.id, { qs: ids })} />
              <LinkPicker label="Related stories" kind="s" items={all.stories.items} value={a.stories} onChange={(ids) => st.edit(a.id, { stories: ids })} />
              <label className="is-wide">Decision<textarea rows={2} defaultValue={a.decision} onBlur={(e) => st.edit(a.id, { decision: e.target.value })} /></label>
              <label className="is-wide">Consequences<textarea rows={2} defaultValue={a.consequences} onBlur={(e) => st.edit(a.id, { consequences: e.target.value })} /></label>
              <label className="is-wide">Notes<textarea rows={2} defaultValue={a.notes || ''} onBlur={(e) => st.edit(a.id, { notes: e.target.value })} /></label>
              <button type="button" className="ls-btn" onClick={() => setEditing(null)}>Done</button>
              <button type="button" className="ls-btn is-danger" onClick={() => del(a.id)}>Delete {a.id}</button>
            </div>
          )}
        </article>
      ))}
    </>
  );
}
