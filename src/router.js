import { useEffect, useState } from 'react';

// Hash routing: works under `npm run dev`, a static server, or GitHub Pages with no server config.
const read = () => (typeof window !== 'undefined' && window.location.hash.replace(/^#/, '')) || '/';

export function useHashRoute() {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setPath(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export const go = (to) => {
  window.location.hash = to;
};

export const segments = (path) => path.split('?')[0].split('/').filter(Boolean);
