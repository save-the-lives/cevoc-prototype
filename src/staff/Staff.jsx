import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, AgencyLockup, Spinner } from '../shared/ui.jsx';
import MediaGallery from '../shared/MediaGallery.jsx';
import StaffShell from './shell/StaffShell.jsx';
import { OUTCOMES } from './case/outcomes.js';
import WorkQueue from './queue/WorkQueue.jsx';
import ApprovalsQueue from './queue/ApprovalsQueue.jsx';
import Dashboard from './dashboard/Dashboard.jsx';
import CertificateRegister from './certs/CertificateRegister.jsx';
import CameraList from './certs/CameraList.jsx';
import TechInbox from './tech/TechInbox.jsx';
import TechRequest from './tech/TechRequest.jsx';
import WorkSummary, { CertAlerts } from './shell/WorkSummary.jsx';
import AdviceBlock from './queue/AdviceBlock.jsx';
import { activeRequest, affectedCases, validationOf } from '../lib/workflow.js';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { evaluate, scorecard, impactOf, daysBetween } from '../lib/rules.js';
import { planFaults } from '../lib/faults.js';
import { useSim } from '../lib/useSim.js';
import { NOTICES, SITES, CERTS, CASES, STAFF, PROGRAMS, WITHDRAW_REASONS, notice as findNotice, site as findSite, cert as findCert, kase as findCase, staff as findStaff } from '../data.js';
import { TODAY, fmtDate, fmtTime } from '../lib/format.js';

// STAFF WORKSPACE: shared by Transport and Revenue NSW. Same layout; role decides the actions.
// Evidence first, scorecard on top, everything else loads behind it without blocking.

const can = (u, p) => !!u && u.perms.includes(p);
const isT = (u) => u?.agency === 'tfnsw';

/* ---------- Sign-in (mock SSO, no passwords) ---------- */

