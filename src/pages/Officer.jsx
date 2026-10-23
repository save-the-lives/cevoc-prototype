import React, { useState } from 'react';
import { Link, Alert, Breadcrumbs, Field, StatusTag, ErrorState, Loading } from '../components/ui.jsx';
import { useApp, apiCtx } from '../state.js';
import { api, can } from '../services/mockApi.js';
import { ROLES, SITES, IDPS } from '../data/mockData.js';
import { go } from '../router.js';
import { fmtDate } from '../format.js';
import { query } from '../util.js';

// Mock of an organisation's own sign-in page (reached by home realm discovery).
export function IdpScreen({ idp, email, onContinue, onBack, busy, preview }) {
  return (
    <div className={`cevoc-idp ${preview ? 'is-preview' : ''}`} style={{ '--idp': idp.colour }}>
      <div className="cevoc-idp__card">
        <div className="cevoc-idp__org">{idp.org}</div>
        <h2>Sign in</h2>
        <p className="cevoc-idp__email">{email}</p>
        <label className="cevoc-idp__label">
          Password
          <input type="password" value="••••••••••" readOnly tabIndex={preview ? -1 : 0} aria-label="Password (mock)" />
        </label>
        <div className="cevoc-idp__mfa">
          <span aria-hidden="true">🔐</span> Approve the sign-in request in your authenticator app
        </div>
        {!preview && (
          <div className="cevoc-actions">
            <button type="button" className="cevoc-idp__btn" onClick={onContinue} disabled={busy}>
              {busy ? 'Signing you in…' : 'Continue'}
            </button>
            <button type="button" className="cevoc-linkbutton" onClick={onBack}>Use a different account</button>
          </div>
        )}
        <p className="cevoc-idp__foot">
          {idp.platform}. Mock screen: nothing you type is sent anywhere.
        </p>
      </div>
    </div>
  );
}

export function OfficerSignIn({ path }) {
  const app = useApp();
  const [email, setEmail] = useState(query(path).email || '');
  const [idp, setIdp] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const discover = (e) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    const domain = addr.split('@')[1];
    const found = Object.values(IDPS).find((i) => i.domain === domain);
    if (!/^[^@\s]+@[^@\s]+$/.test(addr)) setError('Enter your work email address, for example name@transport.nsw.gov.au');
    else if (!found) setError(`${domain} isn’t set up for CEVOC. Use your Transport for NSW or Revenue NSW work account.`);
    else {
      setError(null);
      setIdp(found);
    }
  };

  const complete = () => {
    setBusy(true);
    setTimeout(() => {
      const addr = email.trim().toLowerCase();
      const role =
        ROLES.find((r) => r.email === addr) || { id: 'unknown', name: addr, org: idp.org, email: addr, idp: idp.id, permissions: [] };
      app.signIn(role);
      go('/officer/home');
    }, 700);
  };

  if (idp)
    return (
      <div className="cevoc-page">
        <p className="nsw-container cevoc-muted">You’ve been sent to {idp.org}’s sign-in page (simulated).</p>
        <IdpScreen idp={idp} email={email} onContinue={complete} onBack={() => setIdp(null)} busy={busy} />
      </div>
    );

  return (
    <div className="nsw-container cevoc-page">
      <Breadcrumbs items={[['Home', '/'], ['Officer sign in', '/officer']]} />
      <h1>Authorised officer access</h1>
      <p className="nsw-intro">Sign in with your work account. We’ll send you to your organisation’s sign-in page. CEVOC doesn’t keep its own passwords.</p>

      {error && (
        <Alert type="error" title="We can’t sign you in with that address">
          <p>{error}</p>
        </Alert>
      )}
      <form className="cevoc-panel" onSubmit={discover} noValidate>
        <Field id="email" label="Work email" hint="Transport for NSW or Revenue NSW address" error={null}>
          <input id="email" type="email" className="nsw-form__input" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} style={{ maxWidth: '26rem' }} />
        </Field>
        <button type="submit" className="nsw-button nsw-button--dark">Next</button>
      </form>

      <details className="nsw-accordion" open>
        <summary>Prototype sample accounts</summary>
        <ul>
          {ROLES.map((r) => (
            <li key={r.id}>
              <button type="button" className="cevoc-linkbutton" onClick={() => { setEmail(r.email); setError(null); }}>{r.email}</button> – {r.name}
            </li>
          ))}
          <li>
            <button type="button" className="cevoc-linkbutton" onClick={() => { setEmail('someone@gmail.com'); setError(null); }}>someone@gmail.com</button> – not a supported organisation
          </li>
        </ul>
      </details>
    </div>
  );
}

const NAV = [
  ['home', 'Workspace', '/officer/home', null],
  ['review', 'Review cases', '/officer/review', 'review'],
  ['adjudication', 'Adjudication queue', '/officer/adjudication', 'adjudicate'],
  ['search', 'Certificate search', '/officer/search', 'cert:search'],
];

