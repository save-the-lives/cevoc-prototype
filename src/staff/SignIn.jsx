import { useEffect, useRef, useState } from 'react';
import { Button } from '@nswds/ui';
import { AgencyLockup } from '../shared/ui.jsx';
import { STAFF } from '../data.js';

// The sign-in page is split in two on purpose:
//  1. the real-looking staff sign-in (one button, no fields, nothing typed), and
//  2. a dashed "prototype" panel OUTSIDE it, where the presenter chooses which sample person signs in.
// Pressing the button then plays a paced, simulated single sign-on handshake (OpenID Connect style) and lands on the site.
// No identity, password or token is captured or stored: everything shown is invented.

const domain = (p) => (p.agency === 'rnsw' ? 'revenue.example' : 'transport.example');
const email = (p) => `${p.name.toLowerCase().replace(/[^a-z ]/g, '').replace(/ /g, '.')}@${domain(p)}`;
const group = (p) => `CEVOC-${p.agency === 'rnsw' ? 'Revenue' : 'Transport'}-${p.role.replace(/[^A-Za-z ]/g, '').replace(/ /g, '-')}`;
const agencyName = (p) => (p.agency === 'rnsw' ? 'Revenue NSW' : 'Transport for NSW');

const STAGES = [
  { id: 'redirect', title: 'CEVOC sends you to your agency’s identity provider', hold: 900 },
  { id: 'idp', title: 'You sign in with your work account', hold: 1100 },
  { id: 'mfa', title: 'You approve the sign-in on your phone', hold: 1300 },
  { id: 'token', title: 'The identity provider sends CEVOC a signed token', hold: 1100 },
  { id: 'verify', title: 'CEVOC checks the token and sets up your role', hold: 800 },
];

function Handshake({ person, onDone, onCancel }) {
  const [i, setI] = useState(0);
  const [match] = useState(() => String(10 + Math.floor(Math.random() * 89)));
  const timer = useRef(null);
  useEffect(() => {
    if (i >= STAGES.length) { onDone(); return undefined; }
    timer.current = setTimeout(() => setI((x) => x + 1), STAGES[i].hold);
    return () => clearTimeout(timer.current);
  }, [i]); // eslint-disable-line
  const stage = STAGES[Math.min(i, STAGES.length - 1)].id;
  const idp = stage !== 'redirect';
  return (
    <div className="sso2" role="region" aria-label="Simulated single sign-on">
      <p className="sso2-banner"><strong>Prototype.</strong> A simulated sign-in handshake. Nothing is asked for, captured or stored, and no real identity provider is contacted.</p>
      <div className="sso2-stage">
        <div className={`sso2-box ${stage === 'redirect' || stage === 'verify' || stage === 'token' ? 'is-on' : ''}`}>
          <span className="sso2-tag">1 · The site</span>
          <AgencyLockup agency={person.agency} />
          <strong>CEVOC staff</strong>
          <small>{stage === 'verify' ? 'Checking your token…' : 'Waiting for you to sign in'}</small>
        </div>
        <div className={`sso2-wire is-${stage}`} aria-hidden="true"><i /><i /><i /></div>
        <div className={`sso2-box sso2-idp ${idp && stage !== 'token' && stage !== 'verify' ? 'is-on' : ''}`}>
          <span className="sso2-tag">2 · Identity provider (simulated)</span>
          {idp ? (
            <>
              <strong>{agencyName(person)} sign-in</strong>
              <div className="sso2-acct"><span className="sso2-av" aria-hidden="true">{person.name.split(' ').map((n) => n[0]).join('')}</span><span><b>{person.name}</b><small>{email(person)} (fictional)</small></span></div>
              {stage === 'idp' && <p className="sso2-status"><span className="sso2-spin" aria-hidden="true" />Checking your work account…</p>}
              {stage === 'mfa' && <p className="sso2-status">Approve on your phone. Number shown: <b className="sso2-num">{match}</b></p>}
              {(stage === 'token' || stage === 'verify') && <p className="sso2-status is-ok">✓ Verified. Sending you back.</p>}
            </>
          ) : <small>Not contacted yet</small>}
        </div>
      </div>

      {(stage === 'token' || stage === 'verify') && (
        <div className="sso2-token" aria-label="Example token contents">
          <strong>What CEVOC receives (invented example)</strong>
          <dl>
            <div><dt>Name</dt><dd>{person.name}</dd></div><div><dt>Agency</dt><dd>{agencyName(person)}</dd></div>
            <div><dt>Role</dt><dd>{person.role}</dd></div><div><dt>Group</dt><dd>{group(person)}</dd></div>
            <div><dt>Issued by</dt><dd>identity provider (simulated)</dd></div><div><dt>Password shared</dt><dd>None</dd></div>
          </dl>
        </div>
      )}

      <ol className="sso2-steps" aria-label="Sign-in steps">
        {STAGES.map((s, k) => <li key={s.id} className={k < i ? 'is-done' : k === i ? 'is-now' : ''} aria-current={k === i ? 'step' : undefined}><span aria-hidden="true">{k < i ? '✓' : k + 1}</span>{s.title}</li>)}
      </ol>
      <div className="sso2-bar" role="progressbar" aria-label="Sign-in progress" aria-valuemin="0" aria-valuemax={STAGES.length} aria-valuenow={Math.min(i, STAGES.length)}><i style={{ width: `${(Math.min(i, STAGES.length) / STAGES.length) * 100}%` }} /></div>
      <p className="sr-only" aria-live="polite">{i < STAGES.length ? `Step ${i + 1} of ${STAGES.length}: ${STAGES[i].title}` : `Signed in. Taking you to ${agencyName(person)}.`}</p>
      <div className="sso2-act"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="button" variant="outline" onClick={() => { clearTimeout(timer.current); onDone(); }}>Skip the animation</Button></div>
    </div>
  );
}

