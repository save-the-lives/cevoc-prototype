import { useState } from 'react';
import { lookupPenalty } from './api.js';

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
    <main style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Check your camera fine evidence</h1>
      <p>Enter the details from your penalty notice. No sign-in needed.</p>
      <form onSubmit={onSubmit}>
        <label>Penalty notice number<br />
          <input value={infringementNumber} onChange={(e) => setNumber(e.target.value)} required />
        </label>
        <br /><br />
        <label>Date of offence<br />
          <input type="date" value={offenceDate} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <br /><br />
        <button disabled={state.phase === 'loading'}>{state.phase === 'loading' ? 'Checking...' : 'Check'}</button>
      </form>

      {state.phase === 'error' && <p role="alert">{state.message}</p>}
      {state.phase === 'done' && <Result result={state.result} />}
    </main>
  );
}

function Result({ result }) {
  const n = result.notice;
  if (result.status !== 'FOUND' || !n) {
    return <section aria-live="polite"><h2>No match</h2><p>{result.summary}</p></section>;
  }
  const evidence = result.evidence || [];
  const isCamera = n.enforcementMethod === 'CAMERA';
  const certificates = evidence.filter((e) => e.kind === 'CERTIFICATE');
  const media = evidence.filter((e) => e.kind !== 'CERTIFICATE');
  return (
    <section aria-live="polite">
      <h2>Notice {result.infringementNumber}</h2>
      <p><strong>{n.statusMessage}</strong></p>
      <dl>
        <dt>Amount owing</dt><dd>${n.amountOwing}</dd>
        <dt>Penalty amount</dt><dd>${n.penaltyAmount}</dd>
        <dt>Offence</dt><dd>{n.offenceDescription}</dd>
        <dt>Date and time</dt><dd>{n.offenceDate} {n.offenceTime}</dd>
        <dt>Location</dt><dd>{n.location}</dd>
      </dl>
      <h3>Evidence</h3>
      {media.length > 0
        ? <ul>{media.map((e) => <li key={e.url}>{e.title} ({e.kind.toLowerCase()})</li>)}</ul>
        : <p>{isCamera ? 'Evidence is not available to show yet.' : 'No camera evidence applies to this notice.'}</p>}
      {isCamera && (
        <>
          <h3>Enforcement centre certificate</h3>
          {certificates.length > 0
            ? <ul>{certificates.map((e) => <li key={e.url}>{e.title}</li>)}</ul>
            : <p>Certificate information is not available to show yet.</p>}
        </>
      )}
      {result.source === 'STUB' && <small>Prototype data only.</small>}
    </section>
  );
}
