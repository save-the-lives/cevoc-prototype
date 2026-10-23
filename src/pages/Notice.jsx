import React, { useRef, useState } from 'react';
import { Link, Button, Alert, Breadcrumbs, Steps, Field, SummaryList, StatusTag, Dialog, ErrorState, Loading } from '../components/ui.jsx';
import Gallery from '../components/Gallery.jsx';
import { useApp, apiCtx } from '../state.js';
import { api, applicableOn } from '../services/mockApi.js';
import { useAsync } from '../useAsync.js';
import { useAssets, resolveImage, resolveVideo, asset } from '../services/assets.js';
import { go } from '../router.js';
import { fmtDate, fmtDateTime } from '../format.js';
import { SAMPLES } from '../data/mockData.js';

const STEPS = ['Enter notice details', 'Review offence', 'Camera and certification'];

export function NoticeLookup() {
  const app = useApp();
  const [number, setNumber] = useState('');
  const [rego, setRego] = useState('');
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
                  <a href={`#/notice`} onClick={(e) => { e.preventDefault(); document.getElementById(k)?.focus(); }}>{msg}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {result === 'nomatch' && (
        <Alert type="warning" title="We couldn't find a matching offence">
          <p>Check that the penalty notice number and registration match your notice exactly. For your security we don't say which detail didn't match.</p>
        </Alert>
      )}
      {result instanceof Error && <ErrorState error={result} onRetry={() => setResult(null)} />}

      <form className="nsw-form cevoc-panel" onSubmit={submit} noValidate>
        <Field id="number" label="Penalty notice number" hint="10 digits, shown at the top of your notice" error={errors.number}>
          <input id="number" className="nsw-form__input" inputMode="numeric" autoComplete="off" value={number} onChange={(e) => setNumber(e.target.value)} aria-invalid={!!errors.number} aria-describedby={`number-hint${errors.number ? ' number-error' : ''}`} style={{ maxWidth: '16rem' }} />
        </Field>
        <Field id="rego" label="Vehicle registration number" hint="As shown on the notice, for example ABC12D" error={errors.rego}>
          <input id="rego" className="nsw-form__input" autoComplete="off" value={rego} onChange={(e) => setRego(e.target.value.toUpperCase())} aria-invalid={!!errors.rego} aria-describedby={`rego-hint${errors.rego ? ' rego-error' : ''}`} style={{ maxWidth: '12rem' }} />
        </Field>
        <button type="submit" className="nsw-button nsw-button--dark" disabled={busy}>
          {busy ? 'Checking…' : 'Find my offence'}
        </button>
      </form>

      <details className="nsw-accordion">
        <summary>Prototype sample data</summary>
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

function RevenueHandoff({ onClose }) {
  return (
    <Dialog title="Return to Revenue NSW" onClose={onClose}>
      <p>In the target service this returns you to Revenue NSW to pay, request a review or nominate the driver, carrying your notice reference securely.</p>
      <Alert type="info"><p>Prototype only: Revenue NSW is not connected.</p></Alert>
      <Button onClick={onClose}>Close</Button>
    </Dialog>
  );
}

export function NoticeResult() {
  const app = useApp();
  const manifest = useAssets();
  const [handoff, setHandoff] = useState(false);
  const n = app.notice;

  const site = useAsync(() => (n ? api.getSite(apiCtx(app), n.site) : Promise.resolve(null)), [n?.site, app.demo.outage]);
  const certs = useAsync(() => (n ? api.certificatesForSite(apiCtx(app), n.site) : Promise.resolve([])), [n?.site, app.demo.outage, app.overrides]);

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

  return (
    <div className="nsw-container cevoc-page">
      <Breadcrumbs items={[['Home', '/'], ['View your offence', '/notice'], ['Offence details', '/notice/result']]} />
      <h1>Offence details</h1>
      <Steps current={2} steps={STEPS} />

      <section className="cevoc-panel">
        <h2 className="cevoc-h2">Penalty notice {n.number}</h2>
        <SummaryList
          rows={[
            ['Offence', n.offence],
            ['Date and time', fmtDateTime(n.dateTime)],
            ['Location', <Link to={`/cameras/${n.site}`}>{site.data ? site.data.name : n.site}</Link>],
            n.recordedSpeed && site.data && ['Recorded speed', `${n.recordedSpeed} km/h in a ${site.data.speedLimit} km/h zone`],
            ['Vehicle', `${n.vehicle} · ${n.rego}`],
          ]}
        />
      </section>

      <section>
        <h2 className="cevoc-h2">Offence images</h2>
        {n.images.length ? <Gallery images={n.images} idPrefix={n.number} /> : <p>No images are available for this offence.</p>}
      </section>

      {video && (
        <section>
          <h2 className="cevoc-h2">
            Video <StatusTag status="future" />
          </h2>
          {app.demo.media ? (
            <div className="cevoc-video">
              {resolveVideo(manifest, video.slot) ? (
                <video controls preload="metadata" poster={resolveImage(manifest, 0, 'offence-1.svg')} src={resolveVideo(manifest, video.slot)}>
                  Your browser can't play this video.
                </video>
              ) : (
                <div className="cevoc-video__placeholder">
                  <img src={asset('placeholders/video-poster.svg')} alt="" />
                  <p>Sample video not yet supplied. Add an MP4 to <code>public/assets/media</code> and run <code>npm run assets:scan</code>.</p>
                </div>
              )}
              <Alert type="warning" title="Proposed capability: not approved">
                <p>Video access is subject to Legal, Prosecutions, privacy and security decisions. It's shown here only to demonstrate that the architecture can support it.</p>
              </Alert>
            </div>
          ) : (
            <p>Video isn't available through this service.</p>
          )}
        </section>
      )}

      <section className="cevoc-panel">
        <h2 className="cevoc-h2">Camera and certification</h2>
        {site.error || certs.error ? (
          <ErrorState error={site.error || certs.error} onRetry={() => { site.reload(); certs.reload(); }} />
        ) : site.loading || certs.loading ? (
          <Loading text="Checking camera certification" />
        ) : (
          <div className="cevoc-split">
            <img className="cevoc-site-photo" src={resolveImage(manifest, site.data.photo.slot, site.data.photo.fallback)} alt={`Camera location: ${site.data.name}`} />
            <div>
              <SummaryList rows={[['Camera', `${site.data.type} · ${site.data.code}`], ['Location', `${site.data.name} (${site.data.direction})`]]} />
              {applicable ? (
                <>
                  <p>
                    <StatusTag status="current" label="Certified on the offence date" />
                  </p>
                  <p>
                    Certificate <strong>{applicable.id}</strong> was in force from {fmtDate(applicable.validFrom)} to {fmtDate(applicable.validTo)}.
                  </p>
                  <div className="cevoc-actions">
                    <Link className="nsw-button nsw-button--dark" to={`/certificates/${applicable.id}`}>View certificate</Link>
                    <Link className="nsw-button nsw-button--dark-outline" to={`/cameras/${site.data.code}`}>Camera details and history</Link>
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

      <div className="cevoc-actions">
        <Button onClick={() => setHandoff(true)}>Return to Revenue NSW</Button>
        <Button variant="dark-outline" onClick={() => { app.setNotice(null); go('/notice'); }}>Check another notice</Button>
      </div>
      {handoff && <RevenueHandoff onClose={() => setHandoff(false)} />}
    </div>
  );
}
