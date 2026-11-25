import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from '../shared/ui.jsx';
import { OPEN, PATHS, PRIORITIES, QUESTIONS, STATUS, STORIES, USERS, qById, storyReady } from './data.js';
import { ADRS, ADR_STATUS } from './adrs.js';
import { compile, suggest, unknownField } from './jql.js';
import { exportXlsx, importXlsx, useItemState } from './state.js';

// Hub Stories, Questions and ADRs pages (owner, 25 Nov 2026): tagged, filterable, JQL-style searchable with
// autocomplete, sortable; a pencil button edits each item in place (saved in this browser); export the latest state
// to Excel and import it back. The published data is the baseline; edits stay in this browser until the exported
// file is handed back and the site updated. Every question links to at least one story, or says why it can't.

const Tag = ({ open, children }) => <span className={`uh-tag ${open ? 'is-open' : 'is-done'}`}>{children}</span>;
const BRDS = ['BR_01', 'BR_02', 'BR_03', 'BR_04', 'BR_05', 'BR_06', 'BR_07', 'BR_08', 'BR_09', 'BR_10'];
const SCREENS = ['search', 'record', 'fields', 'entry', 'journey'];
const today = () => new Date().toISOString().slice(0, 10);
const split = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,;]+|\s+(?=BR_)/).map((x) => x.trim()).filter(Boolean));
const storiesFor = (qid) => STORIES.filter((s) => s.qs.includes(qid));
const adrsFor = (key, id) => ADRS.filter((a) => a[key].includes(id));
const uniq = (xs) => [...new Set(xs.filter(Boolean))].sort();

function StateBar({ kind, st, columns, items, label }) {
  const file = useRef(null);
  const [msg, setMsg] = useState('');
  const edits = Object.keys(st.local).length;
  return (
    <div className="ls-state">
      <div className="ls-state__btns">
        <button type="button" onClick={() => exportXlsx(`cevoc-uplift-${kind}-${today()}.xlsx`, columns, items).then(() => setMsg('Exported.')).catch((e) => setMsg(`Export failed: ${e.message}`))}>Export to Excel</button>
        <button type="button" onClick={() => file.current?.click()}>Import from Excel</button>
        <input ref={file} type="file" accept=".xlsx" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          try {
            const rec = await importXlsx(f, columns);
            // Keep only rows that differ from the published baseline, so an untouched export changes nothing.
            const changed = Object.fromEntries(Object.entries(rec).filter(([id, r]) => {
              const base = items.find((x) => x.id === id)?.base;
              return base && columns.some((c) => c.key && r[c.key] !== undefined && String(r[c.key]) !== String(c.get(base) ?? ''));
            }));
            st.save({ ...st.local, ...changed });
            setMsg(`Imported ${f.name}: ${Object.keys(changed).length} changed ${label}, ${Object.keys(rec).length - Object.keys(changed).length} unchanged.`);
          } catch (err) { setMsg(`Import failed: ${err.message}`); }
        }} />
        {edits > 0 && <button type="button" onClick={() => { if (window.confirm(`Discard ${edits} edit(s) made in this browser?`)) st.reset(); }}>Discard edits in this browser ({edits})</button>}
      </div>
      <p className="ls-meta" role="status">
        {msg && <strong>{msg} </strong>}
        {edits > 0 ? `${edits} ${label} edited in this browser. ` : ''}Edits and imports stay in this browser only. To make them permanent, export and hand the file back.
      </p>
    </div>
  );
}

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
  return (
    <p className="ls-meta ls-edited">
      Edited in this browser {String(it.local.updatedAt).slice(0, 10)}{it.local.imported ? `, imported from ${it.local.imported}` : ''}.{' '}
      <button type="button" className="ls-link" onClick={() => st.undo(it.id)}>Undo edits</button>
    </p>
  );
}

