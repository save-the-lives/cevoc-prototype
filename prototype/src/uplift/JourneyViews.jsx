import '../styles/uplift-journey.css';
import { useEffect, useRef, useState } from 'react';
import { Link } from '../shared/ui.jsx';
import { ENTRY_LINK } from './data.js';
import { CevocMock, STEPS_A, STEPS_B } from './Entry.jsx';

// JOURNEY VIEWS (#/uplift/hub/journey): three ways to show the same current journeys, on tabs so the owner can
// compare them: a swimlane, a timeline with moods, and a card flow. Every step opens its recreated mock screen
// (the same mocks as Entry from the apps). Only the CEVOC page is uplifted; every other step is existing and
// unchanged. All values are invented.

const STAFF_LINK = '/uplift?locs=1234,4567&from=01%2F11%2F2025&to=30%2F06%2F2026&run=1';

// Who owns each step, the person's mood and what they are thinking. Index-aligned with STEPS_A / STEPS_B.
const A_META = [
  { lane: 'snsw', mood: 2, think: 'I got a letter about a fine. Where do I look?' },
  { lane: 'snsw', mood: 2, think: 'I’ll log in to see it.' },
  { lane: 'snsw', mood: 2, think: 'There it is: Fines.' },
  { lane: 'rnsw', mood: 2, think: 'Now I’m on Revenue NSW, without logging in again.' },
  { lane: 'rnsw', mood: 2, think: 'It’s an older fine, I’ll search for the number.' },
  { lane: 'rnsw', mood: 1, think: 'That’s the one. What actually happened?' },
  { lane: 'rnsw', mood: 1, think: 'I want to see the photos.' },
  { lane: 'rnsw', mood: 1, think: 'Was the camera even working?' },
];
const B_META = [
  { lane: 'rnsw', mood: 2, think: 'I got a letter. I’ll go to Revenue NSW.' },
  { lane: 'rnsw', mood: 2, think: 'I’ll type the notice number and date.' },
  { lane: 'rnsw', mood: 1, think: 'That’s a lot of money. What happened?' },
  { lane: 'rnsw', mood: 1, think: 'I have to type my rego to see the photos?' },
  { lane: 'rnsw', mood: 1, think: 'Was the camera even working?' },
];
const CEVOC = { t: 'CEVOC certificate page', url: 'cevoc.transport.nsw.gov.au', touch: 'Uplifted: the certificate in force on the day', cevoc: true, lane: 'cevoc', mood: 3, think: 'The camera was tested and certified. Now I can decide.', mock: <CevocMock /> };
const DECIDE = { t: 'Decides', url: 'back in the app', touch: 'Pay, request a review or elect court', lane: 'person', mood: 3, think: 'I know what to do next.', mock: null, decide: true };
const PERSON = { t: 'Letter arrives', url: 'penalty notice in the post', touch: 'Finds the notice in an app', lane: 'person', mood: 1, think: 'A fine? When was this?', mock: null };

const build = (steps, meta) => [PERSON, ...steps.map((s, i) => ({ ...s, ...meta[i] })), CEVOC, DECIDE];
const PATHS = {
  a: { title: 'A · Service NSW, logged in', steps: build(STEPS_A, A_META) },
  b: { title: 'B · myPenalty, no login', steps: build(STEPS_B, B_META) },
};
const STAFF = [
  { t: 'Customer asks', url: 'phone or review request', touch: 'Revenue NSW officer looks it up', lane: 'staff', mood: 2, think: 'Which camera, and was it certified?', mock: null },
  { t: 'Searches certificates', url: 'CEVOC certificate search', touch: 'Several locations, a date range', lane: 'cevoc', cevoc: true, mood: 2, think: 'Two cameras over these months.', mock: null, to: STAFF_LINK },
  { t: 'Expands a row', url: 'same page', touch: 'Details in place, gaps and withdrawn marked', lane: 'cevoc', cevoc: true, mood: 3, think: 'Certified, except one quarter that’s missing.', mock: null, to: STAFF_LINK },
  { t: 'Answers', url: 'call or reply', touch: 'Resolves or refers to Transport', lane: 'staff', mood: 3, think: 'Done.', mock: null },
];
const LANES = [
  ['person', 'Person with the fine'], ['snsw', 'Service NSW'], ['rnsw', 'Revenue NSW (fines.digital / myPenalty)'], ['cevoc', 'CEVOC (Transport)'],
];
const MOODS = ['', 'Worried', 'Unsure', 'Reassured'];

