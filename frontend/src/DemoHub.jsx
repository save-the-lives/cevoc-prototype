import { useEffect, useState } from 'react';
import App from './App.jsx';
import DemoTag from './DemoBanner.jsx';
import { fetchDemoCases } from './api.js';
import { INFO_LABELS, demoContentUnavailable, spacedNumber, statusMark } from './demoHub.js';
import './styles.css';
import './public.css';
import './demo.css';

function CopyNumber({ number }) {
  const [state, setState] = useState('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(number);
      setState('done');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2500);
  };
  return (
    <>
      <button type="button" className="btn demo-copy" onClick={copy}>
        {state === 'done' ? 'Copied' : 'Copy number'}<span className="sr-only"> {number}</span>
      </button>
      <span className="sr-only" role="status">{state === 'done' ? `Copied ${number}` : state === 'failed' ? 'Could not copy. Select the number and copy it.' : ''}</span>
    </>
  );
}

function CaseCard({ c }) {
  return (
    <li className="demo-case" id={`case-${c.number}`}>
      <div className="demo-case-head">
        <p className="demo-number"><span className="sr-only">Number </span><code>{c.number}</code></p>
        <CopyNumber number={c.number} />
      </div>
      <h4 className="demo-case-title">{c.title}</h4>
      <p className="demo-case-desc">{c.description}</p>
      <dl className="demo-status">
        {INFO_LABELS.map(([key, label]) => (
          <div key={key} className={`demo-chip is-${c.transparency?.[key] || 'unknown'}`}>
            <dt>{label}</dt>
            <dd><span aria-hidden="true" className="demo-mark">{statusMark(c.transparency?.[key])}</span> {c.transparencyText?.[key] || 'Unknown'}</dd>
          </div>
        ))}
      </dl>
      {c.plate && <p className="demo-plate">Vehicle registration number to type when asked: <code>{c.plate}</code>. Any other registration shows the refusal.</p>}
      <p className="demo-open">
        <a className="btn primary" href={`/?demo=${c.number}`}>Open this case<span className="sr-only"> {c.number}: {c.title}</span></a>
      </p>
    </li>
  );
}

function ProgramBlock({ p }) {
  const id = `program-${p.prefix}`;
  return (
    <section className="demo-program" aria-labelledby={`${id}-h`} id={id}>
      <h2 id={`${id}-h`}>
        <code>{p.prefix}</code> {p.label}
        {!p.built && <span className="demo-tag">Not built yet</span>}
      </h2>
      {!p.built ? (
        <p className="notice-box" role="note">{p.note} Numbers starting {p.prefix} are not demo numbers yet.</p>
      ) : p.groups.map((g) => (
        <section key={g.kind} aria-labelledby={`${id}-${g.kind}-h`} className="demo-group">
          <h3 id={`${id}-${g.kind}-h`}>{g.title} <span className="demo-range">sequence {g.range}</span></h3>
          {g.cases.length === 0 ? <p className="muted">No listed cases.</p> : <ul className="demo-cases">{g.cases.map((c) => <CaseCard key={c.number} c={c} />)}</ul>}
        </section>
      ))}
    </section>
  );
}

/** The demo hub. With demo data off the list does not exist: the page then behaves like any unknown page and shows the normal app. */
export default function DemoHub() {
  const [catalog, setCatalog] = useState(undefined); // undefined = loading, null = not available
  useEffect(() => {
    let live = true;
    fetchDemoCases().then((c) => { if (live) setCatalog(c); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (catalog) document.title = 'Demo cases | See what the camera recorded';
  }, [catalog]);
  if (catalog === undefined) return null;
  if (catalog === null) return <App />;
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="masthead"><div className="wrap">NSW Government<DemoTag /></div></div>
      <header className="site-head"><div className="wrap"><p className="sitename">Road safety enforcement</p></div></header>
      <main id="main" tabIndex={-1}>
        <div className="wrap page-body demo-hub">
          <h1>Demo cases</h1>
          {demoContentUnavailable(catalog) ? (
            <p className="notice-box" role="status">{catalog.notice} Demo cases cannot be opened until it is back.</p>
          ) : (
          <>
          <p className="lede">{catalog.notice} Pick a case to open it in the real result page, or copy its number into the lookup form (any offence date; each case carries its own).</p>
          <nav aria-label="Programs" className="demo-jump">
            <ul>{catalog.programs.map((p) => <li key={p.prefix}><a href={`#program-${p.prefix}`}>{p.label}{p.built ? '' : ' (not built yet)'}</a></li>)}</ul>
          </nav>
          {catalog.programs.map((p) => <ProgramBlock key={p.prefix} p={p} />)}
          </>
          )}
        </div>
      </main>
      <footer className="site-foot"><div className="wrap foot-in"><span>(working prototype)</span><a href="/">Back to the lookup</a></div></footer>
    </>
  );
}
