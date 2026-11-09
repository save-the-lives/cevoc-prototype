import { useCallback, useEffect, useRef, useState } from 'react';
import { LookupError, fetchDemoCases, mockEnabled, streamLookup } from './api.js';
import DemoTag from './DemoBanner.jsx';
import { demoCaseParam, findCase } from './demoHub.js';
import { applyEvent, initialLookup, restartSections, toResult } from './lookupState.js';
import LookupForm from './LookupForm.jsx';
import { draftFromQuery } from './lookupValidation.js';
import Notice from './Notice.jsx';
import { HELP_PHONE, classify } from './journey.js';
import './styles.css';
import './public.css';

const TITLE = 'Understanding your road safety camera fine';

// The journey is one page with two views: the form, and the notice. The notice number, date and vehicle registration number
// are never put in the address bar or in a log. The query is held in sessionStorage (per-tab, cleared on tab
// close) so that a browser refresh re-runs the lookup instead of losing the user's place.
const SESSION_KEY = 'cevoc_q';
const saveSession = (query, registration) => { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ query, registration })); } catch {} };
const clearSession = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch {} };
const loadSession = () => { try { const s = sessionStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
export default function App() {
  const [view, setView] = useState({ name: 'form', outcome: null, misses: 0 });
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null); // { query, registrationGiven }
  const [draft, setDraft] = useState(null); // last notice number and date typed, in memory only, so Edit and Back do not make people retype
  const [live, setLive] = useState(null); // the progressive state of the lookup, see lookupState.js
  const headingRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = view.name === 'notice' ? `What happened | ${TITLE}` : TITLE;
    if (firstRender.current) { firstRender.current = false; return; }
    // move focus to the new page heading so keyboard and screen reader users start in the right place
    if (view.name === 'notice') headingRef.current?.focus({ preventScroll: false });
    else if (!reloadNote) document.getElementById('hero-h')?.focus({ preventScroll: true }); // after a timeout the form puts focus in the plate box
  }, [view.name]);

  // the browser Back button returns to the form instead of leaving the site
  useEffect(() => {
    const onPop = () => { if (popSkip.current) { popSkip.current = false; return; } abortRef.current?.abort(); setBusy(false); setFound(null); setView((v) => ({ ...v, name: 'form', outcome: null })); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // One lookup is one streamed request. Each event updates `live`; the notice page opens as soon as the details arrive
  // and its other sections show their own loading state until their events come.
  const abortRef = useRef(null);
  const liveRef = useRef(null);

  const cancel = () => { abortRef.current?.abort(); abortRef.current = null; };
  useEffect(() => cancel, []);

  const popSkip = useRef(false);
  const [reloadNote, setReloadNote] = useState(false); // the form is open because the photo links timed out

  const stream = useCallback(async (query, registration, onFail) => {
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
        const r = toResult(liveRef.current);
        const kind = classify(r);
        // input-required stays on the Notice page — the inline identity prompt handles it
        if (kind !== 'found' && kind !== 'unavailable' && kind !== 'input-required') {
          onFail(kind);
        }
      }
    };
    try {
      await streamLookup({ ...query, registration }, take, controller.signal);
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (first && err instanceof LookupError && err.kind === 'invalid') { first = false; onFail('not-found'); }
      else take('error', { cause: 'network' });
    }
    if (!controller.signal.aborted && !liveRef.current.finished) take('error', { cause: 'stream-interrupted' });
    if (abortRef.current === controller) { abortRef.current = null; setBusy(false); }
  }, []);

  // The result frame opens at once with every section loading; the form is replaced by a one-line summary with an Edit link.
  const begin = async (plain, registration, { fresh }) => {
    liveRef.current = initialLookup();
    setLive(liveRef.current);
    setFound({ query: plain, registrationGiven: !!registration, registration: registration || null });
    if (fresh) {
      window.history.pushState({ notice: true }, '');
      window.scrollTo(0, 0);
      setView({ name: 'notice', outcome: null, misses: 0 });
    }
    await stream(plain, registration, (kind, requiredFields) => {
      // Not matched / switched off: back to the form with its message, undoing the history entry we added.
      clearSession();
      popSkip.current = !!window.history.state?.notice;
      if (popSkip.current) window.history.back();
      setFound(null);
      setView((v) => ({ name: 'form', outcome: kind, misses: kind === 'not-found' ? v.misses + 1 : v.misses, requiredFields: requiredFields || null }));
    });
  };

  // A link from the demo hub (?demo=<number>): the number leaves the address bar at once, and only a number the backend lists as a
  // demo case is looked up (with demo data off the list does not exist, so nothing happens and the normal form shows).
  useEffect(() => {
    const number = demoCaseParam(window.location.search);
    if (!number) return;
    window.history.replaceState(window.history.state, '', window.location.pathname);
    fetchDemoCases().then((catalog) => {
      const c = findCase(catalog, number);
      if (c) begin({ infringementNumber: c.number, offenceDate: c.offenceDate }, undefined, { fresh: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore from sessionStorage on refresh: re-run the last lookup so the user stays where they were.
  useEffect(() => {
    if (demoCaseParam(window.location.search)) return; // demo link takes priority
    const saved = loadSession();
    if (saved?.query?.infringementNumber && saved?.query?.offenceDate) {
      begin(saved.query, saved.registration || undefined, { fresh: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (query) => {
    const plain = { infringementNumber: query.infringementNumber, offenceDate: query.offenceDate };
    saveSession(plain, query.registration);
    setDraft(draftFromQuery(query)); setReloadNote(false);
    return begin(plain, query.registration, { fresh: true });
  };

  // Re-runs the whole lookup (no vehicle registration number is kept, so a registration is asked for again inline if the source needs it).
  const retry = () => begin(found.query, undefined, { fresh: false });

  // The photo links timed out: back to the form with the notice number and date filled in. The plate is never kept, so it is asked for again.
  const rerun = () => { setDraft(draftFromQuery(found.query)); startAgain(); setReloadNote(true); };

  // The registration is asked for inline on the notice page and sent with a fresh request: it is held only for that call.
  const retryWithPlate = async (registration) => {
    liveRef.current = restartSections(liveRef.current);
    setLive(liveRef.current);
    setFound((f) => ({ ...f, registrationGiven: true }));
    await stream(found.query, registration, (kind) => setView({ name: 'form', outcome: kind, misses: 0 }));
  };

  // Identity fields asked inline when the notice type requires them.
  // Person (familyName/givenNames) and organisation are mutually exclusive.
  const retryWithIdentity = async (familyName, givenNames, organisation) => {
    liveRef.current = restartSections(liveRef.current);
    setLive(liveRef.current);
    setFound((f) => ({ ...f, identityGiven: true }));
    // Re-send with the stored registration (needed for plate submission after identity) plus the identity fields.
    await stream({ ...found.query, familyName, givenNames, organisation }, found.registration, (kind) => setView({ name: 'form', outcome: kind, misses: 0 }));
  };

  const startAgain = () => {
    cancel(); setBusy(false); setReloadNote(false);
    if (window.history.state?.notice) window.history.back(); else { setFound(null); setView({ name: 'form', outcome: null, misses: 0 }); }
  };

  // Edit: go back to the form with the notice number and date pre-filled (never the plate — it is asked for again).
  const edit = () => { setDraft(draftFromQuery({ ...found?.query, registration: found?.registration })); startAgain(); };

  // New lookup: go back to a blank form.
  const newLookup = () => { clearSession(); setDraft(null); startAgain(); };

  const asResult = live ? toResult(live) : null;
  const foundResult = asResult && classify(asResult) === 'found' ? asResult : null;

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="nsw-masthead"><div className="wrap">NSW Government{live?.details?.source === 'DEMO' && <DemoTag />}</div></div>
      <header className="nsw-header"><div className="wrap">
        <div className="nsw-header__title">Road safety enforcement</div>
      </div></header>
      <main id="main" tabIndex={-1}>
        {view.name === 'notice' && found
          ? <Notice result={foundResult} query={found.query}
            sections={{ details: foundResult ? 'ready' : live?.finished || live?.details ? 'error' : 'loading', evidence: live.evidence.state, certificates: live.certificates.state }}
            registrationGiven={found.registrationGiven} onPlate={retryWithPlate} onIdentity={retryWithIdentity} identityGiven={found.identityGiven} plateBusy={busy} onRetry={retry} onRerun={rerun} onEdit={edit} onNew={newLookup} headingRef={headingRef} />
          : <LookupForm busy={busy} outcome={view.outcome} misses={view.misses} onSubmit={submit} draft={draft} reloadNote={reloadNote}
            requiredFields={view.requiredFields}
            scenarios={mockEnabled ? SCENARIOS : null} onPickDefaultDate={() => '2026-03-14'} />}
      </main>
      <footer className="nsw-footer">
        <div className="wrap nsw-footer__inner">
          <p>Need help? Call <a href="tel:1300138118">{HELP_PHONE}</a></p>
          <nav className="nsw-footer__links" aria-label="Footer links">
            <a href="https://www.nsw.gov.au/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
            <a href="https://www.nsw.gov.au/accessibility-statement" target="_blank" rel="noopener noreferrer">Accessibility</a>
            <a href="https://www.nsw.gov.au/nsw-government/copyright" target="_blank" rel="noopener noreferrer">Copyright</a>
            <a href="https://www.nsw.gov.au/departments-and-agencies/transport-for-nsw" target="_blank" rel="noopener noreferrer">About</a>
          </nav>
          <p className="nsw-footer__info">(working prototype)</p>
        </div>
      </footer>
    </>
  );
}

const SCENARIOS = [
  ['9000000001', 'Speed camera'], ['9000000004', 'Plate needed'], ['9000000005', 'Evidence not yet available'],
  ['9000000002', 'Officer caution'], ['9000000006', 'Not found'], ['9000000007', 'Unavailable'],
].map(([number, label]) => ({ number, label }));
