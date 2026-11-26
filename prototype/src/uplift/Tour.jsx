import { useEffect, useLayoutEffect, useState } from 'react';
import { Link } from '../shared/ui.jsx';
import { OPEN, isBacklog, qById, questionsFor, storiesFor, storyReady } from './data.js';
import { COPY, COPY_KEYS, NOTES } from './tour.js';
import { LabelSwitch } from './kit.jsx';

// GUIDED-TOUR OVERLAY (owner, 25 Nov 2026). The screens look exactly as a real user would see them. One small
// floating "Tour" control switches on an overlay: numbered pins on each area of the page (legacy versus new name,
// stories, open questions), and a side panel with the reviewer's controls (labels, samples, highlight dynamic data,
// copy variants, stories and questions for this screen). Off by default; Escape closes it; turning it off leaves
// the page untouched. Same spirit as enf-site-onboarding's annotation layer.

const state = { on: false, dyn: false, copy: 'legacy' };
const subs = new Set();
const set = (patch) => { Object.assign(state, patch); subs.forEach((f) => f({ ...state })); };
try { if (/[?&]tour=1/.test(window.location.hash)) state.on = true; } catch { /* no window */ }

export function useTour() {
  const [s, setS] = useState({ ...state });
  useEffect(() => { subs.add(setS); return () => subs.delete(setS); }, []);
  return { ...s, set };
}

