import { useCallback, useEffect, useState } from 'react';

// Simulates loading one thing (an image, the certificate check, metadata) with an optional fault.
// status: loading | slow | ready | error | missing
export function useSim(fault, baseMs = 500, deps = []) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let live = true;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(() => live && fn(), ms));
    setStatus('loading');
    const f = attempt > 0 && fault === 'error' ? null : fault; // retry recovers
    if (f === 'missing') later(() => setStatus('missing'), baseMs);
    else if (f === 'error') later(() => setStatus('error'), baseMs + 700);
    else if (f === 'slow') { later(() => setStatus('slow'), 1800); later(() => setStatus('ready'), 3800); }
    else later(() => setStatus('ready'), baseMs);
    return () => { live = false; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fault, attempt, ...deps]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { status, retry, done: status === 'ready' };
}

// Same as useSim, for a list of items (e.g. a media gallery). Each item loads independently.
export function useSimMany(items, plan, baseMs = 450) {
  const [status, setStatus] = useState({});
  const key = items.map((i) => i.id).join('|') + JSON.stringify(plan);

  useEffect(() => {
    let live = true;
    const timers = [];
    const set = (id, s) => live && setStatus((m) => ({ ...m, [id]: s }));
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    setStatus(Object.fromEntries(items.map((i) => [i.id, 'loading'])));
    items.forEach((it, idx) => {
      const f = plan[it.id];
      const t = baseMs + idx * 150;
      if (f === 'missing') later(() => set(it.id, 'missing'), t);
      else if (f === 'error') later(() => set(it.id, 'error'), t + 700);
      else if (f === 'slow') { later(() => set(it.id, 'slow'), 1800); later(() => set(it.id, 'ready'), 3800 + idx * 300); }
      else later(() => set(it.id, 'ready'), t);
    });
    return () => { live = false; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Retry reloads just that item, and succeeds (transient failure).
  const retry = useCallback((id) => {
    setStatus((m) => ({ ...m, [id]: 'loading' }));
    setTimeout(() => setStatus((m) => ({ ...m, [id]: 'ready' })), 900);
  }, []);
  return { status, retry };
}
