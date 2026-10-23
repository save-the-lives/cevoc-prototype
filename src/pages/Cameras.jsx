import React, { useState } from 'react';
import { Link, Alert, Breadcrumbs, Field, SummaryList, StatusTag, ErrorState, Loading } from '../components/ui.jsx';
import { useApp, apiCtx } from '../state.js';
import { api, applicableOn, publicCertificates, can } from '../services/mockApi.js';
import { useAsync } from '../useAsync.js';
import { useAssets, resolveImage } from '../services/assets.js';
import { SITES } from '../data/mockData.js';
import { fmtDate, TODAY } from '../format.js';

const TYPES = [...new Set(SITES.map((s) => s.type))];

export function CameraSearch() {
  const app = useApp();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [submitted, setSubmitted] = useState({ q: '', type: '' });
  const res = useAsync(() => api.searchSites(apiCtx(app), submitted.q, submitted.type), [submitted, app.demo.outage]);

  return (
    <div className="nsw-container cevoc-page">
      <Breadcrumbs items={[['Home', '/'], ['Cameras and certificates', '/cameras']]} />
      <h1>Cameras and certificates</h1>
      <p className="nsw-intro">Find a camera by location, suburb or camera code, then check its certification on a date.</p>

      <form className="cevoc-search" role="search" onSubmit={(e) => { e.preventDefault(); setSubmitted({ q, type }); }}>
        <Field id="q" label="Search cameras">
          <input id="q" className="nsw-form__input" type="search" placeholder="For example: Parramatta, Ryde or PAR-001" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field id="type" label="Camera type">
          <select id="type" className="nsw-form__select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <button type="submit" className="nsw-button nsw-button--dark">Search</button>
      </form>

      {res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : res.loading ? (
        <Loading text="Searching" />
      ) : (
        <>
          <p className="nsw-results-bar" aria-live="polite">
            Showing <strong>{res.data.length}</strong> camera{res.data.length === 1 ? '' : 's'}
            {submitted.q && <> for “{submitted.q}”</>}
          </p>
          {res.data.length === 0 ? (
            <Alert type="info" title="No cameras match your search">
              <p>Check the spelling or search by suburb. <button type="button" className="cevoc-linkbutton" onClick={() => { setQ(''); setType(''); setSubmitted({ q: '', type: '' }); }}>Clear search</button></p>
            </Alert>
          ) : (
            <ul className="cevoc-results">
              {res.data.map((s) => (
                <li key={s.code}>
                  <Link to={`/cameras/${s.code}`} className="cevoc-result">
                    <span className="cevoc-result__title">{s.name}</span>
                    <span>{s.type} · {s.direction} · {s.code}</span>
                    <span className="cevoc-result__meta">Speed limit {s.speedLimit} km/h · {s.lga}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function CameraDetail({ code }) {
  const app = useApp();
  const manifest = useAssets();
  const [date, setDate] = useState(TODAY);
  const site = useAsync(() => api.getSite(apiCtx(app), code), [code, app.demo.outage]);
  const certs = useAsync(() => api.certificatesForSite(apiCtx(app), code), [code, app.demo.outage, app.overrides]);
  const officerView = can(app.officer, 'cert:restricted');

  if (site.error || certs.error)
    return (
      <div className="nsw-container cevoc-page">
        <h1>Camera {code}</h1>
        <ErrorState error={site.error || certs.error} onRetry={() => { site.reload(); certs.reload(); }} />
      </div>
    );
  if (site.loading || certs.loading)
    return (
      <div className="nsw-container cevoc-page">
        <Loading text="Loading camera" />
      </div>
    );
  if (!site.data)
    return (
      <div className="nsw-container cevoc-page">
        <h1>Camera not found</h1>
        <p>We couldn't find camera {code}. <Link to="/cameras">Search cameras</Link></p>
      </div>
    );

  const s = site.data;
  const list = officerView ? certs.data : publicCertificates(certs.data);
  const applicable = date ? applicableOn(certs.data, date) : null;

  return (
    <div className="nsw-container cevoc-page">
      <Breadcrumbs items={[['Home', '/'], ['Cameras and certificates', '/cameras'], [s.name, `/cameras/${code}`]]} />
      <h1>{s.name}</h1>
      <p className="nsw-intro">{s.type} · {s.direction} · Camera {s.code}</p>

      <div className="cevoc-split">
        <img className="cevoc-site-photo" src={resolveImage(manifest, s.photo.slot, s.photo.fallback)} alt={`Camera location: ${s.name}`} />
        <SummaryList rows={[['Camera code', s.code], ['Camera type', s.type], ['Direction', s.direction], ['Speed limit', `${s.speedLimit} km/h`], ['Local government area', s.lga], ['In operation since', fmtDate(s.commissioned)]]} />
      </div>

      <section className="cevoc-panel">
        <h2 className="cevoc-h2">Check certification on a date</h2>
        <Field id="cert-date" label="Date" hint="For example, the date of an offence">
          <input id="cert-date" className="nsw-form__input" type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: '14rem' }} />
        </Field>
        <div aria-live="polite">
          {!date ? null : applicable ? (
            <Alert type="success" title={`Certified on ${fmtDate(date)}`}>
              <p>Certificate <strong>{applicable.id}</strong> was in force from {fmtDate(applicable.validFrom)} to {fmtDate(applicable.validTo)}.</p>
              <Link className="nsw-button nsw-button--dark" to={`/certificates/${applicable.id}`}>View certificate</Link>
            </Alert>
          ) : (
            <Alert type="warning" title={`No published certificate in force on ${fmtDate(date)}`}>
              <p>No certificate covering this date is available through this service. If this relates to an offence, contact Revenue NSW.</p>
            </Alert>
          )}
        </div>
      </section>

      <section>
        <h2 className="cevoc-h2">Certificate history</h2>
        {officerView && <Alert type="info"><p>Officer view: restricted records are included.</p></Alert>}
        <div className="cevoc-table-wrap">
          <table className="nsw-table">
            <thead>
              <tr><th>Certificate</th><th>Type</th><th>In force</th><th>Status</th><th><span className="sr-only">Action</span></th></tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const live = c.status === 'published' && c.validFrom <= TODAY && c.validTo >= TODAY;
                return (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.type}</td>
                    <td>{fmtDate(c.validFrom)} – {fmtDate(c.validTo)}</td>
                    <td><StatusTag status={c.status === 'published' ? (live ? 'current' : 'expired') : c.status} /></td>
                    <td>{c.status !== 'withdrawn' || officerView ? <Link to={`/certificates/${c.id}`}>View<span className="sr-only"> {c.id}</span></Link> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
