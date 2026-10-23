import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../state.js';
import { NOTES, ACTIVE } from './notes.js';

const KEY = 'cevoc-explain';

// Finds the first on-page element for each note.
export function findTargets(root, notes = NOTES) {
  const out = [];
  for (const n of notes) {
    const els = Array.from(root.querySelectorAll(n.selector));
    const el = n.text ? els.find((e) => (e.textContent || '').includes(n.text)) : els[0];
    if (el) out.push({ note: n, el });
  }
  return out;
}

export function activeScenarios(demo = {}) {
  const a = [];
  if (demo.outage) a.push(ACTIVE.outage);
  if (demo.certOutage) a.push(ACTIVE.certOutage);
  if (demo.imageOutage) a.push(ACTIVE.imageOutage);
  if (demo.latency === 'slow') a.push(ACTIVE.slow);
  if (demo.latency === 'timeout') a.push(ACTIVE.timeout);
  if (demo.media === false) a.push(ACTIVE.noMedia);
  return a;
}

function NoteBody({ note }) {
  return (
    <div className="xp-note">
      <h3>{note.title}</h3>
      <p className="xp-why">{note.why}</p>
      {note.list && (
        <dl className="xp-list">
          {note.list.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <dl className="xp-meta">
        {note.who && (<div><dt>Who it’s for</dt><dd>{note.who}</dd></div>)}
        {note.principle && (<div><dt>Principle</dt><dd>{note.principle}</dd></div>)}
        {note.sad && (<div><dt>Traces to</dt><dd>{note.sad}</dd></div>)}
        {note.evidence && (<div><dt>Evidence</dt><dd>{note.evidence}</dd></div>)}
        {note.status && (<div><dt>Status</dt><dd>{note.status}</dd></div>)}
      </dl>
    </div>
  );
}

export default function ExplainLayer({ path }) {
  const app = useApp();
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch (e) {
      return false;
    }
  });
  const [targets, setTargets] = useState([]);
  const [rects, setRects] = useState([]);
  const [open, setOpen] = useState(null); // note id
  const [panel, setPanel] = useState(true);
  const frame = useRef(0);

  const toggle = useCallback(() => {
    setOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch (e) {
        /* ignore */
      }
      if (next) setPanel(true);
      return next;
    });
  }, []);

  // Keyboard: "?" toggles explain mode (not while typing).
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === '?') toggle();
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Track which notes are on the page and where.
  useEffect(() => {
    if (!on) {
      setTargets([]);
      setRects([]);
      return undefined;
    }
    const measure = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const found = findTargets(document);
        setTargets(found);
        setRects(found.map(({ el }) => el.getBoundingClientRect()));
      });
    };
    measure();
    const mo = new MutationObserver(measure);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'open'] });
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      mo.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(frame.current);
    };
  }, [on, path]);

  useEffect(() => setOpen(null), [path]);

  const scenarios = activeScenarios(app?.demo);
  const current = open && NOTES.find((n) => n.id === open);
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

  const jump = (id) => {
    setOpen(id);
    const t = targets.find((x) => x.note.id === id);
    if (t) t.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <>
      <button type="button" className={`xp-toggle ${on ? 'is-on' : ''}`} onClick={toggle} aria-pressed={on} title="Explain mode (press ?)">
        <span aria-hidden="true">ⓘ</span> {on ? 'Explain mode on' : 'Explain'}
      </button>

      {on && (
        <div className="xp-layer" aria-hidden="false">
          {targets.map(({ note }, i) => {
            const r = rects[i];
            if (!r || r.bottom < 0 || r.top > vh || r.width === 0) return null;
            const active = open === note.id;
            return (
              <React.Fragment key={note.id}>
                {active && <div className="xp-outline" style={{ top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 }} />}
                <button
                  type="button"
                  className={`xp-pin ${active ? 'is-on' : ''}`}
                  style={{ top: Math.max(r.top - 12, 4), left: Math.max(r.left - 12, 4) }}
                  onClick={() => {
                    setOpen(active ? null : note.id);
                    setPanel(true);
                  }}
                  aria-label={`Explain: ${note.title}`}
                >
                  {i + 1}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {on && panel && (
        <aside className="xp-drawer" aria-label="Explain mode">
          <header className="xp-drawer__head">
            <strong>Why is this here?</strong>
            <button type="button" className="xp-x" onClick={() => setPanel(false)} aria-label="Hide explain panel">×</button>
          </header>
          <p className="xp-hint">For people testing the prototype. Not part of the real service. Click a numbered pin, or pick from the list.</p>

          {scenarios.length > 0 && (
            <section className="xp-active">
              <h4>Scenarios switched on</h4>
              <ul>
                {scenarios.map(([t, d]) => (
                  <li key={t}><strong>{t}.</strong> {d}</li>
                ))}
              </ul>
            </section>
          )}

          {current ? (
            <>
              <NoteBody note={current} />
              <button type="button" className="xp-back" onClick={() => setOpen(null)}>← All notes on this page</button>
            </>
          ) : (
            <section>
              <h4>On this page ({targets.length})</h4>
              {targets.length === 0 ? (
                <p className="xp-hint">Nothing annotated here yet. Try a notice result or an officer workspace.</p>
              ) : (
                <ol className="xp-index">
                  {targets.map(({ note }, i) => (
                    <li key={note.id}>
                      <button type="button" onClick={() => jump(note.id)}>
                        <span className="xp-num">{i + 1}</span> {note.title}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          <footer className="xp-foot">
            <a href="#/studio/personas">Personas</a> · <a href="#/studio/resilience">When things break</a> · <a href="#/evidence-rules">Evidence rules</a>
          </footer>
        </aside>
      )}
      {on && !panel && (
        <button type="button" className="xp-reopen" onClick={() => setPanel(true)}>Show explain panel</button>
      )}
    </>
  );
}
