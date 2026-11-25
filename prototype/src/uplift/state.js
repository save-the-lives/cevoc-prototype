import { useCallback, useEffect, useState } from 'react';
import writeExcelFile from 'write-excel-file/browser';
import { readSheet } from 'read-excel-file/browser';

// Shared state for Questions and Stories (owner, 25 Nov 2026). One mechanism for both:
//   baseline  = what ships in data.js (the published site). The first export gives exactly this.
//   issues    = answers posted as GitHub issues titled "[U3] ..." or "[S11] ...", read anonymously from the
//               public API (about 60 reads an hour per visitor, so cached for 10 minutes; a limit never breaks the page).
//   local     = edits made on the page or imported from an exported Excel file; kept in this browser only.
// Per item the newer of issue and local wins, and the page says which. Nothing here can write to GitHub: the
// exported file is handed back and the site is updated from it.

export const REPO = 'save-the-lives/cevoc-prototype';
const LS = (kind) => `cevoc.uplift.${kind}.local`;
const CACHE = 'cevoc.uplift.issues';
const TTL = 10 * 60 * 1000;

const readLS = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* per-browser only */ } };

let issuePromise = null;
export function loadIssues(force = false) {
  if (issuePromise && !force) return issuePromise;
  issuePromise = (async () => {
    const cached = (() => { try { return JSON.parse(sessionStorage.getItem(CACHE) || 'null'); } catch { return null; } })();
    if (!force && cached && Date.now() - cached.at < TTL) return cached;
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/issues?state=all&per_page=100&sort=updated`, { headers: { Accept: 'application/vnd.github+json' } });
      if (r.status === 403 || r.status === 429) return { at: Date.now(), items: cached?.items || [], note: 'GitHub’s hourly limit for anonymous reads was reached; showing the last answers loaded. Try again later.' };
      if (!r.ok) return { at: Date.now(), items: cached?.items || [], note: `Couldn’t read answers from GitHub (${r.status}).` };
      const list = await r.json();
      const items = list.map((i) => {
        const m = /^\s*\[(U\d+|S\d+)\]/.exec(i.title || '');
        return m ? { id: m[1], number: i.number, url: i.html_url, body: (i.body || '').trim(), state: i.state, user: i.user?.login, updatedAt: i.updated_at } : null;
      }).filter(Boolean);
      const out = { at: Date.now(), items };
      try { sessionStorage.setItem(CACHE, JSON.stringify(out)); } catch { /* fine */ }
      return out;
    } catch {
      return { at: Date.now(), items: cached?.items || [], note: 'Couldn’t reach GitHub; showing answers without it.' };
    }
  })();
  return issuePromise;
}

export const issueLink = (id, title, body) =>
  `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(`[${id}] ${title}`)}&body=${encodeURIComponent(body)}`;

// Hook: merged items for one kind ('questions' | 'stories').
export function useItemState(kind, baseline) {
  const [local, setLocal] = useState(() => readLS(LS(kind), {}));
  const [issues, setIssues] = useState({ items: [], note: null, loading: true });
  useEffect(() => { loadIssues().then((x) => setIssues({ ...x, loading: false })); }, []);
  const save = useCallback((next) => { setLocal(next); writeLS(LS(kind), next); }, [kind]);
  const edit = (id, patch) => save({ ...local, [id]: { ...(local[id] || {}), ...patch, updatedAt: new Date().toISOString() } });
  const reset = () => save({});
  const items = baseline.map((b) => {
    const iss = issues.items.filter((i) => i.id === b.id).sort((x, y) => (x.updatedAt < y.updatedAt ? 1 : -1))[0];
    const loc = local[b.id];
    const newer = iss && loc ? (iss.updatedAt > loc.updatedAt ? 'issue' : 'local') : iss ? 'issue' : loc ? 'local' : null;
    return { ...b, ...(loc || {}), base: b, issue: iss || null, local: loc || null, newer };
  });
  return { items, issues, local, edit, reset, save, reloadIssues: () => { setIssues((x) => ({ ...x, loading: true })); loadIssues(true).then((x) => setIssues({ ...x, loading: false })); } };
}

// Excel round trip. One sheet, one row per item, stable ID first, every editable field a column.
export async function exportXlsx(fileName, columns, items) {
  const head = columns.map((c) => ({ value: c.header, fontWeight: 'bold' }));
  const rows = items.map((it) => columns.map((c) => { const v = c.get(it); return v === undefined || v === null || v === '' ? null : String(v); }));
  await writeExcelFile([head, ...rows]).toFile(fileName);
}

export async function importXlsx(file, columns) {
  const rows = await readSheet(file);
  if (!rows.length) throw new Error('The file is empty.');
  const [head, ...body] = rows;
  const idx = Object.fromEntries(head.map((h, i) => [String(h || '').trim(), i]));
  if (idx.ID === undefined) throw new Error('No ID column: use a file exported from this page.');
  const editable = columns.filter((c) => c.key);
  const out = {};
  body.forEach((r) => {
    const id = String(r[idx.ID] || '').trim();
    if (!id) return;
    const rec = {};
    editable.forEach((c) => { if (idx[c.header] !== undefined) rec[c.key] = r[idx[c.header]] === null || r[idx[c.header]] === undefined ? '' : String(r[idx[c.header]]); });
    out[id] = { ...rec, updatedAt: new Date().toISOString(), imported: file.name };
  });
  return out;
}