const Tag = ({ s }) => <span className={`jv-tag${s.cevoc ? ' is-up' : ''}`}>{s.cevoc ? 'Uplifted' : 'Existing, unchanged'}</span>;

function Icon({ lane }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (lane === 'person') return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>;
  if (lane === 'snsw') return <svg {...p}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></svg>;
  if (lane === 'rnsw') return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h8" /></svg>;
  if (lane === 'staff') return <svg {...p}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1" /><rect x="17" y="14" width="4" height="6" rx="1" /></svg>;
  return <svg {...p}><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /><path d="M9 12l2 2 4-4" /></svg>;
}

// The mock screen of the chosen step: a side panel on wide screens, below the view on phones. Escape closes it.
function Viewer({ step, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!step) return undefined;
    ref.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [step, onClose]);
  if (!step) return null;
  return (
    <aside className="jv-viewer" role="region" aria-label={`Screen: ${step.t}`} tabIndex={-1} ref={ref}>
      <header><strong>{step.t}</strong><button type="button" onClick={onClose} aria-label="Close screen">✕</button></header>
      <p className="jv-viewer__meta"><Tag s={step} /> <code>{step.url}</code></p>
      {step.mock || (
        <div className="jv-nomock">
          {step.decide ? <p>Back in the Service NSW app or myPenalty: pay, request a review or elect to have it decided by a court. Unchanged.</p>
            : step.to ? <p>This is the live CEVOC search screen.</p> : <p>No screen: this step happens outside any website.</p>}
        </div>
      )}
      {step.to && <Link to={step.to} className="jv-go">Open the search screen ↗</Link>}
      {step.cevoc && !step.to && <Link to={ENTRY_LINK} className="jv-go">Open the uplifted page ↗</Link>}
      <p className="jv-viewer__touch"><strong>Touch point:</strong> {step.touch}</p>
    </aside>
  );
}

function StepButton({ s, n, active, onPick, className = '' }) {
  return (
    <button type="button" className={`jv-step ${className}${s.cevoc ? ' is-cevoc' : ''}${active ? ' is-active' : ''}`} aria-pressed={active} onClick={onPick}>
      {n !== undefined && <span className="jv-n">{n}</span>}
      <span className="jv-step__t">{s.t}</span>
      <Tag s={s} />
    </button>
  );
}

