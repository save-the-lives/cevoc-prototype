import React, { useState } from 'react';
import { Link, Alert, Breadcrumbs, Field, StatusTag, ErrorState, Loading } from '../components/ui.jsx';
import { useApp, apiCtx } from '../state.js';
import { api, can } from '../services/mockApi.js';
import { ROLES, SITES } from '../data/mockData.js';
import { go } from '../router.js';
import { fmtDate } from '../format.js';

export function OfficerSignIn() {
  const app = useApp();
  const [role, setRole] = useState(ROLES[0].id);
  const [busy, setBusy] = useState(false);

  const signIn = (e) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => {
      app.signIn(ROLES.find((r) => r.id === role));
      go('/officer/search');
    }, 600);
  };

  return (
    <div className="nsw-container cevoc-page">
      <Breadcrumbs items={[['Home', '/'], ['Officer sign in', '/officer']]} />
      <h1>Authorised officer access</h1>
      <p className="nsw-intro">For Revenue NSW and Transport officers. Sign in with your organisation account. CEVOC doesn't hold separate usernames or passwords.</p>

      <form className="cevoc-panel" onSubmit={signIn}>
        <fieldset className="nsw-form__fieldset">
          <legend className="nsw-form__legend">Prototype: choose a mock identity</legend>
          <span className="nsw-form__helper">In the target solution this step redirects to your organisation's identity provider (federated sign-in).</span>
          {ROLES.map((r) => (
            <label key={r.id} className="nsw-form__radio">
              <input type="radio" name="role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} />
              <span>
                <strong>{r.name}</strong>
                <br />
                <small>{r.org} · {r.permissions.length ? r.permissions.join(', ') : 'no CEVOC permissions'}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <button type="submit" className="nsw-button nsw-button--dark" disabled={busy}>
          {busy ? 'Redirecting to your organisation…' : 'Sign in with organisation account'}
        </button>
      </form>
    </div>
  );
}

export function OfficerSearch() {
  const app = useApp();
  const [site, setSite] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [state, setState] = useState({ loading: false, data: null, error: null });

  if (!app.officer)
    return (
      <div className="nsw-container cevoc-page">
        <h1>Sign in required</h1>
        <Alert type="warning" title="You need to sign in to use officer search">
          <p>This area is only available to authorised officers.</p>
        </Alert>
        <Link className="nsw-button nsw-button--dark" to="/officer">Sign in</Link>
      </div>
    );

  if (!can(app.officer, 'cert:search'))
    return (
      <div className="nsw-container cevoc-page">
        <h1>Officer certificate search</h1>
        <Alert type="error" title="You're signed in, but not authorised">
          <p>Your account ({app.officer.name}, {app.officer.org}) has no CEVOC role. Signing in confirms who you are; your role decides what you can see.</p>
          <p>In the target service, access would be requested through your organisation's access process.</p>
        </Alert>
        <button type="button" className="nsw-button nsw-button--dark-outline" onClick={app.signOut}>Sign out</button>
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
    <div className="nsw-container cevoc-page">
      <Breadcrumbs items={[['Home', '/'], ['Officer certificate search', '/officer/search']]} />
      <h1>Officer certificate search</h1>
      <p className="nsw-intro">Signed in as <strong>{app.officer.name}</strong>, {app.officer.org} (mock).</p>

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

      <section className="cevoc-panel cevoc-panel--officer">
        <h2 className="cevoc-h2">Session audit log</h2>
        <p className="cevoc-muted">Demonstrates traceability of officer access and publication actions (prototype session only).</p>
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
