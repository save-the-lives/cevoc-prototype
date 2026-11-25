import '../styles/uplift.css';
import { useEffect, useRef, useState } from 'react';
import { Link } from '../shared/ui.jsx';
import { LABELS, OPEN, qById, questionsFor, storiesFor, storyReady } from './data.js';

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

// The amber prototype bar under the header: what this is, the label switch, links back to the hub.
export function ProtoBar({ children }) {
  return (
    <div className="uh-bar">
      <div className="pub-wrap uh-bar__in">
        <span className="uh-bar__what">Prototype · phase 1 certificate uplift · sample data only</span>
        {children}
        <LabelSwitch />
        <Link to="/uplift/hub" className="uh-bar__hub">Uplift hub</Link>
      </div>
    </div>
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

// Bottom bar on each screen: stories and questions that govern it, in a drawer.
export function StoriesBar({ screen }) {
  const [open, setOpen] = useState(false);
  const list = storiesFor(screen);
  const qs = questionsFor(screen);
  return (
    <>
      <nav className="uh-foot" aria-label="Prototype companion">
        <button type="button" onClick={() => setOpen(true)}>Stories for this screen ({list.length})</button>
        <Link to={`/uplift/hub/questions?screen=${screen}`}>Questions for this screen ({qs.filter(OPEN).length} open)</Link>
        <Link to="/uplift/hub">Uplift hub</Link>
      </nav>
      {open && (
        <div className="uh-drawer" role="dialog" aria-modal="true" aria-labelledby="uh-drawer-h">
          <div className="uh-drawer__in">
            <header><h2 id="uh-drawer-h">Stories for this screen</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close">✕</button></header>
            {list.map((s) => (
              <article key={s.id} className="uh-story">
                <p><strong>{s.id}</strong> <span className={`uh-tag ${storyReady(s) ? 'is-done' : 'is-open'}`}>{storyReady(s) ? 'Ready for dev' : 'Not ready'}</span></p>
                <p>As a {s.role}, I want to {s.want}, so {s.so}.</p>
                {s.qs.length > 0 && <p className="uh-story__qs">Questions: {s.qs.map((id) => <Q key={id} id={id} />)}</p>}
                <Link to={`/uplift/hub/stories?s=${s.id}`}>Acceptance criteria</Link>
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export const HUB_TABS = [
  ['', 'Hub'], ['journey', 'Journey'], ['entry', 'Entry from the apps'], ['compare', 'Legacy and target'],
  ['fields', 'Field delta'], ['stories', 'Stories'], ['questions', 'Questions'],
];
