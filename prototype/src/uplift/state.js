import { useCallback, useState } from 'react';
import writeExcelFile from 'write-excel-file/browser';
import { readSheet } from 'read-excel-file/browser';

// Shared state for Questions, Stories and ADRs (owner, 25 Nov 2026). One mechanism for all three:
//   baseline = what ships in data.js (the published site). The first export gives exactly this.
//   local    = edits made with the pencil button or imported from an exported Excel file; kept in this browser only.
// Nothing here writes anywhere else: the exported file is handed back and the site is updated from it.
// (The earlier idea of answering through GitHub issues was removed on 25 Nov 2026.)

const LS = (kind) => `cevoc.uplift.${kind}.local`;
const readLS = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* per-browser only */ } };

// Hook: merged items for one kind ('questions' | 'stories' | 'adrs').
export function useItemState(kind, baseline) {
  const [local, setLocal] = useState(() => readLS(LS(kind), {}));
  const save = useCallback((next) => { setLocal(next); writeLS(LS(kind), next); }, [kind]);
  const edit = (id, patch) => save({ ...local, [id]: { ...(local[id] || {}), ...patch, updatedAt: new Date().toISOString() } });
  const undo = (id) => { const { [id]: _gone, ...rest } = local; save(rest); };
  const reset = () => save({});
  const items = baseline.map((b) => ({ ...b, ...(local[b.id] || {}), base: b, local: local[b.id] || null }));
  return { items, local, edit, undo, reset, save };
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
