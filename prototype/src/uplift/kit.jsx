import '../styles/uplift.css';
import '../styles/uplift-dyn.css';
import { useEffect, useRef, useState } from 'react';
import { Link } from '../shared/ui.jsx';
import { LABELS, OPEN, qById } from './data.js';

// Shared pieces of the certificate uplift hub: the label switch, in-context question badges, the
// "Stories for this screen" bar and the hub tabs. Modelled on enf-site-onboarding's companion layer.

const KEY = 'cevoc.uplift.labels';
const read = () => { try { return localStorage.getItem(KEY) === 'legacy' ? 'legacy' : 'next'; } catch { return 'next'; } };
const subs = new Set();
let mode = read();

export function useLabels() {
  const [m, setM] = useState(mode);
  useEffect(() => { subs.add(setM); return () => subs.delete(setM); }, []);
  return { mode: m, L: LABELS[m], setMode: (v) => { mode = v; try { localStorage.setItem(KEY, v); } catch { /* per-viewer convenience only */ } subs.forEach((f) => f(v)); } };
}

export function LabelSwitch() {
  const { mode: m, setMode } = useLabels();
  return (
    <fieldset className="uh-switch">
      <legend>Show labels</legend>
      {[['legacy', 'Legacy names'], ['next', 'New names']].map(([v, t]) => (
        <label key={v}><input type="radio" name="uh-labels" value={v} checked={m === v} onChange={() => setMode(v)} /> {t}</label>
      ))}
    </fieldset>
  );
}

// A blue ? next to the thing it concerns. Opens a small popover with the question.
export function Q({ id }) {
  const q = qById(id);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!q) return null;
  return (
    <span className="uh-q" ref={ref}>
      <button type="button" className={`uh-q__b${OPEN(q) ? '' : ' is-settled'}`} aria-expanded={open} aria-label={`Question ${q.id}: ${q.topic}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}>?</button>
      {open && (
        <span className="uh-q__pop" role="dialog" aria-label={`Question ${q.id}`}>
          <span className="uh-q__h"><strong>{q.id}</strong> <span className={`uh-tag ${OPEN(q) ? 'is-open' : 'is-done'}`}>{q.status}</span></span>
          <strong className="uh-q__t">{q.q}</strong>
          <span className="uh-q__k">Why it matters</span><span>{q.why}</span>
          <span className="uh-q__k">Current assumption</span><span>{q.assume}</span>
          <span className="uh-q__k">Who can answer</span><span>{q.who}</span>
          <Link to={`/uplift/hub/questions?q=${q.id}`} className="uh-q__more">See in the questions index</Link>
        </span>
      )}
    </span>
  );
}

export const HUB_TABS = [
  ['', 'Hub'], ['journey', 'Journey'], ['entry', 'Entry from the apps'], ['compare', 'Legacy and target'], ['content', 'Page content'],
  ['fields', 'Field delta'], ['lifecycle', 'Lifecycle'], ['settings', 'App settings'], ['adr', 'ADRs'], ['stories', 'Stories'], ['questions', 'Questions'],
];

// A value that comes from data or from the signed link (not fixed wording). The Tour's "Highlight dynamic data"
// outlines it with its source; otherwise it renders as plain text. Every such value on the record page and the
// staff search is wrapped, and listed in tour.js DYNAMIC (owner audit, 26 Nov 2026).
// isNew marks a value or label that is NEW against the legacy page (not on it today, built in phase 1): the Tour shows
// it in green with a "New" label, so it differs from dynamic data the legacy page already had. Nothing changes on the
// real screen: the attribute only matters under the Tour's body classes (owner, 26 Nov 2026).
export function Dyn({ src, isNew, children }) {
  return <span className="tr-dynv" data-dyn={src} data-new={isNew ? 'New' : undefined}>{children}</span>;
}
// A static label that is new against the legacy page; same Tour-only marking as Dyn isNew.
export function NewMark({ as: Tag = 'span', children, ...rest }) {
  return <Tag data-new="New" {...rest}>{children}</Tag>;
}