const Tags = ({ tags }) => split(tags).map((t) => <span key={t} className="ls-chip is-tag">#{t}</span>);

const sorter = (get, dir) => (a, b) => { const x = get(a); const y = get(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; };
const idNum = (id) => Number(String(id).replace(/\D/g, ''));

// --------------------------------------------------------------------------------------------------------------
export function StoriesPage({ query = {} }) {
  const st = useItemState('stories', STORIES.map((s) => ({ ...s, comment: '', tags: '' })));
  const [q, setQ] = useState('');
  const [f, setF] = useState({ user: '', path: '', screen: query.screen || '', ready: '', brd: '', priority: '' });
  const [sort, setSort] = useState({ k: 'id', dir: 1 });
  const [editing, setEditing] = useState(query.s && query.edit ? query.s : null);
  const ready = (s) => {
    if (s.readyOverride === 'Ready') return true;
    if (s.readyOverride === 'Not ready') return false;
    return storyReady(s);
  };
  const fields = useMemo(() => ({
    id: (s) => s.id, priority: (s) => s.priority, user: (s) => s.user, path: (s) => s.path, screen: (s) => s.screen, brd: (s) => split(s.brd),
    ready: (s) => (ready(s) ? 'yes' : 'no'), question: (s) => s.qs, adr: (s) => adrsFor('stories', s.id).map((a) => a.id), tag: (s) => split(s.tags), role: (s) => s.role,
    text: (s) => `${s.want} ${s.so} ${s.ac.map((a) => `${a.g} ${a.w} ${a.t}`).join(' ')} ${s.comment || ''}`,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const values = useMemo(() => ({
    id: STORIES.map((s) => s.id), priority: PRIORITIES, user: USERS, path: PATHS, screen: ['search', 'record', 'fields'], brd: BRDS, ready: ['yes', 'no'],
    question: QUESTIONS.map((x) => x.id), adr: ADRS.map((a) => a.id), tag: uniq(st.items.flatMap((s) => split(s.tags))), role: uniq(STORIES.map((s) => s.role)),
  }), [st.items]);
  const { test, errors } = useMemo(() => compile(q, fields), [q, fields]);
  const rows = st.items
    .filter((s) => (!f.user || s.user === f.user) && (!f.path || s.path === f.path) && (!f.screen || s.screen === f.screen) && (!f.ready || (f.ready === 'Ready') === ready(s)) && (!f.brd || split(s.brd).includes(f.brd)) && (!f.priority || s.priority === f.priority))
    .filter(test)
    .sort(sorter(sort.k === 'id' ? (s) => idNum(s.id) : sort.k === 'ready' ? (s) => (ready(s) ? 0 : 1) : sort.k === 'priority' ? (s) => PRIORITIES.indexOf(s.priority) : (s) => String(s[sort.k] || ''), sort.dir));
  useEffect(() => { if (query.s) document.getElementById(query.s)?.scrollIntoView({ block: 'center' }); }, [query.s]);
  const columns = [
    { header: 'ID', get: (s) => s.id },
    { header: 'Priority', key: 'priority', get: (s) => s.priority },
    { header: 'User type', key: 'user', get: (s) => s.user },
    { header: 'Path', key: 'path', get: (s) => s.path },
    { header: 'BRD', key: 'brd', get: (s) => split(s.brd).join(', ') },
    { header: 'Tags', key: 'tags', get: (s) => split(s.tags).join(', ') },
    { header: 'Screen', get: (s) => s.screen },
    { header: 'Story', get: (s) => `As a ${s.role}, I want to ${s.want}, so ${s.so}.` },
    { header: 'Acceptance criteria', get: (s) => s.ac.map((a, i) => `${i + 1}. Given ${a.g}, when ${a.w}, then ${a.t}.`).join('\n') },
    { header: 'Related questions', get: (s) => s.qs.join(', ') },
    { header: 'Related ADRs', get: (s) => adrsFor('stories', s.id).map((a) => a.id).join(', ') },
    { header: 'Ready (computed)', get: (s) => (storyReady(s) ? 'Ready' : 'Not ready') },
    { header: 'Ready override', key: 'readyOverride', get: (s) => s.readyOverride || '' },
    { header: 'Comment', key: 'comment', get: (s) => s.comment || '' },
  ];
  const sortBtn = (k, t) => <button type="button" className={`ls-sort${sort.k === k ? ' on' : ''}`} aria-pressed={sort.k === k} onClick={() => setSort((x) => ({ k, dir: x.k === k ? -x.dir : 1 }))}>{t}{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</button>;

  return (
    <>
      <StateBar kind="stories" st={st} columns={columns} items={st.items} label="stories" />
      <SearchBox value={q} onChange={setQ} errors={errors} fields={fields} values={values} example='user = "Revenue NSW officer" AND path = exception AND ready = no' />
      <div className="ls-filters">
        <Select label="User type" value={f.user} onChange={(v) => setF({ ...f, user: v })} options={USERS} />
        <Select label="Path" value={f.path} onChange={(v) => setF({ ...f, path: v })} options={PATHS} />
        <Select label="Screen" value={f.screen} onChange={(v) => setF({ ...f, screen: v })} options={['search', 'record', 'fields']} />
        <Select label="Ready" value={f.ready} onChange={(v) => setF({ ...f, ready: v })} options={['Ready', 'Not ready']} />
        <Select label="BRD" value={f.brd} onChange={(v) => setF({ ...f, brd: v })} options={BRDS} />
        <Select label="Priority" value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={PRIORITIES} />
        <span className="ls-sortby">Sort: {sortBtn('id', 'ID')} {sortBtn('user', 'User')} {sortBtn('path', 'Path')} {sortBtn('ready', 'Ready')} {sortBtn('priority', 'Priority')}</span>
      </div>
      <p className="ls-meta">{rows.length} of {STORIES.length} stories · BRD requirements with no story: {BRDS.filter((b) => !STORIES.some((s) => s.brd.includes(b))).join(', ') || 'none'}</p>
      {rows.map((s) => {
        const adrs = adrsFor('stories', s.id);
        return (
          <article key={s.id} id={s.id} className={`uh-card uh-st${query.s === s.id ? ' is-hl' : ''}`}>
            <p className="uh-st__h">
              <strong>{s.id}</strong> <Tag open={!ready(s)}>{ready(s) ? 'Ready for dev' : 'Not ready'}</Tag>
              <span className={`ls-chip is-prio is-${String(s.priority).toLowerCase()}`}>{s.priority} priority</span><span className="ls-chip is-user">{s.user}</span><span className={`ls-chip is-path is-${s.path.split(' ')[0]}`}>{s.path}</span>
              {split(s.brd).map((b) => <span key={b} className="ls-chip is-brd">{b}</span>)}
              <Tags tags={s.tags} />
              <span className="uh-meta">{s.screen === 'search' ? 'Search screen' : s.screen === 'record' ? 'Record screen' : 'API'}</span>
              <Pencil id={s.id} on={editing === s.id} toggle={() => setEditing(editing === s.id ? null : s.id)} />
            </p>
            <p>As a <strong>{s.role}</strong>, I want to {s.want}, so {s.so}.</p>
            <ol className="uh-ac">{s.ac.map((a) => <li key={a.w + a.t}><b>Given</b> {a.g}, <b>when</b> {a.w}, <b>then</b> {a.t}.</li>)}</ol>
            <p className="uh-meta">Related questions: {s.qs.length ? s.qs.map((id) => <Link key={id} to={`/uplift/hub/questions?q=${id}`} className="uh-qref">{id}{OPEN(qById(id)) ? ' (open)' : ''}</Link>) : 'none'}
              {adrs.length > 0 && <> · Related ADRs: {adrs.map((a) => <Link key={a.id} to={`/uplift/hub/adr?a=${a.id}`} className="uh-qref">{a.id}</Link>)}</>}</p>
            {s.comment && <p className="ls-ans"><strong>Comment:</strong> {s.comment}</p>}
            <EditedNote it={s} st={st} />
            {editing === s.id && (
              <div className="ls-edit">
                <label className="is-wide">Comment<textarea rows={3} defaultValue={s.comment || ''} onBlur={(e) => st.edit(s.id, { comment: e.target.value })} /></label>
                <label>Ready<select defaultValue={s.readyOverride || ''} onChange={(e) => st.edit(s.id, { readyOverride: e.target.value })}><option value="">Computed ({storyReady(s) ? 'Ready' : 'Not ready'})</option><option>Ready</option><option>Not ready</option></select></label>
                <label>Priority<select defaultValue={s.priority} onChange={(e) => st.edit(s.id, { priority: e.target.value })}>{PRIORITIES.map((u) => <option key={u}>{u}</option>)}</select></label>
                <label>Tags (comma separated)<input defaultValue={split(s.tags).join(', ')} onBlur={(e) => st.edit(s.id, { tags: split(e.target.value).join(', ') })} /></label>
                <label>User type<select defaultValue={s.user} onChange={(e) => st.edit(s.id, { user: e.target.value })}>{USERS.map((u) => <option key={u}>{u}</option>)}</select></label>
                <label>Path<select defaultValue={s.path} onChange={(e) => st.edit(s.id, { path: e.target.value })}>{PATHS.map((u) => <option key={u}>{u}</option>)}</select></label>
                <label>BRD<input defaultValue={split(s.brd).join(', ')} onBlur={(e) => st.edit(s.id, { brd: split(e.target.value) })} /></label>
                <button type="button" className="ls-btn" onClick={() => setEditing(null)}>Done</button>
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
  const st = useItemState('questions', QUESTIONS.map((x) => ({ ...x, answer: '', tags: '', priority: x.priority || '' })));
  const [q, setQ] = useState('');
  const [f, setF] = useState({ status: '', owner: '', screen: query.screen || '', linked: '' });
  const [sort, setSort] = useState({ k: 'id', dir: 1 });
  const [editing, setEditing] = useState(null);
  const owners = useMemo(() => uniq(QUESTIONS.flatMap((x) => x.who.split(/,\s*|;\s*| and /).map((w) => w.replace(/\(.*?\)/g, '').trim()))), []);
  const fields = useMemo(() => ({
    id: (x) => x.id, status: (x) => x.status, owner: (x) => x.who, screen: (x) => x.at || [], topic: (x) => x.topic, priority: (x) => x.priority,
    tag: (x) => split(x.tags), answered: (x) => (x.answer ? 'yes' : 'no'), story: (x) => storiesFor(x.id).map((s) => s.id), adr: (x) => adrsFor('qs', x.id).map((a) => a.id),
    linked: (x) => (storiesFor(x.id).length ? 'yes' : 'no'),
    text: (x) => `${x.topic} ${x.q} ${x.why} ${x.assume} ${x.action} ${x.answer || ''}`,
  }), []);
  const values = useMemo(() => ({
    id: QUESTIONS.map((x) => x.id), status: STATUS, owner: owners, screen: SCREENS, topic: uniq(QUESTIONS.map((x) => x.topic)), priority: PRIORITIES,
    tag: uniq(st.items.flatMap((x) => split(x.tags))), answered: ['yes', 'no'], story: STORIES.map((s) => s.id), adr: ADRS.map((a) => a.id), linked: ['yes', 'no'],
  }), [owners, st.items]);
  const { test, errors } = useMemo(() => compile(q, fields), [q, fields]);
  const keyOf = { id: (x) => idNum(x.id), topic: (x) => x.topic, status: (x) => STATUS.indexOf(x.status), who: (x) => x.who, answer: (x) => (x.answer ? 0 : 1) };
  const rows = st.items
    .filter((x) => (!f.status || x.status === f.status) && (!f.owner || x.who.includes(f.owner)) && (!f.screen || (x.at || []).includes(f.screen)) && (!f.linked || (f.linked === 'No story linked') === !storiesFor(x.id).length))
    .filter(test)
    .sort(sorter(keyOf[sort.k], sort.dir));
  useEffect(() => { if (query.q) document.getElementById(`q-${query.q}`)?.scrollIntoView({ block: 'center' }); }, [query.q]);
  const orphans = QUESTIONS.filter((x) => !storiesFor(x.id).length);
  const columns = [
    { header: 'ID', get: (x) => x.id },
    { header: 'Topic', get: (x) => x.topic },
    { header: 'Question', get: (x) => x.q },
    { header: 'Why it matters', get: (x) => x.why },
    { header: 'Current assumption', get: (x) => x.assume },
    { header: 'Who can answer', get: (x) => x.who },
    { header: 'Status', key: 'status', get: (x) => x.status },
    { header: 'Priority', key: 'priority', get: (x) => x.priority || '' },
    { header: 'Tags', key: 'tags', get: (x) => split(x.tags).join(', ') },
    { header: 'Answer', key: 'answer', get: (x) => x.answer || '' },
    { header: 'Next step', get: (x) => x.action },
    { header: 'Screens', get: (x) => (x.at || []).join(', ') },
    { header: 'Related stories', get: (x) => storiesFor(x.id).map((s) => s.id).join(', ') || `No story linked${x.noStoryReason ? `: ${x.noStoryReason}` : ''}` },
    { header: 'Related ADRs', get: (x) => adrsFor('qs', x.id).map((a) => a.id).join(', ') },
  ];
  const th = (k, t) => (
    <th scope="col" aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="ls-th" onClick={() => setSort((s) => ({ k, dir: s.k === k ? -s.dir : 1 }))}>{t}<span aria-hidden="true">{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ' ⇅'}</span></button>
    </th>
  );
  return (
    <>
      <StateBar kind="questions" st={st} columns={columns} items={st.items} label="questions" />
      <SearchBox value={q} onChange={setQ} errors={errors} fields={fields} values={values} example='status IN ("Assumption to validate", "Confirmation required") AND owner ~ CMCS' />
      <div className="ls-filters">
        <Select label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={STATUS} />
        <Select label="Who can answer" value={f.owner} onChange={(v) => setF({ ...f, owner: v })} options={owners} />
        <Select label="Screen" value={f.screen} onChange={(v) => setF({ ...f, screen: v })} options={SCREENS} />
        <Select label="Stories" value={f.linked} onChange={(v) => setF({ ...f, linked: v })} options={['Linked to a story', 'No story linked']} />
      </div>
      <p className="ls-meta">{rows.length} of {QUESTIONS.length} questions · {QUESTIONS.filter(OPEN).length} open · {orphans.length} with no story linked ({orphans.map((x) => x.id).join(', ') || 'none'}), each with a reason</p>
      <div className="up-scroll">
        <table className="uh-tbl ls-tbl">
          <thead><tr>{th('id', '#')}{th('topic', 'Question')}{th('status', 'Status')}{th('who', 'Who can answer')}{th('answer', 'Answer')}<th scope="col">Related</th><th scope="col">Edit</th></tr></thead>
          <tbody>{rows.map((x) => {
            const sts = storiesFor(x.id); const adrs = adrsFor('qs', x.id);
            return (
              <Fragment key={x.id}>
                <tr id={`q-${x.id}`} className={query.q === x.id ? 'is-hl' : ''}>
                  <td>{x.id}</td>
                  <td><strong>{x.topic}</strong><br />{x.q}{x.see && <><br /><Link to={x.see.to}>{x.see.label} ↗</Link></>} <Tags tags={x.tags} />{x.priority && <span className={`ls-chip is-prio is-${x.priority.toLowerCase()}`}>{x.priority} priority</span>}
                    <details className="ls-more"><summary>Why, assumption, next step</summary><p><b>Why it matters:</b> {x.why}</p><p><b>Current assumption:</b> {x.assume}</p><p><b>Next step:</b> {x.action}</p></details></td>
                  <td><Tag open={OPEN(x)}>{x.status}</Tag>{x.local?.status && x.local.status !== x.base.status && <span className="ls-meta"> (was {x.base.status})</span>}</td>
                  <td>{x.who}</td>
                  <td>{x.answer ? <p className="ls-ans">{x.answer}</p> : <span className="ls-meta">None yet</span>}<EditedNote it={x} st={st} /></td>
                  <td>
                    {sts.length ? <>Stories: {sts.map((s) => <Link key={s.id} to={`/uplift/hub/stories?s=${s.id}`} className="uh-qref">{s.id}</Link>)}</> : <><span className="uh-tag is-open">No story linked</span>{x.noStoryReason && <span className="ls-meta"> {x.noStoryReason}</span>}</>}
                    {adrs.length > 0 && <><br />ADRs: {adrs.map((a) => <Link key={a.id} to={`/uplift/hub/adr?a=${a.id}`} className="uh-qref">{a.id}</Link>)}</>}
                  </td>
                  <td><Pencil id={x.id} on={editing === x.id} toggle={() => setEditing(editing === x.id ? null : x.id)} /></td>
                </tr>
                {editing === x.id && (
                  <tr className="ls-editrow"><td /><td colSpan={6}>
                    <div className="ls-edit">
                      <label className="is-wide">Answer<textarea rows={3} defaultValue={x.answer || ''} onBlur={(e) => st.edit(x.id, { answer: e.target.value })} /></label>
                      <label>Status<select defaultValue={x.status} onChange={(e) => st.edit(x.id, { status: e.target.value })}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
                      <label>Priority<select defaultValue={x.priority || ''} onChange={(e) => st.edit(x.id, { priority: e.target.value })}><option value="">Not set</option>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
                      <label>Tags (comma separated)<input defaultValue={split(x.tags).join(', ')} onBlur={(e) => st.edit(x.id, { tags: split(e.target.value).join(', ') })} /></label>
                      <button type="button" className="ls-btn" onClick={() => setEditing(null)}>Done</button>
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
  const st = useItemState('adrs', ADRS.map((a) => ({ ...a, notes: '', tags: '' })));
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const fields = useMemo(() => ({
    id: (a) => a.id, status: (a) => a.status, title: (a) => a.title, question: (a) => a.qs, story: (a) => a.stories, tag: (a) => split(a.tags),
    text: (a) => `${a.title} ${a.context} ${a.options.map((o) => `${o.name} ${o.how} ${o.pros.join(' ')} ${o.cons.join(' ')}`).join(' ')} ${a.decision} ${a.consequences} ${a.notes || ''}`,
  }), []);
  const values = useMemo(() => ({ id: ADRS.map((a) => a.id), status: ADR_STATUS, title: ADRS.map((a) => a.title), question: QUESTIONS.map((x) => x.id), story: STORIES.map((s) => s.id), tag: uniq(st.items.flatMap((a) => split(a.tags))) }), [st.items]);
  const { test, errors } = useMemo(() => compile(q, fields), [q, fields]);
  const rows = st.items.filter(test);
  useEffect(() => { if (query.a) document.getElementById(query.a)?.scrollIntoView({ block: 'start' }); }, [query.a]);
  const columns = [
    { header: 'ID', get: (a) => a.id },
    { header: 'Title', get: (a) => a.title },
    { header: 'Status', key: 'status', get: (a) => a.status },
    { header: 'Context', get: (a) => a.context },
    { header: 'Options', get: (a) => a.options.map((o) => `${o.name}: ${o.how} For: ${o.pros.join('; ')}. Against: ${o.cons.join('; ')}.`).join('\n') },
    { header: 'Decision', key: 'decision', get: (a) => a.decision },
    { header: 'Consequences', key: 'consequences', get: (a) => a.consequences },
    { header: 'Related questions', get: (a) => a.qs.join(', ') },
    { header: 'Related stories', get: (a) => a.stories.join(', ') },
    { header: 'Tags', key: 'tags', get: (a) => split(a.tags).join(', ') },
    { header: 'Notes', key: 'notes', get: (a) => a.notes || '' },
  ];
  return (
    <>
      <StateBar kind="adrs" st={st} columns={columns} items={st.items} label="ADRs" />
      <SearchBox value={q} onChange={setQ} errors={errors} fields={fields} values={values} example='status = Proposed AND question = U16' />
      <p className="ls-meta">{rows.length} of {ADRS.length} ADRs · {ADRS.map((a) => <Fragment key={a.id}><a href={`#${a.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(a.id)?.scrollIntoView({ block: 'start' }); }}>{a.id}</a> </Fragment>)}</p>
      {rows.map((a) => (
        <article key={a.id} id={a.id} className={`uh-card ad${query.a === a.id ? ' is-hl' : ''}`}>
          <p className="uh-meta"><span className={`uh-tag ${a.status === 'Accepted' ? 'is-done' : 'is-open'}`}>{a.status}</span> <Tags tags={a.tags} />
            Related questions: {a.qs.map((id) => <Link key={id} to={`/uplift/hub/questions?q=${id}`} className="uh-qref">{id}</Link>)} · Related stories: {a.stories.map((id) => <Link key={id} to={`/uplift/hub/stories?s=${id}`} className="uh-qref">{id}</Link>)}
            <Pencil id={a.id} on={editing === a.id} toggle={() => setEditing(editing === a.id ? null : a.id)} /></p>
          <h2 className="uh-h2">{a.id}: {a.title}</h2>
          <p><strong>Context.</strong> {a.context}</p>
          <div className="ad-opts">
            {a.options.map((o) => (
              <section key={o.name} className="ad-opt">
                <h3>{o.name}</h3>
                <p>{o.how}</p>
                <p><strong>For</strong></p><ul>{o.pros.map((x) => <li key={x}>{x}</li>)}</ul>
                <p><strong>Against</strong></p><ul>{o.cons.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
            ))}
          </div>
          <p><strong>Decision.</strong> {a.decision}</p>
          <p><strong>Consequences.</strong> {a.consequences}</p>
          {a.notes && <p className="ls-ans"><strong>Notes:</strong> {a.notes}</p>}
          <EditedNote it={a} st={st} />
          {editing === a.id && (
            <div className="ls-edit">
              <label>Status<select defaultValue={a.status} onChange={(e) => st.edit(a.id, { status: e.target.value })}>{ADR_STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label>Tags (comma separated)<input defaultValue={split(a.tags).join(', ')} onBlur={(e) => st.edit(a.id, { tags: split(e.target.value).join(', ') })} /></label>
              <label className="is-wide">Decision<textarea rows={2} defaultValue={a.decision} onBlur={(e) => st.edit(a.id, { decision: e.target.value })} /></label>
              <label className="is-wide">Consequences<textarea rows={2} defaultValue={a.consequences} onBlur={(e) => st.edit(a.id, { consequences: e.target.value })} /></label>
              <label className="is-wide">Notes<textarea rows={2} defaultValue={a.notes || ''} onBlur={(e) => st.edit(a.id, { notes: e.target.value })} /></label>
              <button type="button" className="ls-btn" onClick={() => setEditing(null)}>Done</button>
            </div>
          )}
        </article>
      ))}
    </>
  );
}
