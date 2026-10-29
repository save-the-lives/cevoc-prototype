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
      {state.phase === 'done' && (
        <section aria-live="polite">
          <h2>{state.result.status === 'FOUND' ? 'Your evidence' : 'No match'}</h2>
          <p>{state.result.summary}</p>
          <ul>
            {state.result.evidence.map((e) => <li key={e.url}>{e.title} ({e.kind.toLowerCase()})</li>)}
          </ul>
          {state.result.source === 'STUB' && <small>Prototype data only.</small>}
        </section>
      )}
    </main>
  );
}