export default function SignIn({ onPick }) {
  const [person, setPerson] = useState(null);
  const [running, setRunning] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [open, setOpen] = useState(true);

  if (running && person) return <main className="st-signin"><div className="st-signin__card sso2-card"><h1>Signing in to {agencyName(person)}</h1><Handshake person={person} onCancel={() => setRunning(false)} onDone={() => onPick(person.id)} /></div></main>;

  return (
    <main className="st-signin st-signin--split">
      <div className="st-signin__card">
        <div className="st-orgs"><AgencyLockup agency="tfnsw" /><span className="st-div" /><AgencyLockup agency="rnsw" /></div>
        <h1>Staff sign in</h1>
        <p>For Transport for NSW and Revenue NSW staff. You sign in once with your work account, and we never see your password.</p>
        <Button type="button" className="st-sso-btn" onClick={() => { if (!person) { setNudge(true); setOpen(true); } else setRunning(true); }}>Sign in with your work account</Button>
        {person && <p className="st-muted" role="status">Signing in as <strong>{person.name}</strong>, {person.role} ({person.agency === 'rnsw' ? 'Revenue' : 'Transport'}).</p>}
        <p className="st-muted">Coming from your own Transport or Revenue NSW system signs you in automatically.</p>
      </div>

      <aside className={`st-proto ${nudge && !person ? 'is-nudge' : ''}`} aria-label="Sample people for the prototype">
        <button type="button" className="st-proto__h" aria-expanded={open} onClick={() => setOpen(!open)}>PROTOTYPE · WHO IS SIGNING IN? <span aria-hidden="true">{open ? '▾' : '▸'}</span></button>
        {open && (
          <>
            <p className="st-muted">Sample people only. Pick one, then press the sign-in button on the left. Not a real sign-in.{nudge && !person ? ' Choose a person first.' : ''}</p>
            {['rnsw', 'tfnsw'].map((ag) => (
              <div key={ag} role="group" aria-label={ag === 'rnsw' ? 'Revenue NSW people' : 'Transport for NSW people'}>
                <p className="st-proto__ag">{ag === 'rnsw' ? 'Revenue NSW' : 'Transport for NSW'}</p>
                {STAFF.filter((p) => p.agency === ag).map((p) => (
                  <button key={p.id} type="button" className={`st-persona ${person?.id === p.id ? 'is-on' : ''}`} aria-pressed={person?.id === p.id} onClick={() => { setPerson(p); setNudge(false); }}>
                    <span className={`org ${p.agency}`}>{p.agency === 'rnsw' ? 'Revenue' : 'Transport'}</span>
                    <span><strong>{p.name}</strong><small>{p.role}</small></span>
                    <span aria-hidden="true">{person?.id === p.id ? '✓' : '›'}</span>
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
      </aside>
    </main>
  );
}
