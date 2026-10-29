import { useEffect, useState } from 'react';
import { useStore } from './store.jsx';

// The prototype's "now": real time plus any days the presenter has skipped. Re-renders every 20 seconds so ages stay honest.
export function useNow() {
  const { state } = useStore();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 20000); return () => clearInterval(t); }, []);
  return Date.now() + state.skew * 864e5;
}