function SignIn({ onPick }) {
  return (
    <div className="st-signin">
      <div className="st-signin__card">
        <div className="st-orgs"><AgencyLockup agency="tfnsw" /><span className="st-div" /><AgencyLockup agency="rnsw" /></div>
        <h1>Staff sign in</h1>
        <p>For Transport for NSW and Revenue NSW staff. Use your work account.</p>
        <div className="st-signin__mock">
          <div className="snp-strip">PROTOTYPE · CHOOSE A SAMPLE USER · NO PASSWORDS</div>
          {STAFF.map((p) => (
            <button key={p.id} type="button" className="st-persona" onClick={() => onPick(p.id)}>
              <span className={`org ${p.agency}`}>{p.agency === 'rnsw' ? 'RNSW' : 'TfNSW'}</span>
              <span><strong>{p.name}</strong><small>{p.role}</small></span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <p className="st-muted">Coming from your own Transport or Revenue NSW system signs you in automatically.</p>
      </div>
    </div>
  );
}

/* ---------- Search ---------- */

/* ---------- Shared pieces ---------- */

function useVisit(label, to) {
  const { dispatch } = useStore();
  useEffect(() => { dispatch({ type: 'visit', ref: { label, to } }); }, [to]); // eslint-disable-line
}

// Scorecard: risks first and in full, everything that passed folded into one quiet line.
const CONSEQUENCE = {
  Certification: 'Not current on the day, so upholding may not survive a challenge.',
  Evidence: 'The evidence may not be enough to uphold this fine.',
};

function Scorecard({ n, certFault }) {
  const { statusOf } = useStore();
  const sc = scorecard(n, statusOf);
  const { status, retry } = useSim(certFault, 600, [n.number]);
  const certReady = status === 'ready';
  const shown = sc.checks.map((c) => (c.group === 'Certification' && !certReady ? { ...c, pending: true } : c));
  const risks = shown.filter((c) => !c.ok && !c.pending).sort((a, b) => (a.group === 'Certification' ? -1 : 0) - (b.group === 'Certification' ? -1 : 0));
  const pending = shown.filter((c) => c.pending);
  const passed = shown.filter((c) => c.ok && !c.pending);
  const tone = pending.length ? 'pending' : risks.length ? 'risk' : 'ok';
  const headline = pending.length ? (status === 'error' ? 'Certificate check failed' : 'Checking certificates…') : risks.length ? `${risks.length} ${risks.length === 1 ? 'risk' : 'risks'} to resolve` : 'All checks passed';
  const sub = pending.length ? `${passed.length} of ${sc.total} checked so far` : risks.length ? `${passed.length} of ${sc.total} checks passed` : `${sc.total} of ${sc.total} checks valid`;
  const segs = [...risks.map(() => 'risk'), ...pending.map(() => 'pending'), ...passed.map(() => 'ok')];

  return (
    <section className={`sc2 sc2--${tone}`} aria-label="Evidence validation">
      <header className="sc2-head">
        <span className="sc2-icon" aria-hidden="true">{tone === 'ok' ? '✓' : tone === 'risk' ? '!' : '…'}</span>
        <div className="sc2-title"><strong>{headline}</strong><span>{sub}</span></div>
        <div className="sc2-bar" role="img" aria-label={sub}>{segs.map((k, i) => <i key={i} className={`is-${k}`} />)}</div>
        {status === 'error' && <button type="button" className="st-btn ghost" onClick={retry}>Retry</button>}
      </header>

      {risks.length > 0 && (
        <ul className="sc2-risks">
          {risks.map((c) => (
            <li key={c.label}>
              <span className="sc2-risk__icon" aria-hidden="true">!</span>
              <div>
                <strong>{c.label}</strong>
                <p>{c.cert ? <Link to={`/staff/cert/${c.cert.id}`}>{c.detail}</Link> : c.detail}</p>
                <p className="sc2-risk__why">{CONSEQUENCE[c.group]}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 && status !== 'error' && <div className="skel sc2-skel"><i /><i /></div>}

      {passed.length > 0 && (
        <details className="sc2-pass">
          <summary>
            <span className="sc2-pass__tick" aria-hidden="true">✓</span>
            <span className="sc2-pass__txt">{passed.length} {passed.length === 1 ? 'check' : 'checks'} passed</span>
            <span className="sc2-pass__chips" aria-hidden="true">{passed.map((c) => <em key={c.label}>{c.label}</em>)}</span>
            <span className="sc2-pass__more">Details</span>
          </summary>
          <ul>
            {passed.map((c) => (
              <li key={c.label}><span aria-hidden="true">✓</span><strong>{c.label}</strong><small>{c.cert ? <Link to={`/staff/cert/${c.cert.id}`}>{c.detail}</Link> : c.detail}</small></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Metadata({ n, fault }) {
  const s = findSite(n.site);
  const { status, retry } = useSim(fault, 1100, [n.number]);
  const rows = [
    ['Device serial', s.serial], ['Lane', '2 of 3'], ['Plate read', `${n.rego} · ${Math.round(n.plateConfidence * 100)}%`],
    ['Time source', 'GPS, offset +0.2 s'], ['Image hash', 'SHA-256 verified (mock)'], ['Ingested', `${fmtDate(n.dateTime)} +4 min`],
    n.segment && ['Point A → B', `${n.segment.timeA} → ${n.segment.timeB}`], n.redFor && ['Red time', `${n.redFor} s`],
    n.personChecked && ['Person check', 'Adjudicator ADJ-0412'],
  ].filter(Boolean);
  return (
    <div className="st-card">
      <h3>Camera metadata {status !== 'ready' && status !== 'error' && <Spinner />}</h3>
      {status === 'error' ? <p>Metadata unavailable. <button type="button" className="st-link" onClick={retry}>Retry</button></p>
        : status !== 'ready' ? <div className="skel"><i /><i /><i /><i /></div>
        : <dl className="st-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {status === 'slow' && <p className="st-muted">Slow response from the camera system. Evidence above is ready to review.</p>}
    </div>
  );
}

function Audit({ refs }) {
  const { state } = useStore();
  const list = state.audit.filter((a) => refs.includes(a.ref));
  return (
    <div className="st-card">
      <h3>Activity</h3>
      {list.length ? <ol className="st-audit">{list.map((a, i) => <li key={i}><time>{a.at}</time> {findStaff(a.who)?.name || a.who}: {a.what}</li>)}</ol> : <p className="st-muted">No activity yet.</p>}
    </div>
  );
}

function NotForYou({ what = 'approvals' }) {
  return (
    <div className="st-card">
      <h1>{what === 'queue' ? 'The review queue belongs to Revenue NSW' : 'Approvals aren’t part of your role'}</h1>
      <p className="st-muted">{what === 'queue' ? 'Transport receives only the technical questions Revenue NSW asks. You can see them in Technical requests.' : 'Certificate withdrawals are approved by a camera program manager. You can still request a withdrawal from a certificate page, and it will wait here for them.'}</p>
      <Link to="/staff">Back to your work</Link>
    </div>
  );
}

function Handoff({ to, what }) {
  return <p className="st-handoff"><span className="owner-tag">{to}</span> {what}</p>;
}

/* ---------- Evidence workspace (notice + case share it) ---------- */

function EvidenceView({ n, aside, header }) {
  const { faultSettings } = useStore();
  const plan = useMemo(() => planFaults(n, faultSettings), [n.number, JSON.stringify(faultSettings)]); // eslint-disable-line
  const s = findSite(n.site);
  return (
    <div className="ev">
      <div className="ev-head">
        {header}
        <div className="ev-facts">
          <span><b>{PROGRAMS[s.program].label}</b></span>
          <span>{fmtDate(n.dateTime)} {fmtTime(n.dateTime)}</span>
          <span><Link to={`/staff/camera/${s.code}`}>{s.code}</Link> · {s.name}</span>
          <span>{n.rego} · {n.vehicle}</span>
          <span>{n.segment ? `${n.speed} km/h avg over ${n.segment.distanceKm} km` : n.redFor ? `Red ${n.redFor}s · ${n.speed} km/h` : n.speed ? `${n.speed} km/h in ${s.limit}` : 'Person-checked'}</span>
        </div>
      </div>
      <div className="ev-body">
        <div className="ev-media">
          <MediaGallery items={n.media} plan={plan} prefix={n.number} variant="staff" />
        </div>
        <aside className="ev-side">
          <Scorecard n={n} certFault={plan.certs} />
          {aside}
          <Metadata n={n} fault={plan.meta} />
        </aside>
      </div>
    </div>
  );
}

function NoticeRecord({ number, user }) {
  const n = findNotice(number);
  useVisit(`Notice ${number}`, `/staff/notice/${number}`);
  if (!n) return <p>Notice {number} not found.</p>;
  const cases = CASES.filter((c) => c.notice === n.number);
  return (
    <EvidenceView n={n}
      header={<div className="st-rec-head"><span className="st-type">Notice</span><h1>{n.number}</h1><span className="st-muted">{n.offence} · {n.holder}</span></div>}
      aside={
        <>
          <div className="st-card">
            <h3>Cases</h3>
            {cases.length ? cases.map((c) => <p key={c.id}><Link to={`/staff/case/${c.id}`}>{c.id}</Link> · {c.type === 'court' ? 'Court election' : 'Review'} · {fmtDate(c.lodged)}</p>) : <p className="st-muted">No review or court election.</p>}
            {!can(user, 'case:decide') && <Handoff to="Revenue NSW" what="Reviews, payments and court elections are handled in Revenue NSW systems." />}
          </div>
          <Audit refs={[n.number, ...cases.map((c) => c.id)]} />
        </>
      } />
  );
}


function ExternalBanner({ query, id }) {
  if (query?.from !== 'external') return null;
  return (
    <div className="ext-banner" role="status">
      <p><strong>Opened from the Revenue NSW case system (simulated).</strong> Source reference {query.ref || 'RCM-558201'} · case {id}. Nothing is connected: this is a prototype stand-in.</p>
      <Link to={`/source/revenue?case=${id}`}>← Return to the source system</Link>
    </div>
  );
}

function CaseRecord({ id, user, query }) {
  const { state, dispatch, statusOf, faultSettings } = useStore();
  const [out, setOut] = useState('');
  const [reason, setReason] = useState('');
  const k = findCase(id);
  useVisit(`Case ${id}`, `/staff/case/${id}`);
  if (!k) return <p>Case {id} not found.</p>;
  const n = findNotice(k.notice);
  const ev = evaluate(n, statusOf);
  const done = state.decisions[id];
  const opts = OUTCOMES[k.type];
  const label = opts.find((o) => o[0] === out)?.[1];
  const req = activeRequest(state.tech, id);
  const waiting = req && req.status !== 'ADVICE_RECEIVED';
  const sim = useSim(planFaults(n, faultSettings).certs, 600, [n.number]);
  const validation = validationOf(ev, sim.status);

  const decision = (
    <div className="st-card st-actions">
      <h2 className="st-h3">Decision</h2>
      {done ? (
        <div className="st-done"><strong>{done.label}</strong><p>{done.reason}</p><p className="st-muted">By {findStaff(done.by)?.name}</p>{can(user, 'case:decide') && <button type="button" className="st-btn ghost" onClick={() => dispatch({ type: 'reopen', id, by: user.id })}>Reopen</button>}</div>
      ) : can(user, 'case:decide') ? (
        <>
          <AdviceBlock k={k} n={n} ev={ev} user={user} onUse={setReason} />
          {!ev.current && <p className="st-flag">{ev.notCurrent} certificate not current on the day. Upholding may not survive a challenge.</p>}
          {waiting ? <p className="st-muted">Waiting for Transport’s advice. Cancel the request to decide without it.</p> : <>
          {opts.map(([v, l]) => <label key={v} className="st-radio"><input type="radio" name="o" checked={out === v} onChange={() => setOut(v)} /> {l}</label>)}
          <label className="st-label">Reason (in the customer letter)<textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          {out && reason.trim().length > 9 && (
            <pre className="st-letter">{`Dear ${n.holder},\n\nThank you for your ${k.type === 'court' ? 'court election' : 'review request'} for penalty notice ${n.number}. We looked carefully at what you told us and at the camera evidence.\n\nOutcome: ${label}.\n${reason.trim()}\n\nRevenue NSW (MOCK, NOT SENT)`}</pre>
          )}
          <button type="button" className="st-btn" disabled={!out || reason.trim().length < 10} onClick={() => dispatch({ type: 'decide', id, d: { label, reason: reason.trim(), by: user.id } })}>Record decision</button>
          </>}
        </>
      ) : (
        <>
          <Handoff to="Revenue NSW" what="The decision is made by a Revenue NSW officer. Transport advises through Technical requests." />
          {req && <AdviceBlock k={k} n={n} ev={ev} user={user} />}
        </>
      )}
    </div>
  );

  return (
    <EvidenceView n={n}
      header={
        <>
          <ExternalBanner query={query} id={k.id} />
          {query?.from === 'external' && <p className={`st-validation is-${validation.tone}`} role="status"><strong>CEVOC validation: {validation.label}.</strong> {validation.short}.</p>}
          <div className="st-rec-head"><span className="st-type">{k.type === 'court' ? 'Court election' : 'Review'}</span><h1>{k.id}</h1>
            <span className="st-muted">Notice <Link to={`/staff/notice/${n.number}`}>{n.number}</Link> · lodged {fmtDate(k.lodged)} ({daysBetween(k.lodged, TODAY)} days ago)</span></div>
          <blockquote className="st-quote">“{k.grounds}”<cite>{n.holder} · {k.channel}</cite></blockquote>
        </>
      }
      aside={<>{decision}<Audit refs={[id]} /></>} />
  );
}

function CameraRecord({ code }) {
  const { statusOf } = useStore();
  const s = findSite(code);
  useVisit(`Camera ${code}`, `/staff/camera/${code}`);
  if (!s) return <p>Camera {code} not found.</p>;
  const certs = CERTS.filter((c) => c.site === code).sort((a, b) => b.date.localeCompare(a.date));
  const fines = NOTICES.filter((n) => n.site === code);
  return (
    <>
      <div className="st-rec-head"><span className="st-type">Camera</span><h1>{s.code}</h1><span className="st-muted">{s.name} · {PROGRAMS[s.program].label}</span></div>
      <div className="st-grid">
        <div className="st-card st-wide">
          <h3>Certificates</h3>
          <table className="st-table">
            <thead><tr><th>Certificate</th><th>Section</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>{certs.map((c) => <tr key={c.id}><td><Link to={`/staff/cert/${c.id}`}>{c.id}</Link></td><td>{c.section}{c.point ? ` ${c.point}` : ''}{c.session ? ' (session)' : ''}</td><td>{fmtDate(c.date)}</td><td><span className={`tag ${statusOf(c) === 'withdrawn' ? 'tag-warn' : 'tag-ok'}`}>{statusOf(c) === 'withdrawn' ? 'Withdrawn' : 'On record'}</span></td></tr>)}</tbody>
          </table>
        </div>
        <div className="st-card st-wide">
          <h3>Notices from this camera</h3>
          <table className="st-table">
            <thead><tr><th>Notice</th><th>Date</th><th>Certification</th></tr></thead>
            <tbody>{fines.map((n) => { const ev = evaluate(n, statusOf); return <tr key={n.number} className="st-click" onClick={() => go(`/staff/notice/${n.number}`)}><td><Link to={`/staff/notice/${n.number}`}>{n.number}</Link></td><td>{fmtDate(n.dateTime)}</td><td><span className={`tag ${ev.current ? 'tag-ok' : 'tag-warn'}`}>{ev.current ? 'Current' : `${ev.notCurrent} not current`}</span></td></tr>; })}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function WithdrawFlow({ c, user, kind, onDone }) {
  const { dispatch, statusOf } = useStore();
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const impact = impactOf(c.id, NOTICES, statusOf);
  const broken = impact.filter((x) => x.before.current && !x.after.current);
  const cases = CASES.filter((k) => broken.some((x) => x.n.number === k.notice));
  const submit = () => {
    dispatch({ type: 'request', req: { id: `${c.id}-${Date.now()}`, cert: c.id, kind, by: user.id, reason: reason + (note ? ` (${note})` : ''), affected: broken.length } });
    onDone();
  };
  return (
    <div className="st-flow">
      <ol className="st-steps">{['Reason', 'Impact', 'Submit'].map((t, i) => <li key={t} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}>{i + 1}. {t}</li>)}</ol>
      {step === 1 && (
        <>
          <label className="st-label">Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose…</option>
              {(kind === 'withdrawal' ? WITHDRAW_REASONS : ['Withdrawn in error', 'Fault resolved, certificate valid', 'Other']).map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="st-label">Note (optional)<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="st-row"><button type="button" className="st-btn ghost" onClick={onDone}>Cancel</button><button type="button" className="st-btn" disabled={!reason} onClick={() => setStep(2)}>Next: impact</button></div>
        </>
      )}
      {step === 2 && (
        <>
          {kind === 'withdrawal' ? (
            <>
              <p><strong>{broken.length}</strong> notice{broken.length === 1 ? '' : 's'} would no longer have current certification. <strong>{cases.length}</strong> open case{cases.length === 1 ? '' : 's'} affected.</p>
              <ul className="st-impact">
                {impact.map(({ n, before, after }) => (
                  <li key={n.number}><Link to={`/staff/notice/${n.number}`}>{n.number}</Link>
                    <span className={`tag ${before.current ? 'tag-ok' : 'tag-warn'}`}>{before.current ? 'Current' : 'Not current'}</span>→
                    <span className={`tag ${after.current ? 'tag-ok' : 'tag-warn'}`}>{after.current ? 'Current' : 'Not current'}</span></li>
                ))}
                {!impact.length && <li className="st-muted">No notices rely on this certificate.</li>}
              </ul>
              <p className="st-muted">Public pages for these notices and this camera will update straight away.</p>
            </>
          ) : <p>Restoring makes this certificate count again for every notice that relies on it.</p>}
          <div className="st-row"><button type="button" className="st-btn ghost" onClick={() => setStep(1)}>Back</button><button type="button" className="st-btn" onClick={() => setStep(3)}>Next</button></div>
        </>
      )}
      {step === 3 && (
        <>
          <p>A second person with approval rights must approve this before it takes effect. Revenue NSW is notified automatically.</p>
          <div className="st-row"><button type="button" className="st-btn ghost" onClick={() => setStep(2)}>Back</button><button type="button" className="st-btn danger" onClick={submit}>Submit for approval</button></div>
        </>
      )}
    </div>
  );
}

function CertRecord({ id, user }) {
  const { state, dispatch, statusOf } = useStore();
  const [flow, setFlow] = useState(false);
  const c = findCert(id);
  useVisit(`Certificate ${id}`, `/staff/cert/${id}`);
  if (!c) return <p>Certificate {id} not found.</p>;
  const s = findSite(c.site);
  const status = statusOf(c);
  const pend = state.pending.find((p) => p.cert === id);
  const users = NOTICES.filter((n) => evaluate(n, statusOf).items.some((i) => i.cert?.id === id));

  return (
    <div className="st-split">
      <div>
        <div className="st-rec-head"><span className="st-type">Certificate</span><h1>{c.id}</h1><span className={`tag ${status === 'withdrawn' ? 'tag-warn' : 'tag-ok'}`}>{status === 'withdrawn' ? 'Withdrawn' : 'On record'}</span></div>
        <div className="st-card">
          <dl className="st-kv">
            {[['Section', c.section + (c.point ? ` (point ${c.point})` : '') + (c.session ? ' (pre-session)' : '')], ['Camera', `${s.code} · ${s.name}`], ['Date', `${fmtDate(c.date)}${c.time ? ` ${c.time}` : ''}`], ['Signed by', c.officer], ['Device serial', s.serial], c.distanceKm && ['Surveyed distance', `${c.distanceKm} km`]].filter(Boolean).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
        <div className="st-card">
          <h3>Notices relying on this certificate ({users.length})</h3>
          {users.length ? <ul className="st-list">{users.map((n) => <li key={n.number}><Link to={`/staff/notice/${n.number}`}>{n.number}</Link> · {fmtDate(n.dateTime)}</li>)}</ul> : <p className="st-muted">None currently.</p>}
        </div>
        <Audit refs={[id]} />
      </div>
      <aside className="st-card st-actions">
        <h3>Actions</h3>
        {pend ? (
          <div className="st-pending">
            <p><strong>Pending {pend.kind}</strong><br />Requested by {findStaff(pend.by)?.name}<br />{pend.reason}<br />{pend.affected} notice(s) affected</p>
            {can(user, 'withdraw:approve') && pend.by !== user.id ? (
              <div className="st-row">
                <button type="button" className="st-btn ghost" onClick={() => dispatch({ type: 'reject', id: pend.id, by: user.id })}>Reject</button>
                <button type="button" className="st-btn danger" onClick={() => dispatch({ type: 'approve', id: pend.id, by: user.id, cases: affectedCases(pend.cert, (x) => state.certStatus[x.id] || x.status, state.decisions) })}>Approve</button>
              </div>
            ) : <p className="st-muted">{pend.by === user.id ? 'Waiting for someone else to approve.' : 'You don’t have approval rights.'}</p>}
          </div>
        ) : flow ? (
          <WithdrawFlow c={c} user={user} kind={status === 'withdrawn' ? 'restoration' : 'withdrawal'} onDone={() => setFlow(false)} />
        ) : can(user, 'withdraw:request') ? (
          <button type="button" className={`st-btn ${status === 'withdrawn' ? '' : 'danger'}`} onClick={() => setFlow(true)}>{status === 'withdrawn' ? 'Restore certificate…' : 'Withdraw certificate…'}</button>
        ) : <Handoff to="Transport for NSW" what="Certificates are withdrawn by Transport camera operations." />}
      </aside>
    </div>
  );
}

function TechRequestPage({ id, user }) {
  const { state, faultSettings } = useStore();
  const r = state.tech.find((x) => x.id === id);
  const n = r && findNotice(r.notice);
  const plan = useMemo(() => (n ? planFaults(n, faultSettings) : {}), [n?.number, JSON.stringify(faultSettings)]); // eslint-disable-line
  return <TechRequest id={id} user={user} slots={{ Scorecard, Metadata, plan }} />;
}

export default function StaffSite({ parts, query }) {
  const { state, dispatch } = useStore();
  const user = findStaff(state.user);

  useEffect(() => {
    if (query.from !== 'app' && query.from !== 'external' && query.sso !== 'trusted') return;
    const want = findStaff(query.as)?.id || user?.id || 'alex';
    if (!user || user.id !== want) dispatch({ type: 'signIn', id: want });
  }, [query.from, query.sso, query.as]); // eslint-disable-line

  if (!user) return <SignIn onPick={(id) => dispatch({ type: 'signIn', id })} />;

  const [, a, b] = parts;
  const rnsw = user.agency === 'rnsw';
  const unresolved = CASES.filter((c) => !state.decisions[c.id]);
  const mineOpen = unresolved.filter((c) => (c.id in state.assign ? state.assign[c.id] : c.assignee) === user.id).length;
  const awaiting = new Set(state.tech.filter((t) => t.status === 'AWAITING_TRANSPORT' || t.status === 'MORE_INFORMATION_REQUIRED').map((t) => t.caseId)).size;
  const approvals = state.pending.length;
  const canApprove = can(user, 'withdraw:approve');
  let body;
  if (a === 'notice') body = <NoticeRecord key={b} number={b} user={user} />;
  else if (a === 'case') body = <CaseRecord key={b} id={b} user={user} query={query} />;
  else if (a === 'camera') body = <CameraRecord code={b} />;
  else if (a === 'cert') body = <CertRecord key={b} id={b} user={user} />;
  else if (a === 'certificates') body = <CertificateRegister />;
  else if (a === 'cameras') body = <CameraList user={user} />;
  else if (a === 'request') body = <TechRequestPage key={b} id={b} user={user} />;
  else if (a === 'requests') body = rnsw ? <NotForYou what="queue" /> : <TechInbox key={query.view || 'open'} user={user} view={query.view || 'open'} />;
  else if (a === 'queue' && b === 'approvals') body = <ApprovalsQueue canApprove={canApprove} user={user} />;
  else if (a === 'queue') body = rnsw ? <><CertAlerts /><WorkQueue key={`${b}|${query.q || ''}|${query.view || ''}`} name={b} user={user} initialQuery={query.q || ''} view={query.view || ''} /></> : <NotForYou what="queue" />;
  else if (a === 'insights') body = <Dashboard user={user} canApprove={canApprove} />;
  else body = rnsw ? <><CertAlerts /><WorkSummary user={user} /><WorkQueue key="home" name="reviews" user={user} /></> : <><WorkSummary user={user} /><TechInbox key="home" user={user} view="open" /></>;

  return (
    <StaffShell user={user} parts={parts} query={query} counts={{ mine: mineOpen, awaiting, completed: CASES.length - unresolved.length, techOpen: state.tech.filter((t) => t.status === 'AWAITING_TRANSPORT').length, approvals, certs: CERTS.length }} canApprove={canApprove} hotApprovals={approvals > 0 && canApprove}
      onSwitch={(id) => { dispatch({ type: 'signIn', id }); go('/staff'); }} onSignOut={() => { dispatch({ type: 'signOut' }); go('/staff'); }}>
      {body}
    </StaffShell>
  );
}
