import { useRef, useState } from 'react';
import DateField from './DateField.jsx';
import { checkDate, checkNotice, checkRegistration, cleanNotice, cleanRegistration, isoToParts, partsToIso } from './lookupValidation.js';
import { HELP_PHONE } from './journey.js';

export default function LookupForm({ busy, outcome, misses, onSubmit, scenarios, onPickDefaultDate }) {
  const [num, setNum] = useState('');
  const [reg, setReg] = useState('');
  const [parts, setParts] = useState({ d: '', m: '', y: '' });
  const [fe, setFe] = useState({});
  const [bad, setBad] = useState([]);
  const sumRef = useRef(null);

  const validate = (which = ['num', 'date', 'reg']) => {
    const x = {}; let b = [];
    if (which.includes('num')) { const m = checkNotice(num); if (m) x.num = m; }
    if (which.includes('date')) { const r = checkDate(parts); if (r) { x.date = r.msg; b = r.bad; } }
    if (which.includes('reg')) { const m = checkRegistration(reg); if (m) x.reg = m; }
    return { x, b };
  };
  const leave = (field) => {
    const { x, b } = validate([field]);
    setFe((f) => { const { [field]: _o, ...rest } = f; return { ...rest, ...x }; });
    if (field === 'date') setBad(b);
  };
  const clear = (field) => { if (fe[field]) setFe((f) => { const { [field]: _o, ...rest } = f; return rest; }); if (field === 'date') setBad([]); };

  const submit = (e) => {
    e.preventDefault();
    const { x, b } = validate();
    setFe(x); setBad(b);
    if (Object.keys(x).length) { setTimeout(() => sumRef.current?.focus(), 0); return; }
    const registration = cleanRegistration(reg);
    setReg(''); // the registration number is sent once and not kept
    onSubmit({ infringementNumber: cleanNotice(num), offenceDate: partsToIso(parts), registration: registration || undefined });
  };

  const problems = [fe.num && { id: 'pn', msg: fe.num }, fe.date && { id: 'od-d', msg: fe.date }, fe.reg && { id: 'rego', msg: fe.reg }].filter(Boolean);
  const focusField = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.focus(); };

  return (
    <>
      <section className="hero" aria-labelledby="hero-h">
        <div className="wrap">
          <h1 id="hero-h" tabIndex={-1}>Check the evidence for a camera-detected offence</h1>
          <p>Getting a fine is stressful. Here you can see what the camera recorded and check that it was working properly. It takes a few minutes and you don’t need to sign in.</p>
        </div>
      </section>
      <div className="wrap page-body">
        <div className="two">
          <form className="lookup" onSubmit={submit} noValidate aria-labelledby="form-h" aria-busy={busy || undefined}>
            <h2 id="form-h">Find your penalty notice</h2>
            {problems.length > 0 && (
              <div className="errsum" role="alert" tabIndex={-1} ref={sumRef} aria-labelledby="errsum-h">
                <h3 id="errsum-h">There {problems.length === 1 ? 'is a problem' : 'are problems'} with your details</h3>
                <ul>{problems.map((p) => <li key={p.id}><a href={`#${p.id}`} onClick={focusField(p.id)}>{p.msg}</a></li>)}</ul>
              </div>
            )}
            {!problems.length && outcome === 'not-found' && (
              <div className="errsum" role="alert" tabIndex={-1} ref={sumRef} aria-labelledby="nm-h">
                <h3 id="nm-h">We couldn’t find that notice</h3>
                <p>Check both details match your letter. For your privacy we don’t say which one didn’t match.</p>
                {misses >= 2 && <p>Still stuck? The penalty notice number is on your letter, and the offence date is in the section that says what happened. You can also call {HELP_PHONE}.</p>}
              </div>
            )}
            {!problems.length && outcome === 'unavailable' && (
              <div className="errsum" role="alert" tabIndex={-1} ref={sumRef} aria-labelledby="un-h">
                <h3 id="un-h">We can’t check this right now</h3>
                <p>The problem is on our side, not with your details. Please try again in a few minutes. If it keeps happening, call {HELP_PHONE}.</p>
              </div>
            )}
            {!problems.length && outcome === 'lookup-off' && (
              <div className="errsum is-info" role="alert" tabIndex={-1} ref={sumRef} aria-labelledby="off-h">
                <h3 id="off-h">This check isn’t available for that notice yet</h3>
                <p>We’re still building this service, so we can only show some notices at the moment. For any notice you can call {HELP_PHONE}.</p>
              </div>
            )}
            <div className="field">
              <label htmlFor="pn">Penalty notice number</label>
              <p className="hint" id="pn-hint">10 digits, on your penalty notice letter</p>
              {fe.num && <p className="field-err" id="pn-err" role="alert"><span aria-hidden="true">⚠ </span><span className="sr-only">Error: </span>{fe.num}</p>}
              <input id="pn" inputMode="numeric" autoComplete="off" value={num} className={fe.num ? 'is-bad' : ''}
                aria-describedby={`pn-hint${fe.num ? ' pn-err' : ''}`} aria-invalid={!!fe.num || undefined}
                onBlur={() => num && leave('num')}
                onChange={(e) => { setNum(e.target.value); clear('num'); }} />
              {scenarios && (
                <p className="dev">Sample notices (development only): {scenarios.map((s) => (
                  <button key={s.number} type="button" className="linklike" onClick={() => { setNum(s.number); setParts((p) => (p.d ? p : isoToParts(onPickDefaultDate()))); setFe({}); setBad([]); }}>{s.label}</button>
                ))}</p>
              )}
            </div>
            <DateField id="od" legend="Date of the offence" hint="Shown on the penalty notice. For example, 24 10 2026" parts={parts} error={fe.date} bad={bad}
              onChange={(p) => { setParts(p); clear('date'); }}
              onBlurField={() => setTimeout(() => { if (!document.getElementById('od')?.contains(document.activeElement) && (parts.d || parts.m || parts.y)) leave('date'); }, 0)} />
            <div className="field">
              <label htmlFor="rego">Number plate of the vehicle <span className="opt">(optional)</span></label>
              <p className="hint" id="rego-hint">Some notices only release the photos once the number plate is given. Add it now to see them straight away. We use it for this check only and don’t keep it.</p>
              {fe.reg && <p className="field-err" id="rego-err" role="alert"><span aria-hidden="true">⚠ </span><span className="sr-only">Error: </span>{fe.reg}</p>}
              <input id="rego" className={`rego${fe.reg ? ' is-bad' : ''}`} autoComplete="off" autoCapitalize="characters" spellCheck="false" maxLength={12}
                value={reg} aria-describedby={`rego-hint${fe.reg ? ' rego-err' : ''}`} aria-invalid={!!fe.reg || undefined}
                onBlur={() => reg && leave('reg')}
                onChange={(e) => { setReg(e.target.value); clear('reg'); }} />
            </div>
            <button type="submit" className="btn primary big" disabled={busy}>{busy ? 'Finding your notice…' : 'Show me what happened'}</button>
            <p className="sr-only" role="status">{busy ? 'Finding your notice' : ''}</p>
          </form>
          <aside className="aside" aria-labelledby="aside-h">
            <h2 id="aside-h">Before you start</h2>
            <ul>
              <li>We ask for two details from your letter, and the number plate if you want to see photos.</li>
              <li>We never ask for card or bank details on this page.</li>
              <li>Paying, reviews and nominating the driver stay with Revenue NSW.</li>
            </ul>
          </aside>
        </div>
      </div>
    </>
  );
}
