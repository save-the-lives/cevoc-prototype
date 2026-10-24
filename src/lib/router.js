import { useEffect, useState } from 'react';

const read = () => (window.location.hash.replace(/^#/, '') || '/');

export function useRoute() {
  const [raw, setRaw] = useState(read);
  useEffect(() => {
    const on = () => { setRaw(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [path, qs = ''] = raw.split('?');
  return { raw, parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs)) };
}

export const go = (to) => { window.location.hash = to; };
