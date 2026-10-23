import React, { useState } from 'react';
import { Alert, Button, StatusTag, SummaryList } from '../components/ui.jsx';
import { useApp } from '../state.js';
import { can, certificateInForce } from '../services/mockApi.js';
import { DETECTIONS, SITES, REJECT_REASONS } from '../data/mockData.js';
import { programFor } from '../config/programs.js';
import { useAssets, resolveImage } from '../services/assets.js';
import { fmtDateTime } from '../format.js';

const OUTCOME = { accepted: ['current', 'Accepted'], rejected: ['withdrawn', 'Rejected'], escalated: ['info', 'Escalated'] };

export default function AdjudicationQueue() {
  const app = useApp();
  const manifest = useAssets();
  const [selected, setSelected] = useState(DETECTIONS[0].id);
  const [reason, setReason] = useState('');

  if (!can(app.officer, 'adjudicate'))
    return (
      <Alert type="error" title="You don’t have access to the adjudication queue">
        <p>The queue is available to Transport adjudication officers.</p>
      </Alert>
    );

  const outcomes = app.adjudications;
  const d = DETECTIONS.find((x) => x.id === selected);
  const site = SITES.find((s) => s.code === d.site);
  const program = programFor(d.program);
  const cert = certificateInForce(d.site, d.at);
  const done = outcomes[d.id];
  const counts = DETECTIONS.reduce(
    (acc, x) => ({ ...acc, [outcomes[x.id]?.outcome || 'pending']: (acc[outcomes[x.id]?.outcome || 'pending'] || 0) + 1 }),
    {}
  );

  const next = () => {
    const pending = DETECTIONS.find((x) => x.id !== d.id && !outcomes[x.id]);
    if (pending) setSelected(pending.id);
    setReason('');
  };
  const decide = (outcome, why) => {
    app.setAdjudication(d.id, { outcome, why });
    app.audit(`${OUTCOME[outcome][1]} detection ${d.id}${why ? ` (${why})` : ''}`);
    next();
  };

  return (
    <div>
      <h1>Adjudication queue</h1>
      <p className="cevoc-counters">
        <span>Pending <strong>{counts.pending || 0}</strong></span>
        <span>Accepted <strong>{counts.accepted || 0}</strong></span>
        <span>Rejected <strong>{counts.rejected || 0}</strong></span>
        <span>Escalated <strong>{counts.escalated || 0}</strong></span>
      </p>

      <div className="cevoc-adj">
        <ul className="cevoc-adj__list" aria-label="Detections">
          {DETECTIONS.map((x) => {
            const o = outcomes[x.id];
            return (
              <li key={x.id}>
                <button type="button" className={`cevoc-adj__item ${x.id === selected ? 'is-active' : ''}`} onClick={() => { setSelected(x.id); setReason(''); }} aria-current={x.id === selected ? 'true' : undefined}>
                  <strong>{x.id}</strong>
                  <span>{programFor(x.program).label}</span>
                  <span>{o ? <StatusTag status={OUTCOME[o.outcome][0]} label={OUTCOME[o.outcome][1]} /> : x.flags.length ? <StatusTag status="withdrawn" label={`${x.flags.length} flag`} /> : <StatusTag status="grey" label="Pending" />}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <section className="cevoc-adj__main">
          <img className="cevoc-adj__img" src={resolveImage(manifest, d.slot, d.fallback)} alt={`Detection ${d.id} primary image`} />
          {!program.known && (
            <div className="cevoc-proto-note" role="note">
              Program <code>{d.program}</code> isn’t configured. Default checks are applied and the gap is flagged.
            </div>
          )}
          {d.flags.map((f) => (
            <Alert key={f} type="warning"><p>{f}</p></Alert>
          ))}
          <div className="cevoc-split">
            <div>
              <h2 className="cevoc-h2">{d.id}</h2>
              <SummaryList
                rows={[
                  ['Program', program.label],
                  ['Camera', `${site.code} · ${site.name}`],
                  ['Detected', fmtDateTime(d.at)],
                  ['Speed', `${d.speed} km/h (limit ${site.speedLimit})`],
                ]}
              />
            </div>
            <div>
              <h3>Plate read</h3>
              <p className="cevoc-plate">{d.plateRead}</p>
              <div className="cevoc-meter" aria-label={`Confidence ${Math.round(d.confidence * 100)}%`}>
                <span style={{ width: `${d.confidence * 100}%`, background: d.confidence < 0.7 ? '#c95000' : '#008a07' }} />
              </div>
              <small>{Math.round(d.confidence * 100)}% confidence</small>
              <h3>Device certificate</h3>
              {cert ? <StatusTag status="current" label={`In force: ${cert.id}`} /> : <StatusTag status="unavailable" label="No certificate in force" />}
            </div>
          </div>

          {done ? (
            <Alert type="info" title={`${OUTCOME[done.outcome][1]}${done.why ? `: ${done.why}` : ''}`}>
              <p>Accepted detections would go to Revenue NSW for a notice to be issued (not connected).</p>
              <Button variant="dark-outline" onClick={() => app.setAdjudication(d.id, null)}>Undo</Button>
            </Alert>
          ) : (
            <div className="cevoc-panel cevoc-panel--officer">
              {!cert && <p><strong>Accept is blocked:</strong> the device had no certificate in force at the time of detection.</p>}
              <div className="cevoc-actions">
                <Button disabled={!cert} onClick={() => decide('accepted')}>Accept</Button>
                <select className="nsw-form__select" style={{ maxWidth: '16rem' }} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reject reason">
                  <option value="">Reject reason…</option>
                  {REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
                <Button variant="danger" disabled={!reason} onClick={() => decide('rejected', reason)}>Reject</Button>
                <Button variant="dark-outline" onClick={() => decide('escalated', 'Needs a second look')}>Escalate</Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
