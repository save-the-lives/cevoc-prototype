import { useEffect, useId, useRef, useState } from 'react';
import { MONTHS, daysIn, earliestIso, isoToParts, partsToIso, todayIso, toIso } from './lookupValidation.js';

// Date entry the NSW way for a date read off a letter: three plain number boxes (day, month, year), with an optional
// calendar for people who prefer to pick. Errors are announced and tied to the field; nothing relies on colour alone.
function Calendar({ value, min, max, onPick, onClose }) {
  const start = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(`${max}T00:00:00`);
  const [view, setView] = useState(new Date(start.getFullYear(), start.getMonth(), 1));
  const [focusIso, setFocusIso] = useState(toIso(start));
  const gridRef = useRef(null);
  const y = view.getFullYear(); const m = view.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // week starts Monday
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn(m + 1, y) }, (_, i) => toIso(new Date(y, m, i + 1)))];
  const inRange = (iso) => iso >= min && iso <= max;
  const move = (iso, days) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + days); const n = toIso(d); return n < min ? min : n > max ? max : n; };
  const addMonths = (iso, n) => { const d = new Date(`${iso}T00:00:00`); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, daysIn(d.getMonth() + 1, d.getFullYear()))); const r = toIso(d); return r < min ? min : r > max ? max : r; };
  const goto = (iso) => { setFocusIso(iso); const d = new Date(`${iso}T00:00:00`); setView(new Date(d.getFullYear(), d.getMonth(), 1)); };
  useEffect(() => { gridRef.current?.querySelector(`[data-iso="${focusIso}"]`)?.focus(); }, [focusIso, view]);
  const key = (e) => {
    const k = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (k) { e.preventDefault(); goto(move(focusIso, k)); }
    else if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); goto(addMonths(focusIso, e.key === 'PageUp' ? -1 : 1)); }
    else if (e.key === 'Home') { e.preventDefault(); goto(move(focusIso, -((new Date(`${focusIso}T00:00:00`).getDay() + 6) % 7))); }
    else if (e.key === 'End') { e.preventDefault(); goto(move(focusIso, 6 - ((new Date(`${focusIso}T00:00:00`).getDay() + 6) % 7))); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
  };
  const prevOk = new Date(y, m, 0) >= new Date(`${min}T00:00:00`); const nextOk = new Date(y, m + 1, 1) <= new Date(`${max}T00:00:00`);
  return (
    <div className="dcal" role="dialog" aria-label="Choose the date of the offence" onKeyDown={key}>
      <div className="dcal-head">
        <button type="button" className="dcal-nav" disabled={!prevOk} onClick={() => goto(addMonths(focusIso, -1))} aria-label="Previous month">‹</button>
        <strong aria-live="polite">{MONTHS[m]} {y}</strong>
        <button type="button" className="dcal-nav" disabled={!nextOk} onClick={() => goto(addMonths(focusIso, 1))} aria-label="Next month">›</button>
      </div>
      <div className="dcal-grid" role="grid" aria-label={`${MONTHS[m]} ${y}`} ref={gridRef}>
        <div role="row" className="dcal-dow">{['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => <span key={d} role="columnheader" aria-label={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}>{d}</span>)}</div>
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, r) => (
          <div role="row" key={r} className="dcal-row">
            {cells.slice(r * 7, r * 7 + 7).concat(Array(7).fill(null)).slice(0, 7).map((iso, i) => (iso ? (
              <span role="gridcell" key={iso} aria-selected={iso === value}>
                <button type="button" data-iso={iso} tabIndex={iso === focusIso ? 0 : -1} disabled={!inRange(iso)}
                  className={`${iso === value ? 'is-sel' : ''} ${iso === max ? 'is-today' : ''}`}
                  aria-label={new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  onClick={() => onPick(iso)}>{Number(iso.slice(8))}</button>
              </span>
            ) : <span key={`e${i}`} role="gridcell" aria-hidden="true" />))}
          </div>
        ))}
      </div>
      <div className="dcal-foot"><button type="button" className="dcal-link" onClick={() => { const t = todayIso(); onPick(t > max ? max : t); }}>Today</button><button type="button" className="dcal-link" onClick={onClose}>Close</button></div>
    </div>
  );
}

export default function DateField({ id, legend, hint, parts, onChange, error, bad = [], min = earliestIso(), max = todayIso(), onBlurField }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const btn = useRef(null);
  const refs = { d: useRef(null), m: useRef(null), y: useRef(null) };
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const set = (k, v, len) => {
    const clean = v.replace(/[^\d]/g, '').slice(0, len);
    onChange({ ...parts, [k]: clean });
    if (clean.length === len && k !== 'y') refs[k === 'd' ? 'm' : 'y'].current?.focus();
  };
  const iso = (() => { try { const x = partsToIso(parts); return /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) ? x : ''; } catch (e) { return ''; } })();
  const box = (k, label, len, w) => (
    <div className="df-part">
      <label htmlFor={`${id}-${k}`}>{label}</label>
      <input id={`${id}-${k}`} ref={refs[k]} className={`df-in df-${w} ${bad.includes(k) ? 'is-bad' : ''}`} inputMode="numeric" autoComplete={k === 'd' ? 'off' : 'off'} maxLength={len + 2}
        value={parts[k]} aria-invalid={bad.includes(k) || undefined} aria-describedby={`${uid}-h ${error ? `${uid}-e` : ''}`}
        onChange={(e) => set(k, e.target.value, len)} onBlur={() => onBlurField?.()} />
    </div>
  );
  return (
    <fieldset className={`df ${error ? 'has-error' : ''}`} ref={wrap} id={id}>
      <legend>{legend}</legend>
      <p className="df-hint" id={`${uid}-h`}>{hint}</p>
      {error && <p className="df-err" id={`${uid}-e`} role="alert"><span aria-hidden="true">⚠ </span><span className="sr-only">Error: </span>{error}</p>}
      <div className="df-row">
        {box('d', 'Day', 2, 'sm')}{box('m', 'Month', 2, 'sm')}{box('y', 'Year', 4, 'lg')}
        <div className="df-cal">
          <button type="button" ref={btn} className="df-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
            Choose date
          </button>
          {open && <Calendar value={iso} min={min} max={max} onClose={() => { setOpen(false); btn.current?.focus(); }}
            onPick={(v) => { onChange(isoToParts(v)); setOpen(false); btn.current?.focus(); }} />}
        </div>
      </div>
    </fieldset>
  );
}
