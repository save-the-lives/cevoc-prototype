import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '../shared/ui.jsx';
import { OPEN, PATHS, PRIORITIES, QUESTIONS, STATUS, STORIES, USERS, qById, storyReady } from './data.js';
import { compile } from './jql.js';
import { exportXlsx, importXlsx, issueLink, useItemState } from './state.js';

// Hub Stories and Questions pages (owner, 25 Nov 2026): tagged, filterable, JQL-style searchable and sortable;
// answer via a GitHub issue; edit on the page; export the latest state to Excel and import it back. The published
// data is the baseline; edits stay in this browser until the exported file is handed back and the site updated.

const Tag = ({ open, children }) => <span className={`uh-tag ${open ? 'is-open' : 'is-done'}`}>{children}</span>;
const BRDS = ['BR_01', 'BR_02', 'BR_03', 'BR_04', 'BR_05', 'BR_06', 'BR_07', 'BR_08', 'BR_09', 'BR_10'];
const today = () => new Date().toISOString().slice(0, 10);
const split = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/).filter(Boolean));

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
        <button type="button" onClick={st.reloadIssues}>Reload answers from GitHub</button>
        {edits > 0 && <button type="button" onClick={() => { if (window.confirm(`Discard ${edits} local edit(s) in this browser?`)) st.reset(); }}>Discard local edits ({edits})</button>}
      </div>
      <p className="ls-meta" role="status">
        {msg && <strong>{msg} </strong>}
        {st.issues.loading ? 'Loading answers from GitHub… ' : `${st.issues.items.filter((i) => i.id[0] === (kind === 'questions' ? 'U' : 'S')).length} answer(s) on GitHub. `}
        {st.issues.note && <em>{st.issues.note} </em>}
        Edits and imports stay in this browser only; they can’t write to GitHub. To make them permanent, export and hand the file back.
      </p>
    </div>
  );
}

