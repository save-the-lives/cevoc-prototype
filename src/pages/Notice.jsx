import React, { useRef, useState } from 'react';
import { Link, Button, Alert, Breadcrumbs, Steps, Field, SummaryList, StatusTag, Dialog } from '../components/ui.jsx';
import { Skeleton, SlowNote, Problem } from '../components/Feedback.jsx';
import Gallery from '../components/Gallery.jsx';
import VideoPlayer from '../components/Media.jsx';
import { useApp, apiCtx } from '../state.js';
import { api, applicableOn } from '../services/mockApi.js';
import { useAsync } from '../useAsync.js';
import { useAssets, resolveImage } from '../services/assets.js';
import { go } from '../router.js';
import { fmtDate, fmtDateTime, TODAY } from '../format.js';
import { SAMPLES } from '../data/mockData.js';
import { programFor, ACTIONS } from '../config/programs.js';
import { query, daysBetween, daysFromToday, weekday, partOfDay, agoText } from '../util.js';

const STEPS = ['Enter notice details', 'See what happened', 'Decide what to do'];

export function NoticeLookup({ path }) {
  const app = useApp();
  const q = query(path);
  const [number, setNumber] = useState(q.n || '');
  const [rego, setRego] = useState(q.r || '');
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null); // null | 'nomatch' | Error
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef(null);

  const validate = () => {
    const e = {};
    const n = number.replace(/\s/g, '');
    if (!n) e.number = 'Enter your penalty notice number';
    else if (!/^\d{10}$/.test(n)) e.number = 'Penalty notice number must be 10 digits';
    const r = rego.replace(/\s/g, '');
    if (!r) e.rego = 'Enter the vehicle registration number';
    else if (!/^[A-Za-z0-9]{2,9}$/.test(r)) e.rego = 'Registration must be 2 to 9 letters or numbers';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setResult(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      const notice = await api.lookupNotice(apiCtx(app), number.replace(/\s/g, ''), rego);
      if (!notice) setResult('nomatch');
      else {
        app.setNotice(notice);
        go('/notice/result');
      }
    } catch (err) {
      setResult(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nsw-container cevoc-page">
      <Breadcrumbs items={[['Home', '/'], ['View your offence', '/notice']]} />
      <h1>View your offence</h1>
      <Steps current={1} steps={STEPS} />

      {Object.keys(errors).length > 0 && (
        <div className="nsw-in-page-alert nsw-in-page-alert--error" tabIndex={-1} ref={summaryRef} role="alert">
          <div className="nsw-in-page-alert__content">
            <h3 className="nsw-in-page-alert__title">There is a problem</h3>
            <ul>
              {Object.entries(errors).map(([k, msg]) => (
                <li key={k}>
                  <a href="#/notice" onClick={(e) => { e.preventDefault(); document.getElementById(k)?.focus(); }}>{msg}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {result === 'nomatch' && (
        <Alert type="warning" title="We couldn’t find a matching offence">
          <p>Check that the penalty notice number and registration match your notice exactly. For your security we don’t say which detail didn’t match.</p>
        </Alert>
      )}
      {result instanceof Error && <Problem error={result} onRetry={() => setResult(null)} />}

      <div className="cevoc-two-col">
        <form className="nsw-form cevoc-panel" onSubmit={submit} noValidate>
          <Field id="number" label="Penalty notice number" hint="10 digits, at the top of your notice" error={errors.number}>
            <input id="number" className="nsw-form__input" inputMode="numeric" autoComplete="off" value={number} onChange={(e) => setNumber(e.target.value)} aria-invalid={!!errors.number} aria-describedby={`number-hint${errors.number ? ' number-error' : ''}`} style={{ maxWidth: '16rem' }} />
          </Field>
          <Field id="rego" label="Vehicle registration number" hint="As shown on the notice, for example ABC12D" error={errors.rego}>
            <input id="rego" className="nsw-form__input" autoComplete="off" value={rego} onChange={(e) => setRego(e.target.value.toUpperCase())} aria-invalid={!!errors.rego} aria-describedby={`rego-hint${errors.rego ? ' rego-error' : ''}`} style={{ maxWidth: '12rem' }} />
          </Field>
          <button type="submit" className="nsw-button nsw-button--dark" disabled={busy}>
            {busy ? 'Checking…' : 'Show me what happened'}
          </button>
          <SlowNote active={busy} />
        </form>
        <aside className="cevoc-trust">
          <h2>Is this genuine?</h2>
          <ul>
            <li>This page only asks for two details from your notice.</li>
            <li>It never asks for card details and you can’t pay here.</li>
            <li>Payments, reviews and nominations happen with Revenue NSW.</li>
          </ul>
        </aside>
      </div>

      <details className="nsw-accordion">
        <summary>Prototype sample notices</summary>
        <ul>
          {SAMPLES.map((s) => (
            <li key={s.number}>
              <button type="button" className="cevoc-linkbutton" onClick={() => { setNumber(s.number); setRego(s.rego); setErrors({}); setResult(null); }}>
                Use {s.number} / {s.rego}
              </button>{' '}
              – {s.label}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function RevenueHandoff({ action, onClose }) {
  const a = ACTIONS[action] || { title: 'Return to Revenue NSW', text: '' };
  return (
    <Dialog title={a.title} onClose={onClose}>
      <p>{a.text}</p>
      <p>In the target service this opens Revenue NSW with your notice reference already filled in, so you don’t have to start again.</p>
      <Alert type="info"><p>Prototype only: Revenue NSW is not connected.</p></Alert>
      <Button onClick={onClose}>Close</Button>
    </Dialog>
  );
}

function DueBanner({ n }) {
  if (n.status === 'review')
    return (
      <Alert type="info" title="Your review request is being considered">
        <p>You asked for a review on {fmtDate(n.reviewLodged)}. Revenue NSW will tell you the outcome. You don’t need to do anything else right now.</p>
      </Alert>
    );
  const left = daysFromToday(n.due);
  if (left < 0)
    return (
      <Alert type="warning" title={`The due date (${fmtDate(n.due)}) has passed`}>
        <p>Revenue NSW may send a reminder notice, and extra fees can apply. Contact them about your options as soon as you can.</p>
      </Alert>
    );
  return (
    <Alert type={left <= 7 ? 'warning' : 'info'} title={left === 0 ? 'Due today' : `Due ${fmtDate(n.due)}: ${left} day${left === 1 ? '' : 's'} left`}>
      <p>You have options below, including more time to pay. Acting before the due date avoids extra fees.</p>
    </Alert>
  );
}

function MemoryJog({ n, site }) {
  const ago = daysBetween(n.dateTime, TODAY);
  const lag = daysBetween(n.dateTime, n.issued);
  return (
    <section className="cevoc-jog" aria-labelledby="jog-h">
      <h2 id="jog-h" className="cevoc-jog__h">Don’t remember this trip?</h2>
      <div className="cevoc-jog__grid">
        <div><span className="cevoc-jog__big">{weekday(n.dateTime)}</span><span>{partOfDay(n.dateTime)}, {new Date(n.dateTime).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</span></div>
        <div><span className="cevoc-jog__big">{agoText(ago)}</span><span>{fmtDate(n.dateTime)}</span></div>
        <div><span className="cevoc-jog__big">{site ? site.suburb : '…'}</span><span>{site ? `${site.name}, heading ${site.direction.toLowerCase()}` : 'Loading location'}</span></div>
      </div>
      <p className="cevoc-jog__note">The notice was issued {lag} days after the trip, which is why it may not ring a bell. Check the number plate image below to confirm it was your vehicle.</p>
    </section>
  );
}

function Measurement({ n, program, site }) {
  if (program.measurement === 'average' && n.segment) {
    const s = n.segment;
    return (
      <div className="cevoc-measure">
        <h3>How your average speed was worked out</h3>
        <div className="cevoc-segment">
          <div><strong>{s.pointA}</strong><span>{s.timeA}</span></div>
          <div className="cevoc-segment__line"><span>{s.distanceKm} km</span></div>
          <div><strong>{s.pointB}</strong><span>{s.timeB}</span></div>
        </div>
        <p>
          {s.distanceKm} km in {Math.round(s.distanceKm / n.recordedSpeed * 60)} minutes = <strong>{n.recordedSpeed} km/h average</strong>
          {site && <> in a {site.speedLimit} km/h zone</>}.
        </p>
      </div>
    );
  }
  if (program.measurement === 'signal')
    return (
      <div className="cevoc-measure">
        <h3>What the camera recorded</h3>
        <p>The signal had been red for <strong>{n.redFor ?? '—'} seconds</strong> when the vehicle crossed the stop line{n.recordedSpeed ? <>, travelling at <strong>{n.recordedSpeed} km/h</strong></> : null}.</p>
      </div>
    );
  return null;
}

export function NoticeResult() {
  const app = useApp();
  const manifest = useAssets();
  const [action, setAction] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const n = app.notice;
  const program = programFor(n?.program);

  const site = useAsync(() => (n ? api.getSite(apiCtx(app), n.site) : Promise.resolve(null)), [n?.site, app.demo.outage, app.demo.latency]);
  const certs = useAsync(() => (n ? api.certificatesForSite(apiCtx(app), n.site) : Promise.resolve([])), [n?.site, app.demo.outage, app.demo.latency, app.demo.certOutage, app.overrides]);

  if (!n)
    return (
      <div className="nsw-container cevoc-page">
        <h1>Your session has ended</h1>
        <Alert type="warning" title="Enter your notice details to continue">
          <p>Offence details can only be viewed after your penalty notice number and registration have been checked.</p>
        </Alert>
        <Link className="nsw-button nsw-button--dark" to="/notice">Enter notice details</Link>
      </div>
    );

  const offenceDate = n.dateTime.slice(0, 10);
  const applicable = certs.data ? applicableOn(certs.data, offenceDate) : null;
  const video = n.media[0];

  const retryImages = async () => {
    setRetrying(true);
    try {
      const fresh = await api.lookupNotice(apiCtx(app), n.number, n.rego);
      if (fresh) app.setNotice(fresh);
    } catch (e) {
      /* keep current state */
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="nsw-container cevoc-page">
      <Breadcrumbs items={[['Home', '/'], ['View your offence', '/notice'], ['What happened', '/notice/result']]} />
      <p className="cevoc-eyebrow"><StatusTag status="info" label={program.label} /> Penalty notice {n.number}</p>
      <h1>{n.offence}</h1>
      <Steps current={2} steps={STEPS} />

      {!program.known && (
        <div className="cevoc-proto-note" role="note">
          <strong>Prototype note:</strong> program <code>{n.program}</code> isn’t configured, so the default layout and options are used. Nothing breaks; the gap is flagged for the program team.
        </div>
      )}

      <DueBanner n={n} />
      {program.memoryJog && <MemoryJog n={n} site={site.data} />}

      <section className="cevoc-panel">
        <h2 className="cevoc-h2">The details</h2>
        <SummaryList
          rows={[
            ['Offence', n.offence],
            ['Date and time', fmtDateTime(n.dateTime)],
            ['Location', site.data ? <Link to={`/cameras/${n.site}`}>{site.data.name}</Link> : n.site],
            program.measurement === 'spot' && n.recordedSpeed && site.data && ['Recorded speed', `${n.recordedSpeed} km/h in a ${site.data.speedLimit} km/h zone`],
            ['Vehicle', `${n.vehicle} · ${n.rego}`],
          ]}
        />
        <Measurement n={n} program={program} site={site.data} />
        <details className="nsw-accordion">
          <summary>How this camera works</summary>
          <p>{program.explainer}</p>
        </details>
      </section>

      <section>
        <h2 className="cevoc-h2">Images</h2>
        {n.imagesUnavailable ? (
          <Alert type="warning" title="Images can’t be shown right now">
            <p>The system that stores offence images isn’t responding. Everything else on this page is correct.</p>
            <Button variant="dark-outline" onClick={retryImages} disabled={retrying}>{retrying ? 'Trying…' : 'Try again'}</Button>
          </Alert>
        ) : n.images.length ? (
          <Gallery images={n.images} idPrefix={n.number} />
        ) : (
          <p>No images are available for this offence.</p>
        )}
      </section>

      {video && (
        <section>
          <h2 className="cevoc-h2">
            Video <StatusTag status="future" />
          </h2>
          {app.demo.media ? (
            <>
              <VideoPlayer video={video} downloadName={`${n.number}-${video.id}-SAMPLE.mp4`} />
              <Alert type="warning" title="Proposed capability: not approved">
                <p>Video access is subject to Legal, Prosecutions, privacy and security decisions. It’s shown only to demonstrate that the architecture can support it. This is a generated sample clip, not real footage.</p>
              </Alert>
            </>
          ) : (
            <p>Video isn’t available through this service.</p>
          )}
        </section>
      )}

      <section className="cevoc-panel">
        <h2 className="cevoc-h2">Was the camera working properly?</h2>
        {site.error ? (
          <Problem error={site.error} onRetry={site.reload} />
        ) : site.loading ? (
          <>
            <Skeleton media lines={3} label="Loading camera" />
            <SlowNote active />
          </>
        ) : (
          <div className="cevoc-split">
            <img className="cevoc-site-photo" src={resolveImage(manifest, site.data.photo.slot, site.data.photo.fallback)} alt={`Camera location: ${site.data.name}`} />
            <div>
              <SummaryList rows={[['Camera', `${site.data.type} · ${site.data.code}`], ['Location', `${site.data.name} (${site.data.direction})`]]} />
              {certs.error ? (
                <Problem error={certs.error} onRetry={certs.reload} />
              ) : certs.loading ? (
                <>
                  <Skeleton lines={2} label="Checking certification" />
                  <SlowNote active />
                </>
              ) : applicable ? (
                <>
                  <p><StatusTag status="current" label="Yes: certified on the day" /></p>
                  <p>
                    Certificate <strong>{applicable.id}</strong> was in force from {fmtDate(applicable.validFrom)} to {fmtDate(applicable.validTo)}.
                  </p>
                  <div className="cevoc-actions">
                    <Link className="nsw-button nsw-button--dark" to={`/certificates/${applicable.id}`}>View certificate</Link>
                    <Link className="nsw-button nsw-button--dark-outline" to={`/cameras/${site.data.code}`}>Camera history</Link>
                  </div>
                </>
              ) : (
                <Alert type="warning" title="No published certificate found for the offence date">
                  <p>Contact Revenue NSW about your options.</p>
                </Alert>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="cevoc-h2">What you can do</h2>
        <p className="cevoc-muted">All of these happen with Revenue NSW. Choose the one that fits; none is the “right” answer.</p>
        <ul className="cevoc-options">
          {program.actions.map((key) => (
            <li key={key}>
              <button type="button" className="cevoc-option" onClick={() => setAction(key)}>
                <span className="cevoc-option__title">{ACTIONS[key].title}</span>
                <span>{ACTIONS[key].text}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="cevoc-muted">Worried about your licence? Demerit points and licence effects are shown on your notice.</p>
      </section>

      <div className="cevoc-actions">
        <Button variant="dark-outline" onClick={() => { app.setNotice(null); go('/notice'); }}>Check another notice</Button>
      </div>
      {action && <RevenueHandoff action={action} onClose={() => setAction(null)} />}
    </div>
  );
}
