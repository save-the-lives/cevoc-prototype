import { useState } from 'react';
import { lookupPenalty, mockEnabled } from './api.js';
import EvidenceItem from './EvidenceItem.jsx';
import './styles.css';

export default function App() {
  const [infringementNumber, setNumber] = useState('');
  const [offenceDate, setDate] = useState('');
  const [state, setState] = useState({ phase: 'idle' });

  async function onSubmit(e) {
    e.preventDefault();
    setState({ phase: 'loading' });
    try {
      setState({ phase: 'done', result: await lookupPenalty({ infringementNumber, offenceDate }) });
    } catch (err) {
      setState({ phase: 'error', message: err.message });
    }
  }

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <main id="main" className="page">
        <h1>Check your camera fine evidence</h1>
        <p>Enter the details from your penalty notice. No sign-in needed.</p>
        <form onSubmit={onSubmit} className="form">
          <label>Penalty notice number
            <input value={infringementNumber} onChange={(e) => setNumber(e.target.value)} required autoComplete="off" />
          </label>
          <label>Date of offence
            <input type="date" value={offenceDate} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <button className="btn primary" disabled={state.phase === 'loading'}>
            {state.phase === 'loading' ? 'Checking...' : 'Check'}
          </button>
        </form>
        {mockEnabled && <DevScenarios onPick={(n) => { setNumber(n); setDate((d) => d || '2026-03-14'); }} />}

        {state.phase === 'error' && <p role="alert" className="error">{state.message}</p>}
        {state.phase === 'done' && <Result result={state.result} />}
      </main>
    </>
  );
}

function DevScenarios({ onPick }) {
  const scenarios = [
    ['9000000001', 'Speed camera'], ['9000000002', 'Officer caution'],
    ['9000000003', 'Ticketless camera'], ['9000000009', 'Broken video'],
  ];
  return (
    <p className="dev">Mock data (dev only): {scenarios.map(([n, l]) => (
      <button key={n} type="button" className="linklike" onClick={() => onPick(n)}>{l}</button>
    ))}</p>
  );
}

function Result({ result }) {
  const n = result.notice;
  if (result.status === 'LIVE_LOOKUP_OFF') {
    return <section aria-live="polite"><h2>Lookup not available yet</h2><p>{result.summary}</p></section>;
  }
  if (result.status !== 'FOUND' || !n) {
    return <section aria-live="polite"><h2>No match</h2><p>{result.summary}</p></section>;
  }
  const evidence = result.evidence || [];
  const isCamera = n.enforcementMethod === 'CAMERA';
  const certificates = evidence.filter((e) => e.kind === 'CERTIFICATE');
  const media = evidence.filter((e) => e.kind !== 'CERTIFICATE');
  return (
    <section aria-live="polite" className="result">
      {result.source === 'STUB' && <p className="banner" role="note"><strong>Prototype data only.</strong> This is not a real notice.</p>}
      <h2>Notice {result.infringementNumber}</h2>
      <p className="status"><strong>{n.statusMessage}</strong></p>
      <dl className="details">
        <div><dt>Amount owing</dt><dd>${n.amountOwing}</dd></div>
        <div><dt>Penalty amount</dt><dd>${n.penaltyAmount}</dd></div>
        <div className="span"><dt>Offence</dt><dd>{n.offenceDescription}</dd></div>
        <div><dt>Date and time</dt><dd>{n.offenceDate} {n.offenceTime}</dd></div>
        <div><dt>Location</dt><dd>{n.location}</dd></div>
      </dl>

      <h3>Evidence</h3>
      {media.length > 0
        ? (
          <>
            <p className="hint">Zoom in to read plates and signs: pinch or double-tap on a touch screen, scroll wheel or the buttons with a mouse, plus and minus keys on a keyboard.</p>
            <ul className="grid">{media.map((e) => <EvidenceItem key={e.url} item={e} />)}</ul>
          </>
        )
        : <p>{isCamera ? 'Evidence is not available to show yet.' : 'No camera evidence applies to this notice.'}</p>}
      {isCamera && (
        <>
          <h3>Enforcement centre certificate</h3>
          {certificates.length > 0
            ? <ul className="grid">{certificates.map((e) => <EvidenceItem key={e.url} item={e} />)}</ul>
            : <p>Certificate information is not available to show yet.</p>}
        </>
      )}
    </section>
  );
}
