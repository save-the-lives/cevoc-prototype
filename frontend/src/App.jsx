import { useCallback, useEffect, useRef, useState } from 'react';
import { LookupError, lookupPenalty, mockEnabled } from './api.js';
import LookupForm from './LookupForm.jsx';
import Notice from './Notice.jsx';
import { HELP_PHONE, classify } from './journey.js';
import './styles.css';
import './public.css';

const TITLE = 'Check your camera fine evidence';

// The journey is one page with two views: the form, and the notice. The notice number, date and number plate
// are never put in the address bar, in storage or in a log. The plate is held only while the request is sent.
export default function App() {
  const [view, setView] = useState({ name: 'form', outcome: null, misses: 0 });
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null); // { result, query, registrationGiven }
  const headingRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = view.name === 'notice' ? `What happened | ${TITLE}` : TITLE;
    if (firstRender.current) { firstRender.current = false; return; }
    // move focus to the new page heading so keyboard and screen reader users start in the right place
    if (view.name === 'notice') headingRef.current?.focus({ preventScroll: false });
    else document.getElementById('hero-h')?.focus({ preventScroll: true });
  }, [view.name]);

  // the browser Back button returns to the form instead of leaving the site
  useEffect(() => {
    const onPop = () => { setFound(null); setView((v) => ({ ...v, name: 'form', outcome: null })); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const run = useCallback(async (query, registration) => {
    setBusy(true);
    let outcome;
    try {
      const result = await lookupPenalty({ ...query, registration });
      outcome = { kind: classify(result), result };
    } catch (err) {
      outcome = { kind: err instanceof LookupError && err.kind === 'invalid' ? 'not-found' : 'unavailable' };
    }
    setBusy(false);
    return outcome;
  }, []);

  const submit = async (query) => {
    const registrationGiven = !!query.registration;
    const out = await run({ infringementNumber: query.infringementNumber, offenceDate: query.offenceDate }, query.registration);
    if (out.kind === 'found') {
      setFound({ result: out.result, query: { infringementNumber: query.infringementNumber, offenceDate: query.offenceDate }, registrationGiven });
      window.history.pushState({ notice: true }, '');
      window.scrollTo(0, 0);
      setView({ name: 'notice', outcome: null, misses: 0 });
    } else {
      setView((v) => ({ name: 'form', outcome: out.kind, misses: out.kind === 'not-found' ? v.misses + 1 : v.misses }));
    }
  };

  const retryWithPlate = async (registration) => {
    const out = await run(found.query, registration);
    if (out.kind === 'found') setFound((f) => ({ ...f, result: out.result, registrationGiven: true }));
    else setView({ name: 'form', outcome: out.kind, misses: 0 });
  };

  const startAgain = () => {
    if (window.history.state?.notice) window.history.back(); else { setFound(null); setView({ name: 'form', outcome: null, misses: 0 }); }
  };

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="masthead"><div className="wrap">NSW Government</div></div>
      <header className="site-head"><div className="wrap"><p className="sitename">Road safety enforcement</p></div></header>
      <main id="main" tabIndex={-1}>
        {view.name === 'notice' && found
          ? <Notice result={found.result} registrationGiven={found.registrationGiven} onPlate={retryWithPlate} plateBusy={busy} onStartAgain={startAgain} headingRef={headingRef} />
          : <LookupForm busy={busy} outcome={view.outcome} misses={view.misses} onSubmit={submit}
            scenarios={mockEnabled ? SCENARIOS : null} onPickDefaultDate={() => '2026-03-14'} />}
      </main>
      <footer className="site-foot"><div className="wrap foot-in">
        <span>Need help? Call {HELP_PHONE}</span>
        <span>Prototype service</span>
      </div></footer>
    </>
  );
}

const SCENARIOS = [
  ['9000000001', 'Speed camera'], ['9000000004', 'Plate needed'], ['9000000005', 'Evidence not yet available'],
  ['9000000002', 'Officer caution'], ['9000000006', 'Not found'], ['9000000007', 'Unavailable'],
].map(([number, label]) => ({ number, label }));
