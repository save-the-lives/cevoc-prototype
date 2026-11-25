import { useEffect, useRef, useState } from 'react';
import { addDays, fmtDay, parseDay, sameDay } from './data.js';

// From and To, days only, with one calendar for the whole range (airline style; owner decision 25 Nov 2026).
// Follows the NSW Design System date picker: a text field in dd/mm/yyyy that can always be typed into, a calendar
// button that opens a dialog with a grid of day buttons, arrows move by day, Home/End to the week's ends,
// Page Up/Down by month (Shift for year), Enter or Space picks, Escape closes. The NSW picker has no range mode,
// so the range (first pick = From, second = To, days between highlighted) is this prototype's extension (U27).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));
const addMonths = (d, n) => { const t = new Date(d.getFullYear(), d.getMonth() + n, 1); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last)); };
const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };

function Calendar({ from, to, onPick, onClose, labelledBy }) {
  const [focus, setFocus] = useState(from || to || today());
  const [hover, setHover] = useState(null);
  const grid = useRef(null);
  const picking = from && !to ? 'to' : 'from';
  useEffect(() => { grid.current?.querySelector('[data-focus="1"]')?.focus(); }, [focus]);
  const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const end = to || (picking === 'to' && hover && from && hover >= from ? hover : null);
  const key = (e) => {
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let n = null;
    if (map[e.key] !== undefined) n = addDays(focus, map[e.key]);
    else if (e.key === 'Home') n = startOfWeek(focus);
    else if (e.key === 'End') n = addDays(startOfWeek(focus), 6);
    else if (e.key === 'PageUp') n = addMonths(focus, e.shiftKey ? -12 : -1);
    else if (e.key === 'PageDown') n = addMonths(focus, e.shiftKey ? 12 : 1);
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (n) { e.preventDefault(); setFocus(n); }
  };
  return (
    <div className="dr-cal" role="dialog" aria-modal="false" aria-labelledby={labelledBy}>
      <div className="dr-cal__head">
        <button type="button" onClick={() => setFocus(addMonths(focus, -1))} aria-label="Previous month">‹</button>
        <strong aria-live="polite">{MONTHS[focus.getMonth()]} {focus.getFullYear()}</strong>
        <button type="button" onClick={() => setFocus(addMonths(focus, 1))} aria-label="Next month">›</button>
      </div>
      <p className="dr-cal__hint" aria-live="polite">{picking === 'from' ? 'Choose the From day' : 'Now choose the To day'}</p>
      <table className="dr-cal__grid" role="grid" ref={grid} onKeyDown={key}>
        <thead><tr>{DAYS.map((d) => <th key={d} scope="col" abbr={d}>{d}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: 6 }, (_, w) => (
            <tr key={w}>
              {cells.slice(w * 7, w * 7 + 7).map((d) => {
                const inMonth = d.getMonth() === focus.getMonth();
                const isFrom = sameDay(d, from); const isTo = sameDay(d, end);
                const inRange = from && end && d > from && d < end;
                return (
                  <td key={d.getTime()} role="gridcell" aria-selected={isFrom || isTo || !!inRange}>
                    <button type="button" tabIndex={sameDay(d, focus) ? 0 : -1} data-focus={sameDay(d, focus) ? '1' : undefined}
                      className={`dr-day${inMonth ? '' : ' is-out'}${isFrom ? ' is-from' : ''}${isTo ? ' is-to' : ''}${inRange ? ' is-in' : ''}${sameDay(d, today()) ? ' is-today' : ''}`}
                      aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}${isFrom ? ', From' : ''}${isTo ? ', To' : ''}`}
                      onMouseEnter={() => setHover(d)} onFocus={() => setHover(d)}
                      onClick={() => { setFocus(d); onPick(d, picking); }}>
                      {d.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dr-cal__foot"><button type="button" onClick={onClose}>Done</button></div>
    </div>
  );
}

export default function DateRange({ labels, from, to, onChange, errors = {} }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const btn = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);
  const f = parseDay(from); const t = parseDay(to);
  const pick = (d, which) => {
    if (which === 'from') onChange({ from: fmtDay(d), to: '' });
    else if (f && d < f) onChange({ from: fmtDay(d), to: '' });
    else { onChange({ from, to: fmtDay(d) }); setOpen(false); btn.current?.focus(); }
  };
  const field = (k, label, v) => (
    <div className={`dr-field${errors[k] ? ' is-bad' : ''}`}>
      <label htmlFor={`dr-${k}`}>{label} <span className="up-req" aria-hidden="true">*</span></label>
      <span className="dr-hint" id={`dr-${k}-hint`}>Use dd/mm/yyyy format</span>
      {errors[k] && <span className="dr-err" id={`dr-${k}-err`}>{errors[k]}</span>}
      <input id={`dr-${k}`} type="text" inputMode="numeric" autoComplete="off" value={v}
        aria-describedby={`dr-${k}-hint${errors[k] ? ` dr-${k}-err` : ''}`} aria-invalid={!!errors[k] || undefined}
        onChange={(e) => onChange({ from: k === 'from' ? e.target.value : from, to: k === 'to' ? e.target.value : to })} />
    </div>
  );
  return (
    <div className="dr" ref={wrap}>
      <div className="dr-row">
        {field('from', labels.from, from)}
        {field('to', labels.to, to)}
        <button ref={btn} type="button" className="dr-btn" aria-expanded={open} aria-controls="dr-cal" id="dr-cal-btn"
          aria-label={f && t ? `Choose dates from a calendar. Selected ${fmtDay(f)} to ${fmtDay(t)}` : 'Choose dates from a calendar'}
          onClick={() => setOpen(!open)}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        </button>
      </div>
      {open && <div id="dr-cal"><Calendar from={f} to={t} labelledBy="dr-cal-btn" onPick={pick} onClose={() => { setOpen(false); btn.current?.focus(); }} /></div>}
    </div>
  );
}
