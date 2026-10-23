import React, { useState } from 'react';
import { Link, Alert, Button, StatusTag, SummaryList } from '../components/ui.jsx';
import { Skeleton, SlowNote, Problem } from '../components/Feedback.jsx';
import Gallery from '../components/Gallery.jsx';
import VideoPlayer from '../components/Media.jsx';
import { useApp, apiCtx } from '../state.js';
import { api, applicableOn, can } from '../services/mockApi.js';
import { useAsync } from '../useAsync.js';
import { REVIEW_CASES, NOTICES } from '../data/mockData.js';
import { programFor } from '../config/programs.js';
import { fmtDate, fmtDateTime, TODAY } from '../format.js';
import { daysBetween } from '../util.js';

const DECISIONS = {
  uphold: 'Uphold the notice',
  withdraw: 'Withdraw the notice',
  caution: 'Withdraw and give a caution',
  refer: 'Refer to Transport for technical advice',
  brief: 'Prepare brief of evidence for court',
};

function NotAllowed() {
  return (
    <Alert type="error" title="You don’t have access to review cases">
      <p>Review cases are available to Revenue NSW review officers.</p>
    </Alert>
  );
}

export function ReviewQueue() {
  const app = useApp();
  if (!can(app.officer, 'review')) return <NotAllowed />;
  return (
    <div>
      <h1>Review cases</h1>
      <p className="cevoc-muted">Customers who asked for a review or elected to go to court. Oldest first.</p>
      <div className="cevoc-table-wrap">
        <table className="nsw-table">
          <thead>
            <tr><th>Case</th><th>Type</th><th>Notice</th><th>Program</th><th>Lodged</th><th>Customer state</th><th>Status</th></tr>
          </thead>
          <tbody>
            {REVIEW_CASES.map((c) => {
              const n = NOTICES.find((x) => x.number === c.notice);
              const d = app.decisions[c.id];
              return (
                <tr key={c.id}>
                  <td><Link to={`/officer/review/${c.id}`}>{c.id}</Link></td>
                  <td>{c.type === 'Court election' ? <StatusTag status="withdrawn" label="Court election" /> : c.type}</td>
                  <td>{c.notice}</td>
                  <td>{programFor(n.program).label}</td>
                  <td>{fmtDate(c.lodged)} <small className="cevoc-muted">({daysBetween(c.lodged, TODAY)} days)</small></td>
                  <td>{c.mood}</td>
                  <td>{d ? <StatusTag status="current" label="Decided" /> : <StatusTag status="info" label="Open" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function letterText(decision, kase, n, reason) {
  const open = `Dear customer,\n\nWe have reviewed penalty notice ${n.number} (${n.offence.toLowerCase()} on ${fmtDate(n.dateTime)}).`;
  const body = {
    uphold: `We looked carefully at the reasons you gave, the camera images and the camera’s certification. The notice will stand. ${reason}\n\nYou can still pay, ask about a payment plan, or have a court decide.`,
    withdraw: `We have decided to withdraw this notice. ${reason}\n\nYou don’t need to do anything else.`,
    caution: `We have decided to withdraw this notice and give you a caution instead. ${reason}\n\nYou don’t need to pay this fine.`,
    refer: `We need technical advice from Transport for NSW before we can decide. ${reason}\n\nWe’ll write to you again when we have it. You don’t need to pay while we look into this.`,
    brief: `You have chosen to have this matter dealt with by a court. We are preparing the evidence. ${reason}\n\nThe court will contact you with the hearing details.`,
  }[decision];
  return `${open}\n\n${body}\n\nRevenue NSW (MOCK LETTER – NOT SENT)`;
}

export function ReviewCase({ id }) {
  const app = useApp();
  const res = useAsync(() => api.reviewCase(apiCtx(app), id), [id, app.demo.outage, app.demo.latency]);
  const [extra, setExtra] = useState({ state: 'idle', items: [], error: null });
  const [checks, setChecks] = useState({});
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(false);

  if (!can(app.officer, 'review')) return <NotAllowed />;
  if (res.error) return <><h1>Case {id}</h1><Problem error={res.error} onRetry={res.reload} /></>;
  if (res.loading)
    return (
      <>
        <h1>Case {id}</h1>
        <Skeleton media lines={4} label="Loading case" />
        <SlowNote active />
      </>
    );
  if (!res.data) return <><h1>Case not found</h1><Link to="/officer/review">Back to review cases</Link></>;

  const { kase, notice: n, site, certs } = res.data;
  const program = programFor(n.program);
  const cert = applicableOn(certs, n.dateTime.slice(0, 10));
  const recorded = app.decisions[kase.id];
  const court = kase.type === 'Court election';
  const options = court ? ['brief', 'withdraw', 'refer'] : ['uphold', 'withdraw', 'caution', 'refer'];
  const officerImages = n.images.map((i) => ({ ...i, status: 'published', caption: i.status === 'withdrawn' ? `${i.caption} (withdrawn from public view)` : i.caption }));
  const auto = { 0: !!cert };
  const canDecide = decision && reason.trim().length >= 10;

  const requestExtra = async () => {
    setExtra({ state: 'loading', items: [], error: null });
    app.audit(`Requested Transport-held evidence for notice ${n.number} (case ${kase.id})`);
    try {
      const items = await api.additionalEvidence(apiCtx(app), n.number);
      setExtra({ state: 'done', items, error: null });
    } catch (error) {
      setExtra({ state: 'error', items: [], error });
    }
  };

  const record = () => {
    app.setDecision(kase.id, { decision, reason, at: new Date().toISOString() });
    app.audit(`${DECISIONS[decision]} – case ${kase.id}`);
  };

  return (
    <div>
      <p className="cevoc-eyebrow"><Link to="/officer/review">Review cases</Link> / {kase.id}</p>
      <h1>{kase.type}: notice {n.number}</h1>
      {recorded && (
        <Alert type="success" title={`Decision recorded: ${DECISIONS[recorded.decision]}`}>
          <p>Logged at {new Date(recorded.at).toLocaleTimeString('en-AU')}. In the target service this updates Revenue NSW’s case system and sends the letter.</p>
        </Alert>
      )}

      <div className="cevoc-review">
        <section className="cevoc-card">
          <h2>What the customer says</h2>
          <blockquote className="cevoc-quote">{kase.grounds}</blockquote>
          <SummaryList rows={[['Channel', kase.channel], ['Customer state', kase.mood], ['Lodged', fmtDate(kase.lodged)]]} />
          <h3>Timeline</h3>
          <ol className="cevoc-timeline">
            <li><strong>{fmtDateTime(n.dateTime)}</strong> Offence detected</li>
            <li><strong>{fmtDate(n.issued)}</strong> Notice issued ({daysBetween(n.dateTime, n.issued)} days later)</li>
            <li><strong>{fmtDate(kase.lodged)}</strong> {kase.type} lodged</li>
            <li><strong>{fmtDate(TODAY)}</strong> Today</li>
          </ol>
        </section>

        <section className="cevoc-card cevoc-review__evidence">
          <h2>Evidence on the notice <small className="cevoc-muted">(prima facie)</small></h2>
          <Gallery images={officerImages} idPrefix={n.number} />
          {n.media.map((v) => <VideoPlayer key={v.id} video={v} downloadName={`${n.number}-${v.id}-SAMPLE.mp4`} />)}

          <h2>Evidence held by Transport</h2>
          <div className="cevoc-proto-note" role="note">
            <strong>Open question:</strong> should reviewers see evidence that isn’t on the notice? Shown here as on-request and logged.
          </div>
          {extra.state === 'idle' && <Button variant="dark-outline" onClick={requestExtra}>Request from Transport</Button>}
          {extra.state === 'loading' && <><Skeleton media lines={1} label="Requesting evidence" /><SlowNote active /></>}
          {extra.state === 'error' && <Problem error={extra.error} onRetry={requestExtra} />}
          {extra.state === 'done' &&
            (extra.items.length === 0 ? (
              <p>Transport holds no further evidence for this notice.</p>
            ) : (
              <>
                <Gallery images={extra.items.filter((x) => x.kind === 'image')} idPrefix={`${n.number}-extra`} />
                {extra.items.filter((x) => x.kind === 'video').map((v) => <VideoPlayer key={v.id} video={v} />)}
              </>
            ))}
        </section>

        <section className="cevoc-card">
          <h2>Validity</h2>
          <p><StatusTag status="info" label={program.label} /></p>
          <SummaryList
            rows={[
              ['Camera', `${site.code} · ${site.name}`],
              n.segment
                ? ['Measurement', `${n.segment.distanceKm} km, ${n.segment.timeA} → ${n.segment.timeB} = ${n.recordedSpeed} km/h avg (limit ${site.speedLimit})`]
                : n.recordedSpeed && ['Measurement', `${n.recordedSpeed} km/h (limit ${site.speedLimit})${n.redFor ? `, red for ${n.redFor}s` : ''}`],
              ['Certificate on the day', cert ? `${cert.id} (in force)` : 'None in force'],
              cert && ['Device serial', cert.restricted.deviceSerial],
              cert && ['Match value', <code key="m">{cert.restricted.matchValue}</code>],
            ]}
          />
          <h3>Checklist for {program.label.toLowerCase()}</h3>
          <ul className="cevoc-checklist">
            {program.reviewChecklist.map((item, i) => (
              <li key={item}>
                <label>
                  <input
                    type="checkbox"
                    checked={auto[i] !== undefined ? auto[i] : !!checks[i]}
                    disabled={auto[i] !== undefined}
                    onChange={(e) => setChecks({ ...checks, [i]: e.target.checked })}
                  />
                  {item} {auto[i] !== undefined && <small className="cevoc-muted">(checked automatically)</small>}
                </label>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {!recorded && (
        <section className="cevoc-panel cevoc-panel--officer">
          <h2 className="cevoc-h2">Decision</h2>
          <fieldset className="nsw-form__fieldset">
            <legend className="nsw-form__legend">Outcome</legend>
            {options.map((k) => (
              <label key={k} className="nsw-form__radio">
                <input type="radio" name="decision" value={k} checked={decision === k} onChange={() => setDecision(k)} />
                <span>{DECISIONS[k]}</span>
              </label>
            ))}
          </fieldset>
          <div className="nsw-form__group">
            <label className="nsw-form__label" htmlFor="reason">Reason (shown in the letter)</label>
            <span className="nsw-form__helper">Plain English, at least 10 characters.</span>
            <textarea id="reason" className="nsw-form__input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="cevoc-actions">
            <Button variant="dark-outline" disabled={!canDecide} onClick={() => setPreview(!preview)}>{preview ? 'Hide letter' : 'Preview outcome letter'}</Button>
            <Button disabled={!canDecide} onClick={record}>Record decision</Button>
          </div>
          {preview && canDecide && <pre className="cevoc-letter">{letterText(decision, kase, n, reason.trim())}</pre>}
        </section>
      )}
    </div>
  );
}
