import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, Kbd } from '@nswds/ui';
import { go } from '../../lib/router.js';
import { INDEX } from './searchIndex.js';

// Jump to any record or run a command from the keyboard. Opens with Ctrl/Cmd+K or "/".
export default function CommandPalette({ open, onOpenChange, commands }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);

  useEffect(() => { if (open) { setQ(''); setSel(0); } }, [open]);

  const items = useMemo(() => {
    const text = q.trim().toLowerCase();
    const squashed = text.replace(/\s/g, '');
    const actions = commands.filter((c) => !text || c.label.toLowerCase().includes(text)).map((c) => ({ ...c, group: 'Actions' }));
    if (!text) return actions;
    const records = INDEX.filter((r) => r.text.toLowerCase().replace(/\s/g, '').includes(squashed)).slice(0, 8)
      .map((r) => ({ id: r.type + r.id, label: r.label, sub: r.sub, tag: r.type, run: () => go(r.to), group: 'Records' }));
    return [...records, ...actions];
  }, [q, commands]);

  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const run = (it) => { onOpenChange(false); it.run(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(x + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(x - 1, 0)); }
    else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); run(items[sel]); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="st-pal" showCloseButton={false}>
        <DialogTitle className="sr-only">Search and commands</DialogTitle>
        <DialogDescription className="sr-only">Type to find a notice, case, camera or certificate, or choose a command. Use the arrow keys and Enter.</DialogDescription>
        <input className="st-pal__input" autoFocus role="combobox" aria-expanded="true" aria-controls="st-pal-list" aria-activedescendant={items[sel] ? `st-pal-${sel}` : undefined}
          aria-label="Search records or run a command" placeholder="Search notice, plate, camera, certificate or case, or type a command"
          value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey} />
        <ul className="st-pal__list" id="st-pal-list" role="listbox" ref={listRef}>
          {items.map((it, i) => (
            <li key={it.id} role="presentation">
              {(i === 0 || items[i - 1].group !== it.group) && <p className="st-pal__group">{it.group}</p>}
              <button type="button" id={`st-pal-${i}`} role="option" aria-selected={i === sel} className="st-pal__item" onMouseMove={() => setSel(i)} onClick={() => run(it)}>
                {it.tag && <span className="st-type">{it.tag}</span>}
                <span className="st-pal__label"><strong>{it.label}</strong>{it.sub && <small>{it.sub}</small>}</span>
                {it.keys && <span className="st-pal__keys">{it.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>}
              </button>
            </li>
          ))}
          {!items.length && <li className="st-none">No match for “{q}”. Try a 10-digit penalty notice number, plate or camera code.</li>}
        </ul>
        <p className="st-pal__foot"><Kbd>↑</Kbd> <Kbd>↓</Kbd> to move · <Kbd>Enter</Kbd> to open · <Kbd>Esc</Kbd> to close</p>
      </DialogContent>
    </Dialog>
  );
}