function usePins(screen, on) {
  const [pins, setPins] = useState([]);
  useLayoutEffect(() => {
    if (!on) { setPins([]); return undefined; }
    const measure = () => setPins((NOTES[screen] || []).map((n, i) => {
      const el = document.querySelector(`[data-tour="${n.key}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return { ...n, n: i + 1, top: r.top + window.scrollY, left: r.left + window.scrollX, w: r.width, h: r.height };
    }).filter(Boolean));
    measure();
    const t = setInterval(measure, 500);
    window.addEventListener('resize', measure);
    return () => { clearInterval(t); window.removeEventListener('resize', measure); };
  }, [screen, on]);
  return pins;
}

function NoteBody({ n }) {
  return (
    <>
      <dl className="tr-note">
        <dt>Legacy</dt><dd>{n.legacy}</dd>
        <dt>Target</dt><dd>{n.next}</dd>
      </dl>
      <p className="tr-k">Stories</p>
      <ul className="tr-list">{n.stories.map((id) => <li key={id}><Link to={`/uplift/hub/stories?s=${id}`}>{id}</Link></li>)}</ul>
      <p className="tr-k">Open questions here</p>
      <ul className="tr-list">{n.qs.map((id) => {
        const q = qById(id);
        return q ? <li key={id}><Link to={`/uplift/hub/questions?q=${id}`}>{id}</Link> {q.topic} <span className={`uh-tag ${OPEN(q) ? 'is-open' : 'is-done'}`}>{OPEN(q) ? 'Open' : q.status}</span></li> : null;
      })}</ul>
    </>
  );
}

export default function TourLayer({ screen, controls }) {
  const t = useTour();
  const pins = usePins(screen, t.on);
  const [active, setActive] = useState(null);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') { if (active) setActive(null); else if (state.on) set({ on: false }); } };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [active]);
  useEffect(() => {
    document.body.classList.toggle('tr-dyn', t.on && t.dyn);
    return () => document.body.classList.remove('tr-dyn');
  }, [t.on, t.dyn]);
  // Auto-hide (owner, 26 Nov 2026): the panel folds to a small tab at the edge so it never covers the content.
  // It folds 4 s after the tour starts, or at once when the person clicks or scrolls the page outside the panel.
  // Clicking the tab opens it again; it then stays open until the next click or scroll outside it.
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    if (!t.on) { setFolded(false); return undefined; }
    const timer = setTimeout(() => setFolded(true), 4000);
    return () => clearTimeout(timer);
  }, [t.on]);
  useEffect(() => {
    if (!t.on || folded) return undefined;
    const outside = (e) => { if (!e.target.closest?.('.tr-panel, .tr-tab, .tr-fab')) setFolded(true); };
    const onScroll = () => setFolded(true);
    let armed = false;                       // ignore the scroll a click on "On this screen" makes, until it settles
    const arm = setTimeout(() => { armed = true; }, 300);
    const scroll = () => { if (armed) onScroll(); };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', scroll, { passive: true });
    return () => { clearTimeout(arm); document.removeEventListener('pointerdown', outside, true); window.removeEventListener('scroll', scroll); };
  }, [t.on, folded]);
  const stories = storiesFor(screen);
  const qs = questionsFor(screen);
  const note = pins.find((p) => p.key === active);

  return (
    <>
      <button type="button" className={`tr-fab${t.on && !folded ? ' is-on' : ''}`} aria-pressed={t.on} onClick={() => { set({ on: !t.on }); setActive(null); }}>
        {t.on ? 'Close tour' : 'Tour'}
      </button>
      {t.on && (
        <>
          <div className="tr-pins" aria-hidden={false}>
            {pins.map((p) => (
              <div key={p.key}>
                <div className={`tr-box${active === p.key ? ' is-active' : ''}`} style={{ top: p.top - 4, left: p.left - 4, width: p.w + 8, height: p.h + 8 }} />
                <button type="button" className={`tr-pin${active === p.key ? ' is-active' : ''}`} style={{ top: p.top - 14, left: p.left - 14 }}
                  aria-expanded={active === p.key} aria-label={`Note ${p.n}: ${p.title}`} onClick={() => setActive(active === p.key ? null : p.key)}>{p.n}</button>
              </div>
            ))}
            {note && (
              <div className="tr-pop" role="dialog" aria-label={note.title} style={{ top: note.top + 18, left: Math.max(8, Math.min(note.left + 14, window.innerWidth - 380)) }}>
                <header><strong>{note.n}. {note.title}</strong><button type="button" aria-label="Close note" onClick={() => setActive(null)}>✕</button></header>
                <NoteBody n={note} />
              </div>
            )}
          </div>
          {folded && (
            <button type="button" className="tr-tab" aria-expanded="false" aria-controls="tr-panel" onClick={() => setFolded(false)}>
              <span aria-hidden="true">‹</span> Tour panel
            </button>
          )}
          <aside id="tr-panel" className="tr-panel" aria-label="Prototype tour" hidden={folded}>
            <header><h2>Tour</h2><span><button type="button" aria-label="Hide panel" title="Hide panel (pins stay)" onClick={() => setFolded(true)}>›</button><button type="button" aria-label="Close tour" onClick={() => set({ on: false })}>✕</button></span></header>
            <p className="tr-meta">Prototype only. The page itself is exactly what a user would see. All data is invented.</p>
            <section><h3>Labels</h3><LabelSwitch /></section>
            {controls}
            {screen === 'record' && (
              <>
                <section>
                  <h3>Content</h3>
                  <label className="tr-check"><input type="checkbox" checked={t.dyn} onChange={(e) => set({ dyn: e.target.checked })} /> Highlight dynamic data</label>
                  <p className="tr-meta">Outlines every value that comes from the link or CMCS, with its source. Everything else is static copy. <Link to="/uplift/hub/content">Page content analysis</Link></p>
                </section>
                <section>
                  <h3>Copy to test</h3>
                  <fieldset className="tr-copy">
                    <legend className="up-sr">Copy variant</legend>
                    {COPY_KEYS.map((k) => (
                      <label key={k}>
                        <input type="radio" name="tr-copy" checked={t.copy === k} onChange={() => set({ copy: k })} />
                        <span><strong>{COPY[k].label}</strong><small>{COPY[k].worry}</small></span>
                      </label>
                    ))}
                  </fieldset>
                </section>
              </>
            )}
            <section>
              <h3>On this screen</h3>
              <ol className="tr-index">{pins.map((p) => <li key={p.key}><button type="button" onClick={() => { setActive(p.key); window.scrollTo({ top: Math.max(0, p.top - 120), behavior: 'smooth' }); }}>{p.title}</button></li>)}</ol>
            </section>
            <section>
              <h3>Stories ({stories.length})</h3>
              <ul className="tr-list">{stories.map((s) => <li key={s.id}><Link to={`/uplift/hub/stories?s=${s.id}`}>{s.id}</Link> {s.want} <span className={`uh-tag ${isBacklog(s) || storyReady(s) ? 'is-done' : 'is-open'}`}>{isBacklog(s) ? 'Backlog (Phase 2)' : storyReady(s) ? 'Ready' : 'Not ready'}</span></li>)}</ul>
            </section>
            <section>
              <h3>Questions ({qs.filter(OPEN).length} open)</h3>
              <ul className="tr-list">{qs.map((q) => <li key={q.id}><Link to={`/uplift/hub/questions?q=${q.id}`}>{q.id}</Link> {q.topic}</li>)}</ul>
            </section>
            <p><Link to="/uplift/hub">Certificate uplift hub</Link></p>
          </aside>
        </>
      )}
    </>
  );
}
