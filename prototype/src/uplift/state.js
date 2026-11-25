import { useCallback, useEffect, useState } from 'react';
import writeExcelFile from 'write-excel-file/browser';
import { readSheet } from 'read-excel-file/browser';

// Shared state for Questions, Stories and ADRs (owner, 25-26 Nov 2026). One mechanism for all three:
//   baseline = what ships in data.js (the published site). The first export gives exactly this.
//   local    = changes on top of it, one record per ID: field edits (pencil button or Excel import), new items
//              ({ isNew: true, ... }) and soft deletes ({ deleted: true }, hidden, restorable, exported as Deleted).
// Where they are kept (owner, 26 Nov 2026):
//   server  = api/state.php answers (Apache/XAMPP with PHP 8 and pdo_sqlite): one SQLite file next to the site
//             (data/cevoc.sqlite, never in git), shared by everyone who opens the site. There is no login.
//   browser = anywhere else (GitHub Pages, npx serve, python http.server): localStorage, this browser only.
// The page says which one is in use. Export to Excel / import back works the same in both.

const LS = (kind) => `cevoc.uplift.${kind}.local`;
const readLS = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* per-browser only */ } };

export const ID_PREFIX = { questions: 'U', stories: 'S', adrs: 'ADR-' };
export const idNum = (id) => Number(String(id).replace(/\D/g, '')) || 0;
export const formatId = (kind, n) => (kind === 'adrs' ? `ADR-${String(n).padStart(3, '0')}` : `${ID_PREFIX[kind]}${n}`);

// ---- storage detection (once per page load) ----
const API = 'api/state.php';
let modePromise = null;
export function storageMode() {
  if (!modePromise) {
    modePromise = fetch(API, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      // The database file's protection is checked by HOW-TO-RUN.txt step 3 and the exam, not here: a probe from
      // the page would log a 403 in every visitor's console.
      .then((j) => (j && j.ok === true && j.storage === 'sqlite' ? { mode: 'server' } : { mode: 'browser' }))
      .catch(() => ({ mode: 'browser' }));
  }
  return modePromise;
}

async function serverGet(kind) {
  const r = await fetch(`${API}?kind=${kind}`, { cache: 'no-store' });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Server refused');
  return j.items || {};
}
async function serverSet(kind, set) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, set }) });
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  if (!j.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j.items || {};
}

// Hook: merged items for one kind ('questions' | 'stories' | 'adrs').
// `blank` is a template for a new item (the fields a new item has besides its ID).
export function useItemState(kind, baseline, blank = {}) {
  const [local, setLocal] = useState(() => readLS(LS(kind), {}));
  const [mode, setMode] = useState({ mode: 'checking' });
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const load = () => serverGet(kind).then((items) => { if (live) { setLocal(items); setError(''); } }).catch((e) => live && setError(`Could not load shared state: ${e.message}`));
    storageMode().then((m) => {
      if (!live) return;
      setMode(m);
      if (m.mode === 'server') load();
    });
    const onFocus = () => storageMode().then((m) => m.mode === 'server' && load());
    window.addEventListener('focus', onFocus);
    return () => { live = false; window.removeEventListener('focus', onFocus); };
  }, [kind]);

  // Apply a change set { id: record | null } (null removes the record, back to the published baseline).
  const apply = useCallback((set) => {
    setLocal((cur) => {
      const next = { ...cur };
      Object.entries(set).forEach(([id, rec]) => { if (rec === null) delete next[id]; else next[id] = rec; });
      if (mode.mode !== 'server') writeLS(LS(kind), next);
      return next;
    });
    if (mode.mode === 'server') {
      serverSet(kind, set).then((items) => { setLocal(items); setError(''); }).catch((e) => setError(`Not saved on the server: ${e.message}. Reload to see the shared state.`));
    }
  }, [kind, mode.mode]);

  const now = () => new Date().toISOString();
  const edit = (id, patch) => apply({ [id]: { ...(local[id] || {}), ...patch, updatedAt: now() } });
  const undo = (id) => apply({ [id]: null });
  const reset = () => apply(Object.fromEntries(Object.keys(local).map((id) => [id, null])));
  const save = (next) => {
    const set = { ...Object.fromEntries(Object.keys(local).filter((id) => !(id in next)).map((id) => [id, null])), ...next };
    apply(set);
  };
  const baseIds = new Set(baseline.map((b) => b.id));
  const nextId = () => formatId(kind, Math.max(0, ...baseline.map((b) => idNum(b.id)), ...Object.keys(local).map(idNum)) + 1);
  const add = (fields = {}) => { const id = nextId(); apply({ [id]: { ...blank, ...fields, isNew: true, updatedAt: now() } }); return id; };
  const remove = (id) => edit(id, { deleted: true, deletedAt: now() });
  const restore = (id) => {
    const { deleted: _d, deletedAt: _a, ...rest } = local[id] || {};
    const onlyMeta = Object.keys(rest).every((k) => k === 'updatedAt');
    apply({ [id]: onlyMeta && baseIds.has(id) ? null : { ...rest, updatedAt: now() } });
  };

  const merged = baseline.map((b) => ({ ...b, ...(local[b.id] || {}), base: b, local: local[b.id] || null }));
  const added = Object.entries(local).filter(([id, r]) => !baseIds.has(id) && r && r.isNew)
    .map(([id, r]) => ({ ...blank, ...r, id, base: null, local: r }))
    .sort((a, b) => idNum(a.id) - idNum(b.id));
  const all = [...merged, ...added];
  const items = all.filter((x) => !x.deleted);
  const deleted = all.filter((x) => x.deleted);
  return { items, all, deleted, local, mode, error, edit, undo, reset, save, add, remove, restore, nextId };
}

// Excel round trip. One sheet, one row per item (deleted ones too, flagged), stable ID first, every editable field a column.
export async function exportXlsx(fileName, columns, items) {
  const cols = [...columns, { header: 'Deleted', get: (it) => (it.deleted ? 'Yes' : '') }];
  const head = cols.map((c) => ({ value: c.header, fontWeight: 'bold' }));
  const rows = items.map((it) => cols.map((c) => { const v = c.get(it); return v === undefined || v === null || v === '' ? null : String(v); }));
  await writeExcelFile([head, ...rows]).toFile(fileName);
}

// Returns { id: { fields..., deleted } } for every row with an ID. `key` columns are read for every item,
// `nkey` columns only matter for items that are not in the published baseline (new items).
export async function importXlsx(file, columns) {
  const rows = await readSheet(file);
  if (!rows.length) throw new Error('The file is empty.');
  const [head, ...body] = rows;
  const idx = Object.fromEntries(head.map((h, i) => [String(h || '').trim(), i]));
  if (idx.ID === undefined) throw new Error('No ID column: use a file exported from this page.');
  const editable = columns.filter((c) => c.key || c.nkey);
  const out = {};
  body.forEach((r) => {
    const id = String(r[idx.ID] || '').trim();
    if (!id) return;
    const rec = {};
    editable.forEach((c) => { if (idx[c.header] !== undefined) rec[c.key || c.nkey] = r[idx[c.header]] === null || r[idx[c.header]] === undefined ? '' : String(r[idx[c.header]]); });
    if (idx.Deleted !== undefined) rec.deleted = /^(yes|y|true|1|deleted)$/i.test(String(r[idx.Deleted] ?? '').trim());
    out[id] = rec;
  });
  return out;
}
