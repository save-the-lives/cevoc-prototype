import { useMemo, useState } from 'react';
import { Button, Kbd, Popover, PopoverContent, PopoverTrigger } from '@nswds/ui';
import { EXAMPLES, FIELDS, FIELD_NAMES, OPERATORS, suggest } from './query.js';

// The queue filter: a Jira-style query box with suggestions as you type, an inline error with the
// offending part marked, and a syntax guide. Plain words still work as a text search.
export default function QueryBar({ value, onChange, inputRef, error, shown, total }) {
  const [focus, setFocus] = useState(false);
  const [sel, setSel] = useState(-1);
  const [closed, setClosed] = useState(false);
  const sug = useMemo(() => suggest(value), [value]);
  const open = focus && !closed && sug.items.length > 0;

  const accept = (item) => {
    const tail = item.insert === '(' ? '' : ' ';
    onChange(value.slice(0, sug.from) + item.insert + tail);
    setSel(-1); setClosed(false);
    inputRef.current?.focus();
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); setSel((x) => Math.min(x + 1, sug.items.length - 1)); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setSel((x) => Math.max(x - 1, -1)); }
    else if ((e.key === 'Tab' || e.key === 'Enter') && open && (sel >= 0 || e.key === 'Tab')) { e.preventDefault(); accept(sug.items[Math.max(sel, 0)]); }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); e.stopPropagation(); setClosed(true); } else e.currentTarget.blur(); }
  };

  return (
    <div className="st-qb">
      <div className="st-qb__row">
        <div className="st-qb__box">
          <span className="st-qb__lead" aria-hidden="true">Query</span>
          <input ref={inputRef} className={`st-qb__input ${error ? 'is-bad' : ''}`} role="combobox" aria-expanded={open} aria-controls="st-qb-list" aria-autocomplete="list"
            aria-label="Filter cases with a query" aria-invalid={!!error} aria-describedby={error ? 'st-qb-err' : undefined} aria-activedescendant={open && sel >= 0 ? `st-qb-${sel}` : undefined}
            spellCheck="false" autoComplete="off" placeholder='assignee = me AND waiting > 14 ORDER BY waiting DESC   (press f)'
            value={value} onChange={(e) => { onChange(e.target.value); setSel(-1); setClosed(false); }} onKeyDown={onKey} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 120)} />
          {value && <button type="button" className="st-qb__x" aria-label="Clear query" onClick={() => { onChange(''); inputRef.current?.focus(); }}>✕</button>}
          {open && (
            <ul className="st-qb__list" id="st-qb-list" role="listbox">
              {sug.items.map((it, i) => (
                <li key={it.label + i} role="presentation">
                  <button type="button" id={`st-qb-${i}`} role="option" aria-selected={i === sel} className="st-qb__opt" onMouseDown={(e) => { e.preventDefault(); accept(it); }} onMouseMove={() => setSel(i)}>
                    <code>{it.label}</code>{it.hint && <small>{it.hint}</small>}
                  </button>
                </li>
              ))}
              <li className="st-qb__tip" role="presentation"><Kbd>Tab</Kbd> to accept · <Kbd>↑</Kbd> <Kbd>↓</Kbd> to choose</li>
            </ul>
          )}
        </div>
        <Popover>
          <PopoverTrigger render={<Button size="sm" variant="outline">Syntax</Button>} />
          <PopoverContent align="end" className="st-qb__help">
            <p className="st-cols__h">Query syntax</p>
            <p>Join conditions with <code>AND</code>, <code>OR</code>, <code>NOT</code> and brackets. Add <code>ORDER BY</code> to sort. Plain words search every column.</p>
            <p className="st-qb__sub">Operators</p>
            <p><code>{OPERATORS.join('  ')}</code></p>
            <p className="st-qb__sub">Fields</p>
            <dl className="st-qb__fields">{FIELD_NAMES.map((n) => <div key={n}><dt><code>{n}</code></dt><dd>{FIELDS[n].help}</dd></div>)}</dl>
            <p className="st-qb__sub">Try</p>
            <ul className="st-qb__examples">{EXAMPLES.map((x) => <li key={x}><button type="button" onClick={() => { onChange(x); inputRef.current?.focus(); }}><code>{x}</code></button></li>)}</ul>
          </PopoverContent>
        </Popover>
      </div>
      <div className="st-qb__status" role="status">
        {error ? (
          <p id="st-qb-err" className="st-qb__err">
            <strong>{error.message}.</strong>{' '}
            {value.slice(error.pos, error.end).trim() && <>Near <code>{value.slice(error.pos, error.end)}</code>. </>}Showing the last valid results.
          </p>
        ) : <p className="st-muted">{shown} of {total} cases</p>}
      </div>
    </div>
  );
}
