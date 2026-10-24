import { useCallback, useState } from 'react';
import { COLUMNS, COLUMN_BY_ID } from '../queue/columns.jsx';

// Which queue columns are shown, in what order, and how dense the rows are. Remembered in this browser.
const KEY = 'cevoc-queue-prefs-v1';
const ALL = COLUMNS.map((c) => c.id);
const DEFAULT = { order: ALL, hidden: COLUMNS.filter((c) => !c.def).map((c) => c.id), density: 'comfortable' };

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s) return DEFAULT;
    const order = [...s.order.filter((id) => COLUMN_BY_ID[id]), ...ALL.filter((id) => !s.order.includes(id))];
    return { order, hidden: s.hidden.filter((id) => COLUMN_BY_ID[id] && !COLUMN_BY_ID[id].locked), density: s.density === 'compact' ? 'compact' : 'comfortable' };
  } catch (e) { return DEFAULT; }
}

export function useColumns() {
  const [prefs, setPrefs] = useState(load);
  const save = useCallback((next) => { setPrefs(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* ignore */ } }, []);

  const toggle = (id) => { if (COLUMN_BY_ID[id].locked) return; save({ ...prefs, hidden: prefs.hidden.includes(id) ? prefs.hidden.filter((x) => x !== id) : [...prefs.hidden, id] }); };
  const moveTo = (id, target) => {
    if (!id || id === target) return;
    const order = prefs.order.filter((x) => x !== id);
    order.splice(prefs.order.indexOf(target), 0, id);
    save({ ...prefs, order });
  };
  const nudge = (id, dir) => {
    const i = prefs.order.indexOf(id); const j = i + dir;
    if (j < 0 || j >= prefs.order.length) return;
    const order = [...prefs.order]; [order[i], order[j]] = [order[j], order[i]];
    save({ ...prefs, order });
  };
  return {
    order: prefs.order, hidden: prefs.hidden, density: prefs.density,
    visible: prefs.order.filter((id) => !prefs.hidden.includes(id)).map((id) => COLUMN_BY_ID[id]),
    toggle, moveTo, nudge,
    setDensity: (density) => save({ ...prefs, density }),
    reset: () => save({ ...DEFAULT, density: prefs.density }),
  };
}