// Officer console layout: a different layout for a different job (dense, task-focused).
export function OfficerShell({ active, children }) {
  const app = useApp();
  if (!app.officer)
    return (
      <div className="nsw-container cevoc-page">
        <h1>Sign in required</h1>
        <Alert type="warning" title="This area is only for authorised officers">
          <p>Sign in with your Transport for NSW or Revenue NSW work account.</p>
        </Alert>
        <Link className="nsw-button nsw-button--dark" to="/officer">Sign in</Link>
      </div>
    );
  const idp = IDPS[app.officer.idp] || IDPS.transport;
  return (
    <div className="cevoc-console" style={{ '--idp': idp.colour }}>
      <aside className="cevoc-console__nav" aria-label="Officer workspace">
        <div className="cevoc-console__who">
          <span className="cevoc-console__org">{app.officer.org}</span>
          <strong>{app.officer.name}</strong>
          <small>{app.officer.email}</small>
        </div>
        <nav>
          {NAV.filter(([, , , perm]) => !perm || can(app.officer, perm)).map(([key, label, to]) => (
            <Link key={key} to={to} className={key === active ? 'is-active' : ''} aria-current={key === active ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <button type="button" className="cevoc-console__signout" onClick={app.signOut}>Sign out</button>
      </aside>
      <section className="cevoc-console__main">{children}</section>
    </div>
  );
}

const firstName = (email) => {
  const f = (email || '').split('@')[0].split('.')[0];
  return f ? f[0].toUpperCase() + f.slice(1) : 'there';
};

export function OfficerHome() {
  const app = useApp();
  const o = app.officer;
  const tiles = [
    ['review', 'Review cases', 'Customer review requests and court elections, with all evidence in one place.', '/officer/review'],
    ['adjudicate', 'Adjudication queue', 'Screen detections before notices are issued.', '/officer/adjudication'],
    ['cert:search', 'Certificate search', 'Search certificates, including restricted technical records.', '/officer/search'],
    ['content:withdraw', 'Publication control', 'Withdraw or restore public content from a certificate page.', '/certificates/CEV-PAR001-2026'],
  ].filter(([perm]) => can(o, perm));

  return (
    <div>
      <h1>Hello, {firstName(o.email)}</h1>
      <p className="cevoc-muted">Signed in through {o.org} as <strong>{o.name}</strong> (mock). Your role decides what you can see.</p>
      {tiles.length === 0 ? (
        <Alert type="error" title="You’re signed in, but not authorised">
          <p>Your account has no CEVOC role. Signing in confirms who you are; your role decides what you can see. Access would be requested through your organisation’s access process.</p>
        </Alert>
      ) : (
        <ul className="cevoc-tiles">
          {tiles.map(([perm, title, text, to]) => (
            <li key={perm}>
              <Link to={to} className="cevoc-tile">
                <strong>{title}</strong>
                <span>{text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section className="cevoc-panel cevoc-panel--officer">
        <h2 className="cevoc-h2">Session audit log</h2>
        <p className="cevoc-muted">Every officer action is logged (prototype session only).</p>
        {app.auditLog.length === 0 ? (
          <p>No actions yet.</p>
        ) : (
          <ol className="cevoc-audit">
            {app.auditLog.map((a, i) => (
              <li key={i}><time>{a.at}</time> · {a.who} · {a.what}</li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function OfficerSearch() {
  const app = useApp();
  const [site, setSite] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [state, setState] = useState({ loading: false, data: null, error: null });

  if (!can(app.officer, 'cert:search'))
    return (
      <div>
        <h1>Certificate search</h1>
        <Alert type="error" title="You’re signed in, but not authorised">
          <p>Your account ({app.officer.name}, {app.officer.org}) has no CEVOC role. Signing in confirms who you are; your role decides what you can see.</p>
        </Alert>
      </div>
    );

  const search = async (e) => {
    e.preventDefault();
    setState({ loading: true, data: null, error: null });
    try {
      const data = await api.officerSearch(apiCtx(app), { site, from, to });
      setState({ loading: false, data, error: null });
      app.audit(`Searched certificates (${site || 'all cameras'}, ${from || 'any'} to ${to || 'any'}): ${data.length} result(s)`);
    } catch (error) {
      setState({ loading: false, data: null, error });
    }
  };

  const invalidRange = from && to && from > to;

  return (
    <div>
      <h1>Certificate search</h1>
      <form className="cevoc-search cevoc-search--officer" onSubmit={search}>
        <Field id="o-site" label="Camera">
          <select id="o-site" className="nsw-form__select" value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">All cameras</option>
            {SITES.map((s) => <option key={s.code} value={s.code}>{s.code} – {s.name}</option>)}
          </select>
        </Field>
        <Field id="o-from" label="In force from">
          <input id="o-from" type="date" className="nsw-form__input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="o-to" label="In force to" error={invalidRange ? 'Must be on or after the from date' : null}>
          <input id="o-to" type="date" className="nsw-form__input" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={!!invalidRange} />
        </Field>
        <button type="submit" className="nsw-button nsw-button--dark" disabled={!!invalidRange}>Search</button>
      </form>

      {state.error && <ErrorState error={state.error} />}
      {state.loading && <Loading text="Searching" />}
      {state.data && (
        <>
          <p className="nsw-results-bar" aria-live="polite">Showing <strong>{state.data.length}</strong> certificate(s), including restricted records</p>
          {state.data.length === 0 ? (
            <Alert type="info" title="No certificates match"><p>Try a wider date range or all cameras.</p></Alert>
          ) : (
            <div className="cevoc-table-wrap">
              <table className="nsw-table">
                <thead>
                  <tr><th>Certificate</th><th>Camera</th><th>In force</th><th>Device serial</th><th>Match value</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {state.data.map((c) => (
                    <tr key={c.id}>
                      <td><Link to={`/certificates/${c.id}`}>{c.id}</Link></td>
                      <td>{c.site}</td>
                      <td>{fmtDate(c.validFrom)} – {fmtDate(c.validTo)}</td>
                      <td>{c.restricted.deviceSerial}</td>
                      <td><code>{c.restricted.matchValue}</code></td>
                      <td><StatusTag status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
