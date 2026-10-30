import { useEffect, useState } from 'react';
import { emptyFields, runLiveCheck } from './liveCheck.js';
import './styles.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export default function LiveCheck() {
  const [fields, setFields] = useState(emptyFields());
  const [state, setState] = useState({ phase: 'idle' });

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    const prev = document.title;
    document.title = 'Test page';
    return () => { meta.remove(); document.title = prev; };
  }, []);

  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const sent = fields;
    setFields(emptyFields());
    setState({ phase: 'loading' });
    const out = await runLiveCheck(sent, { base: API_BASE });
    setState(out.ok ? { phase: 'done', rows: out.rows } : { phase: 'error', message: out.error });
  }

  const busy = state.phase === 'loading';
  return (
    <main className="page lc">
      <h1>Live check</h1>
      <p className="banner" role="note">Test only: your details are not saved.</p>
      <form className="form lc-form" onSubmit={onSubmit} autoComplete="off">
        <label>Access token (leave blank if none)
          <input type="password" value={fields.token} onChange={set('token')} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck="false" />
        </label>
        <label>Penalty notice number
          <input type="text" value={fields.notice} onChange={set('notice')} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck="false" required />
        </label>
        <label>Offence date (DD/MM/YYYY)
          <input type="text" inputMode="text" autoCapitalize="off" autoCorrect="off" placeholder="DD/MM/YYYY" value={fields.date} onChange={set('date')} autoComplete="off" spellCheck="false" required />
        </label>
        <label>Registration number (optional)
          <input type="text" value={fields.registration} onChange={set('registration')} autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck="false" />
        </label>
        <button className="btn primary lc-btn" disabled={busy}>{busy ? 'Checking, this can take a minute...' : 'Run check'}</button>
      </form>
      <div aria-live="polite">
        {state.phase === 'error' && <p role="alert" className="error">{state.message}</p>}
        {state.phase === 'done' && (
          <dl className="lc-result">
            {state.rows.map((r, i) => (
              <div key={i} className={r.nested ? 'lc-nested' : undefined}><dt>{r.label}</dt><dd>{r.value}</dd></div>
            ))}
          </dl>
        )}
      </div>
    </main>
  );
}