function Swimlane({ pick, active }) {
  return (
    <div className="jv-swim">
      {['a', 'b'].map((k) => {
        const steps = PATHS[k].steps;
        return (
          <section key={k} className="jv-swim__path" aria-label={PATHS[k].title}>
            <h3>{PATHS[k].title}</h3>
            <div className="jv-swim__scroll">
              <div className="jv-swim__grid" style={{ gridTemplateColumns: `150px repeat(${steps.length}, 158px)` }}>
                {LANES.map(([lane, label], r) => (
                  <div key={lane} className="jv-swim__row" style={{ display: 'contents' }}>
                    <div className={`jv-swim__lane is-${lane}`} style={{ gridRow: r + 1 }}><Icon lane={lane} /> {label}</div>
                    {steps.map((s, i) => (
                      <div key={s.t + i} className={`jv-swim__cell${s.lane === lane ? ' has-step' : ''}`} style={{ gridRow: r + 1, gridColumn: i + 2 }}>
                        {s.lane === lane && <StepButton s={s} n={i + 1} active={active === s} onPick={() => pick(s)} className="is-swim" />}
                        {s.lane === lane && i < steps.length - 1 && <span className="jv-arrow" aria-hidden="true">→</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
      <section className="jv-swim__path" aria-label="Staff">
        <h3>Staff · Revenue NSW officer</h3>
        <ol className="jv-staff">{STAFF.map((s, i) => <li key={s.t}><StepButton s={s} n={i + 1} active={active === s} onPick={() => pick(s)} /></li>)}</ol>
      </section>
    </div>
  );
}

function Timeline({ pick, active }) {
  const [path, setPath] = useState('a');
  const steps = path === 'staff' ? STAFF : PATHS[path].steps;
  const W = 100 / Math.max(1, steps.length - 1);
  const pts = steps.map((s, i) => `${i * W},${(3 - s.mood) * 30 + 10}`).join(' ');
  return (
    <div className="jv-time">
      <div className="seg2 uh-seg" role="group" aria-label="Path">
        {[['a', 'A · Service NSW'], ['b', 'B · myPenalty'], ['staff', 'Staff']].map(([k, t]) => <button key={k} type="button" aria-pressed={path === k} onClick={() => setPath(k)}>{t}</button>)}
      </div>
      <div className="jv-time__scroll">
        <div className="jv-time__inner" style={{ minWidth: steps.length * 120 }}>
          <svg className="jv-mood" viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true" style={{ left: `${50 / steps.length}%`, width: `${100 - 100 / steps.length}%` }}>
            <polyline points={pts} fill="none" stroke="#0f766e" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <ol className="jv-time__steps" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
            {steps.map((s, i) => (
              <li key={s.t + i}>
                <span className={`jv-mood__dot is-m${s.mood}`} style={{ top: (3 - s.mood) * 30 + 3 }} title={MOODS[s.mood]} />
                <button type="button" className={`jv-tl${s.cevoc ? ' is-cevoc' : ''}${active === s ? ' is-active' : ''}`} aria-pressed={active === s} onClick={() => pick(s)}>
                  <span className={`jv-tl__icon is-${s.lane}`}><Icon lane={s.lane} /></span>
                  <span className="jv-n">{i + 1}</span>
                  <strong>{s.t}</strong>
                  <small>{MOODS[s.mood]}</small>
                  <Tag s={s} />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="jv-legend">The line is the person’s mood: worried → unsure → reassured. It lifts only at the CEVOC page.</p>
    </div>
  );
}

function Cards({ pick, active }) {
  const [path, setPath] = useState('a');
  const steps = path === 'staff' ? STAFF : PATHS[path].steps;
  return (
    <div className="jv-cards">
      <div className="seg2 uh-seg" role="group" aria-label="Path">
        {[['a', 'A · Service NSW'], ['b', 'B · myPenalty'], ['staff', 'Staff']].map(([k, t]) => <button key={k} type="button" aria-pressed={path === k} onClick={() => setPath(k)}>{t}</button>)}
      </div>
      <ol className="jv-cards__list">
        {steps.map((s, i) => (
          <li key={s.t + i}>
            <button type="button" className={`jv-card${s.cevoc ? ' is-cevoc' : ''}${active === s ? ' is-active' : ''}`} aria-pressed={active === s} onClick={() => pick(s)}>
              <span className="jv-card__top"><span className={`jv-tl__icon is-${s.lane}`}><Icon lane={s.lane} /></span><span className="jv-n">{i + 1}</span><Tag s={s} /></span>
              <strong className="jv-card__t">{s.t}</strong>
              <span className="jv-card__think">“{s.think}”</span>
              <span className="jv-card__touch">Touch point: {s.touch}</span>
              <span className="jv-card__more">{s.mock || s.to ? 'Show the screen' : 'Show details'}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

const VIEWS = [['swim', 'Swimlane'], ['time', 'Timeline with moods'], ['cards', 'Card flow']];

export default function JourneyViews() {
  const [view, setView] = useState('swim');
  const [active, setActive] = useState(null);
  const refs = useRef({});
  const key = (e, i) => {
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? VIEWS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const k = VIEWS[(n + VIEWS.length) % VIEWS.length][0];
    setView(k); setActive(null); refs.current[k]?.focus();
  };
  const pick = (s) => setActive((a) => (a === s ? null : s));
  return (
    <div className="jv">
      <div role="tablist" aria-label="Journey view" className="jv-tabs">
        {VIEWS.map(([k, t], i) => (
          <button key={k} ref={(el) => { refs.current[k] = el; }} type="button" role="tab" id={`jv-tab-${k}`} aria-selected={view === k} aria-controls="jv-panel" tabIndex={view === k ? 0 : -1}
            onClick={() => { setView(k); setActive(null); }} onKeyDown={(e) => key(e, i)}>{t}</button>
        ))}
      </div>
      <p className="jv-hint">Select any step to see its screen. Only the CEVOC page changes; every other step stays as it is. All values are invented.</p>
      <div className={`jv-body${active ? ' has-viewer' : ''}`}>
        <div role="tabpanel" id="jv-panel" aria-labelledby={`jv-tab-${view}`} className="jv-panel">
          {view === 'swim' && <Swimlane pick={pick} active={active} />}
          {view === 'time' && <Timeline pick={pick} active={active} />}
          {view === 'cards' && <Cards pick={pick} active={active} />}
        </div>
        <Viewer step={active} onClose={() => setActive(null)} />
      </div>
    </div>
  );
}