function Search({ value, onChange, help, errors }) {
  return (
    <div className="ls-search">
      <label htmlFor="ls-q">Search</label>
      <input id="ls-q" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={help.example} aria-describedby="ls-q-help" spellCheck={false} />
      <p id="ls-q-help" className="ls-meta">Free text, or JQL-style: <code>field = value</code>, <code>!=</code>, <code>~</code> contains, <code>!~</code>, joined with <code>AND</code> / <code>OR</code>, quotes for spaces, brackets to group. Fields: {help.fields}. {help.extra}</p>
      {errors.length > 0 && <p className="ls-err" role="alert">{errors[0]}</p>}
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

function IssueNote({ it }) {
  if (!it.issue && !it.local) return null;
  return (
    <p className="ls-ans">
      {it.issue && <><strong>On GitHub</strong> (<a href={it.issue.url} target="_blank" rel="noreferrer">#{it.issue.number}</a>, {it.issue.updatedAt.slice(0, 10)}{it.newer === 'issue' ? ', newer' : ''}): {it.issue.body || <em>no text</em>}<br /></>}
      {it.local && <><strong>In this browser</strong> ({String(it.local.updatedAt).slice(0, 10)}{it.local.imported ? `, imported from ${it.local.imported}` : ''}{it.newer === 'local' ? ', newer' : ''})</>}
    </p>
  );
}

const sorter = (get, dir) => (a, b) => { const x = get(a); const y = get(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; };
const idNum = (id) => Number(String(id).slice(1));

// --------------------------------------------------------------------------------------------------------------
export function StoriesPage({ query = {} }) {
  const st = useItemState('stories', STORIES.map((s) => ({ ...s, comment: '' })));
  const [q, setQ] = useState('');
  const [f, setF] = useState({ user: '', path: '', screen: query.screen || '', ready: '', brd: '', priority: '' });
  const [sort, setSort] = useState({ k: 'id', dir: 1 });
  const [editing, setEditing] = useState(query.s || null);
  const ready = (s) => {
    if (s.readyOverride === 'Ready') return true;
    if (s.readyOverride === 'Not ready') return false;
    return storyReady(s);
  };
  const fields = {
    id: (s) => s.id, priority: (s) => s.priority, user: (s) => s.user, path: (s) => s.path, screen: (s) => s.screen, brd: (s) => split(s.brd),
    ready: (s) => (ready(s) ? 'yes' : 'no'), question: (s) => s.qs, role: (s) => s.role, text: (s) => `${s.want} ${s.so} ${s.ac.map((a) => `${a.g} ${a.w} ${a.t}`).join(' ')} ${s.comment || ''}`,
  };
  const { test, errors } = useMemo(() => compile(q, fields), [q]); // eslint-disable-line react-hooks/exhaustive-deps
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
    { header: 'Screen', get: (s) => s.screen },
    { header: 'Story', get: (s) => `As a ${s.role}, I want to ${s.want}, so ${s.so}.` },
    { header: 'Acceptance criteria', get: (s) => s.ac.map((a, i) => `${i + 1}. Given ${a.g}, when ${a.w}, then ${a.t}.`).join('\n') },
    { header: 'Questions', get: (s) => s.qs.join(', ') },
    { header: 'Ready (computed)', get: (s) => (storyReady(s) ? 'Ready' : 'Not ready') },
    { header: 'Ready override', key: 'readyOverride', get: (s) => s.readyOverride || '' },
    { header: 'Comment', key: 'comment', get: (s) => s.comment || '' },
    { header: 'GitHub answer', get: (s) => s.issue?.body || '' },
  ];
  const sortBtn = (k, t) => <button type="button" className={`ls-sort${sort.k === k ? ' on' : ''}`} aria-pressed={sort.k === k} onClick={() => setSort((x) => ({ k, dir: x.k === k ? -x.dir : 1 }))}>{t}{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</button>;

  return (
    <>
      <StateBar kind="stories" st={st} columns={columns} items={st.items} label="stories" />
      <Search value={q} onChange={setQ} errors={errors} help={{ example: 'user = "Revenue NSW officer" AND path = exception AND ready = no', fields: 'id, priority, user, path, screen, brd, ready (yes/no), question, role, text', extra: <>E.g. <code>brd = BR_01</code>.</> }} />
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
      {rows.map((s) => (
        <article key={s.id} id={s.id} className={`uh-card uh-st${query.s === s.id ? ' is-hl' : ''}`}>
          <p className="uh-st__h">
            <strong>{s.id}</strong> <Tag open={!ready(s)}>{ready(s) ? 'Ready for dev' : 'Not ready'}</Tag>
            <span className={`ls-chip is-prio is-${String(s.priority).toLowerCase()}`}>{s.priority} priority</span><span className="ls-chip is-user">{s.user}</span><span className={`ls-chip is-path is-${s.path.split(' ')[0]}`}>{s.path}</span>
            {split(s.brd).map((b) => <span key={b} className="ls-chip is-brd">{b}</span>)}
            <span className="uh-meta">{s.screen === 'search' ? 'Search screen' : s.screen === 'record' ? 'Record screen' : 'API'}</span>
          </p>
          <p>As a <strong>{s.role}</strong>, I want to {s.want}, so {s.so}.</p>
          <ol className="uh-ac">{s.ac.map((a) => <li key={a.w + a.t}><b>Given</b> {a.g}, <b>when</b> {a.w}, <b>then</b> {a.t}.</li>)}</ol>
          {s.qs.length > 0 && <p className="uh-meta">Questions: {s.qs.map((id) => <Link key={id} to={`/uplift/hub/questions?q=${id}`} className="uh-qref">{id}{OPEN(qById(id)) ? ' (open)' : ''}</Link>)}</p>}
          {s.comment && <p className="ls-ans"><strong>Comment:</strong> {s.comment}</p>}
          <IssueNote it={s} />
          <div className="ls-actions">
            <a className="ls-btn" href={issueLink(s.id, `Story: ${s.want}`, `Comment on story ${s.id} (As a ${s.role}, I want to ${s.want}).\n\nReady for dev? yes / no\n\nComment:\n`)} target="_blank" rel="noreferrer">Comment on GitHub ↗</a>
            <button type="button" className="ls-btn" aria-expanded={editing === s.id} onClick={() => setEditing(editing === s.id ? null : s.id)}>Edit here</button>
          </div>
          {editing === s.id && (
            <div className="ls-edit">
              <label>Comment<textarea rows={3} defaultValue={s.comment || ''} onBlur={(e) => st.edit(s.id, { comment: e.target.value })} /></label>
              <label>Ready<select defaultValue={s.readyOverride || ''} onChange={(e) => st.edit(s.id, { readyOverride: e.target.value })}><option value="">Computed ({storyReady(s) ? 'Ready' : 'Not ready'})</option><option>Ready</option><option>Not ready</option></select></label>
              <label>User type<select defaultValue={s.user} onChange={(e) => st.edit(s.id, { user: e.target.value })}>{USERS.map((u) => <option key={u}>{u}</option>)}</select></label>
              <label>Path<select defaultValue={s.path} onChange={(e) => st.edit(s.id, { path: e.target.value })}>{PATHS.map((u) => <option key={u}>{u}</option>)}</select></label>
              <label>Priority<select defaultValue={s.priority} onChange={(e) => st.edit(s.id, { priority: e.target.value })}>{PRIORITIES.map((u) => <option key={u}>{u}</option>)}</select></label>
              <label>BRD<input defaultValue={split(s.brd).join(', ')} onBlur={(e) => st.edit(s.id, { brd: split(e.target.value) })} /></label>
            </div>
          )}
        </article>
      ))}
    </>
  );
}

// --------------------------------------------------------------------------------------------------------------
export function QuestionsPage({ query = {} }) {
  const st = useItemState('questions', QUESTIONS.map((x) => ({ ...x, answer: '' })));
  const [q, setQ] = useState('');
  const [f, setF] = useState({ status: '', owner: '', screen: query.screen || '' });
  const [sort, setSort] = useState({ k: 'id', dir: 1 });
  const [editing, setEditing] = useState(null);
  const owners = useMemo(() => [...new Set(QUESTIONS.flatMap((x) => x.who.split(/,\s*|;\s*| and /).map((w) => w.replace(/\(.*?\)/g, '').trim())).filter(Boolean))].sort(), []);
  const fields = {
    id: (x) => x.id, status: (x) => x.status, owner: (x) => x.who, who: (x) => x.who, screen: (x) => x.at || [], topic: (x) => x.topic,
    answered: (x) => (x.answer || x.issue ? 'yes' : 'no'), story: (x) => STORIES.filter((s) => s.qs.includes(x.id)).map((s) => s.id),
    text: (x) => `${x.topic} ${x.q} ${x.why} ${x.assume} ${x.action} ${x.answer || ''} ${x.issue?.body || ''}`,
  };
  const { test, errors } = useMemo(() => compile(q, fields), [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const keyOf = { id: (x) => idNum(x.id), topic: (x) => x.topic, status: (x) => STATUS.indexOf(x.status), who: (x) => x.who, answer: (x) => (x.answer || x.issue ? 0 : 1) };
  const rows = st.items
    .filter((x) => (!f.status || x.status === f.status) && (!f.owner || x.who.includes(f.owner)) && (!f.screen || (x.at || []).includes(f.screen)))
    .filter(test)
    .sort(sorter(keyOf[sort.k], sort.dir));
  useEffect(() => { if (query.q) document.getElementById(`q-${query.q}`)?.scrollIntoView({ block: 'center' }); }, [query.q]);
  const columns = [
    { header: 'ID', get: (x) => x.id },
    { header: 'Topic', get: (x) => x.topic },
    { header: 'Question', get: (x) => x.q },
    { header: 'Why it matters', get: (x) => x.why },
    { header: 'Current assumption', get: (x) => x.assume },
    { header: 'Who can answer', get: (x) => x.who },
    { header: 'Status', key: 'status', get: (x) => x.status },
    { header: 'Answer', key: 'answer', get: (x) => x.answer || '' },
    { header: 'Next step', get: (x) => x.action },
    { header: 'Screens', get: (x) => (x.at || []).join(', ') },
    { header: 'Stories', get: (x) => STORIES.filter((s) => s.qs.includes(x.id)).map((s) => s.id).join(', ') },
    { header: 'GitHub answer', get: (x) => x.issue?.body || '' },
  ];
  const th = (k, t) => (
    <th scope="col" aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="ls-th" onClick={() => setSort((s) => ({ k, dir: s.k === k ? -s.dir : 1 }))}>{t}<span aria-hidden="true">{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ' ⇅'}</span></button>
    </th>
  );
  return (
    <>
      <StateBar kind="questions" st={st} columns={columns} items={st.items} label="questions" />
      <Search value={q} onChange={setQ} errors={errors} help={{ example: 'status = "Assumption to validate" AND owner ~ CMCS', fields: 'id, status, owner, screen, topic, answered (yes/no), story, text', extra: '' }} />
      <div className="ls-filters">
        <Select label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={STATUS} />
        <Select label="Who can answer" value={f.owner} onChange={(v) => setF({ ...f, owner: v })} options={owners} />
        <Select label="Screen" value={f.screen} onChange={(v) => setF({ ...f, screen: v })} options={['search', 'record', 'fields', 'entry', 'journey']} />
      </div>
      <p className="ls-meta">{rows.length} of {QUESTIONS.length} questions · {QUESTIONS.filter(OPEN).length} open</p>
      <div className="up-scroll">
        <table className="uh-tbl ls-tbl">
          <thead><tr>{th('id', '#')}{th('topic', 'Question')}{th('status', 'Status')}{th('who', 'Who can answer')}{th('answer', 'Answer')}<th scope="col">Stories</th></tr></thead>
          <tbody>{rows.map((x) => (
            <Fragment key={x.id}>
              <tr id={`q-${x.id}`} className={query.q === x.id ? 'is-hl' : ''}>
                <td>{x.id}</td>
                <td><strong>{x.topic}</strong><br />{x.q}{x.see && <><br /><Link to={x.see.to}>{x.see.label} ↗</Link></>}<details className="ls-more"><summary>Why, assumption, next step</summary><p><b>Why it matters:</b> {x.why}</p><p><b>Current assumption:</b> {x.assume}</p><p><b>Next step:</b> {x.action}</p></details></td>
                <td><Tag open={OPEN(x)}>{x.status}</Tag>{x.local?.status && x.local.status !== x.base.status && <span className="ls-meta"> (was {x.base.status})</span>}</td>
                <td>{x.who}</td>
                <td>{x.answer && <p className="ls-ans"><strong>Here:</strong> {x.answer}</p>}<IssueNote it={x} />
                  <div className="ls-actions">
                    <a className="ls-btn" href={issueLink(x.id, x.topic, `Answer to question ${x.id}: ${x.q}\n\nAnswer:\n\nStatus (Confirmed requirement / Confirmation required / Assumption to validate / Proposed UX improvement / Out of scope):\n`)} target="_blank" rel="noreferrer">Answer on GitHub ↗</a>
                    <button type="button" className="ls-btn" aria-expanded={editing === x.id} onClick={() => setEditing(editing === x.id ? null : x.id)}>Edit here</button>
                  </div>
                </td>
                <td>{STORIES.filter((s) => s.qs.includes(x.id)).map((s) => <Link key={s.id} to={`/uplift/hub/stories?s=${s.id}`}>{s.id} </Link>)}</td>
              </tr>
              {editing === x.id && (
                <tr className="ls-editrow"><td /><td colSpan={5}>
                  <div className="ls-edit">
                    <label>Status<select defaultValue={x.status} onChange={(e) => st.edit(x.id, { status: e.target.value })}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
                    <label className="is-wide">Answer<textarea rows={3} defaultValue={x.answer || ''} onBlur={(e) => st.edit(x.id, { answer: e.target.value })} /></label>
                  </div>
                </td></tr>
              )}
            </Fragment>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
