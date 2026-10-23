import { useCallback, useEffect, useState } from 'react';

// Runs an async loader; re-runs when deps change. Returns { data, error, loading, reload }.
export function useAsync(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error) => live && setState({ data: null, error, loading: false }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload };
}
