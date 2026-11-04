import { useCallback, useEffect, useRef, useState } from 'react';
import { LookupError, mockEnabled, streamLookup } from './api.js';
import { applyEvent, initialLookup, restartSections, toResult } from './lookupState.js';
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
  const [found, setFound] = useState(null); // { query, registrationGiven }
  const [live, setLive] = useState(null); // the progressive state of the lookup, see lookupState.js
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
    const onPop = () => { abortRef.current?.abort(); setBusy(false); setFound(null); setView((v) => ({ ...v, name: 'form', outcome: null })); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // One lookup is one streamed request. Each event updates `live`; the notice page opens as soon as the details arrive
  // and its other sections show their own loading state until their events come.
  const abortRef = useRef(null);
  const liveRef = useRef(null);

  const cancel = () => { abortRef.current?.abort(); abortRef.current = null; };
  useEffect(() => cancel, []);

  const stream = useCallback(async (query, registration, { onFirst, onFail }) => {
    cancel();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    let first = true;
    const take = (name, data) => {
      if (controller.signal.aborted) return;
      liveRef.current = applyEvent(liveRef.current, name, data);
      setLive(liveRef.current);
      if (name === 'details' && first) {
        first = false;
        const kind = classify(toResult(liveRef.current));
        if (kind === 'found') onFirst();
        else onFail(kind);
      }
    };
    try {
      await streamLookup({ ...query, registration }, take, controller.signal);
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (first) { first = false; onFail(err instanceof LookupError && err.kind === 'invalid' ? 'not-found' : 'unavailable'); }
      else take('error', { cause: 'network' });
    }
    if (first && !controller.signal.aborted) { first = false; onFail('unavailable'); } // the stream ended without the notice details
    if (abortRef.current === controller) { abortRef.current = null; setBusy(false); }
  }, []);

  const submit = async (query) => {
    const plain = { infringementNumber: query.infringementNumber, offenceDate: query.offenceDate };
    const registrationGiven = !!query.registration;
    liveRef.current = initialLookup();
    setLive(liveRef.current);
    await stream(plain, query.registration, {
      onFirst: () => {
        setFound({ query: plain, registrationGiven });
        window.history.pushState({ notice: true }, '');
        window.scrollTo(0, 0);
        setView({ name: 'notice', outcome: null, misses: 0 });
      },
      onFail: (kind) => setView((v) => ({ name: 'form', outcome: kind, misses: kind === 'not-found' ? v.misses + 1 : v.misses })),
    });
  };

  // The registration is asked for inline on the notice page and sent with a fresh request: it is held only for that call.
  const retryWithPlate = async (registration) => {
    liveRef.current = restartSections(liveRef.current);
    setLive(liveRef.current);
    setFound((f) => ({ ...f, registrationGiven: true }));
    await stream(found.query, registration, {
      onFirst: () => {},
      onFail: (kind) => setView({ name: 'form', outcome: kind, misses: 0 }),
    });
  };

  const startAgain = () => {
    cancel(); setBusy(false);
    if (window.history.state?.notice) window.history.back(); else { setFound(null); setView({ name: 'form', outcome: null, misses: 0 }); }
  };

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="masthead"><div className="wrap">NSW Government</div></div>
      <header className="site-head"><div className="wrap"><p className="sitename">Road safety enforcement</p></div></header>
      <main id="main" tabIndex={-1}>
        {view.name === 'notice' && found && live?.details
          ? <Notice result={toResult(live)} sections={{ evidence: live.evidence.state, certificates: live.certificates.state }}
            registrationGiven={found.registrationGiven} onPlate={retryWithPlate} plateBusy={busy} onStartAgain={startAgain} headingRef={headingRef} />
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
