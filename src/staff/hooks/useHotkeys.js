import { useEffect, useRef } from 'react';

// Keyboard shortcuts for the staff workspace. Keys are single characters ('j', '?'), two-key
// sequences ('g r'), or modifier combos ('mod+k'). Plain keys are ignored while typing or
// while any dialog or flyout is open, so they never fight with form fields.
const typing = (t) => !!t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable);

export function useHotkeys(map, enabled = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return undefined;
    let seq = '';
    let timer;
    const on = (e) => {
      const m = ref.current;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (mod) {
        const fn = m[`mod+${k}`];
        if (fn) { e.preventDefault(); fn(e); }
        return;
      }
      if (e.altKey || typing(e.target) || document.querySelector('[role="dialog"]')) return;
      const key = seq ? `${seq} ${k}` : k;
      clearTimeout(timer);
      if (m[key]) { seq = ''; e.preventDefault(); m[key](e); return; }
      if (Object.keys(m).some((x) => x.startsWith(`${k} `)) && !seq) { seq = k; timer = setTimeout(() => { seq = ''; }, 900); return; }
      seq = '';
    };
    document.addEventListener('keydown', on);
    return () => { document.removeEventListener('keydown', on); clearTimeout(timer); };
  }, [enabled]);
}
