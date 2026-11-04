import { useState } from 'react';
import EvidenceItem from './EvidenceItem.jsx';
import CertificateList from './CertificateList.jsx';
import { hasCertificateList } from './certs.js';
import { HELP_PHONE, certificateAnswer, evidenceState, money, niceDate, niceTime, statusSummary, stepsFor } from './journey.js';
import { checkRegistration, cleanRegistration } from './lookupValidation.js';

const OPTIONS = [
  ['Pay', 'In full, or ask for a payment plan or more time if money is tight.'],
  ['Ask for a review', 'If you think the fine is wrong or there were special circumstances.'],
  ['Nominate the driver', 'If it wasn’t you.'],
  ['Have a court decide', 'You can choose to have the matter heard in court.'],
];

function Step({ n, id, title, answer, tone, children }) {
  return (
    <section className="q" id={id} aria-labelledby={`${id}-h`}>
      <div className={`q-n${tone === 'warn' ? ' is-warn' : ''}`} aria-hidden="true">{n}</div>
      <div className="q-body">
        <h2 id={`${id}-h`}>{title}</h2>
        {answer && <p className="q-answer">{answer}</p>}
        {children}
      </div>
    </section>
  );
}

function PlateAsk({ onSubmit, busy, again }) {
  const [reg, setReg] = useState('');
  const [err, setErr] = useState(null);
  const send = (e) => {
    e.preventDefault();
    const m = !cleanRegistration(reg) ? 'Enter the number plate' : checkRegistration(reg);
    if (m) { setErr(m); return; }
    const value = cleanRegistration(reg);
    setReg(''); // sent once, not kept
    onSubmit(value);
  };
  return (
    <form className="plate-ask" onSubmit={send} noValidate>
      <label htmlFor="rego2">Number plate of the vehicle</label>
      <p className="hint" id="rego2-hint">Used for this check only. We don’t keep it.</p>
      {err && <p className="field-err" id="rego2-err" role="alert"><span aria-hidden="true">⚠ </span><span className="sr-only">Error: </span>{err}</p>}
      <div className="plate-row">
        <input id="rego2" className={`rego${err ? ' is-bad' : ''}`} autoComplete="off" autoCapitalize="characters" spellCheck="false" maxLength={12}
          value={reg} aria-describedby={`rego2-hint${err ? ' rego2-err' : ''}`} aria-invalid={!!err || undefined}
          onChange={(e) => { setReg(e.target.value); setErr(null); }} />
        <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Looking…' : again ? 'Try this number plate' : 'Show the photos'}</button>
      </div>
    </form>
  );
}

function EvidenceBody({ result, state, media, onPlate, plateBusy }) {
  switch (state) {
    case 'show':
      return (
        <>
          <p className="hint">Zoom in to read plates and signs: pinch or double-tap on a touch screen, scroll wheel or the buttons with a mouse, plus and minus keys on a keyboard.</p>
          <ul className="grid">{media.map((e) => <EvidenceItem key={e.url} item={e} />)}</ul>
          <p className="muted">If someone else was driving, you can nominate them with Revenue NSW (see Your options).</p>
        </>
      );
    case 'needs-plate':
      return (
        <div className="notice-box" role="status">
          <h3>The photos need your number plate</h3>
          <p>For this notice the photos are only shown once the number plate is given. Enter it below and we’ll look again.</p>
          <PlateAsk onSubmit={onPlate} busy={plateBusy} />
        </div>
      );
    case 'plate-no-images':
      return (
        <div className="notice-box" role="status">
          <h3>We couldn’t show the photos</h3>
          <p>Either the number plate didn’t match the notice, or the photos aren’t available to show yet. Check the plate on your letter and try again. If it still doesn’t work, call {HELP_PHONE}.</p>
          <PlateAsk onSubmit={onPlate} busy={plateBusy} again />
        </div>
      );
    default:
      return (
        <p className="notice-box" role="status">
          {result.notice.enforcementMethod === 'OFFICER_ISSUED'
            ? 'No camera evidence applies to this notice. It was issued by an officer, not detected by a camera.'
            : 'We can’t show camera evidence for this notice. That may mean no camera was involved, or it isn’t available to show yet.'}
        </p>
      );
  }
}

export default function Notice({ result, registrationGiven, onPlate, plateBusy, onStartAgain, headingRef }) {
  const n = result.notice;
  const camera = n.enforcementMethod === 'CAMERA';
  const media = (result.evidence || []).filter((e) => e.kind !== 'CERTIFICATE');
  const oldCerts = (result.evidence || []).filter((e) => e.kind === 'CERTIFICATE');
  const ev = evidenceState(result, registrationGiven);
  const steps = stepsFor(result, ev);
  const status = statusSummary(n);
  const certAns = certificateAnswer(result);
  const stepNo = (id) => steps.findIndex((s) => s.id === id) + 1;
  const demo = result.source === 'STUB' || result.source === 'MANIFEST';
  const evAnswer = ev === 'show' ? `Check the number plate and the vehicle in the ${media.some((m) => m.kind === 'VIDEO') ? 'photos and video' : 'photos'}.`
    : ev === 'not-applicable' ? undefined : 'We can’t show the photos yet.';

  return (
    <div className="wrap page-body">
      <p className="crumb"><button type="button" className="linklike" onClick={onStartAgain}>← Look up a different notice</button></p>
      {demo && <p className="banner" role="note"><strong>Prototype data only.</strong> This is not a real notice.</p>}
      <h1 ref={headingRef} tabIndex={-1}>What happened</h1>
      <p className="lede">Penalty notice ({result.infringementNumber})</p>

      <section className={`stat is-${status.tone}`} aria-labelledby="stat-h">
        <h2 id="stat-h">{status.stage}</h2>
        <p className="stat-lead">{status.headline}</p>
        {status.next && <p>{status.next}</p>}
        {n.statusMessage && n.noticeStatus !== 'OTHER' && <p className="muted">{n.statusMessage}</p>}
      </section>

      <div className="story">
        <nav className="toc" aria-label="On this page">
          <ol>{steps.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.label}</a></li>)}</ol>
        </nav>
        <div>
          <Step n={stepNo('step-what')} id="step-what" title="What happened">
            <dl className="facts">
              <div><dt>When</dt><dd><strong>{niceDate(n.offenceDate)}</strong><small>{niceTime(n.offenceTime)}</small></dd></div>
              <div><dt>Where</dt><dd><strong>{n.location}</strong></dd></div>
              <div className="span"><dt>Offence</dt><dd><strong>{n.offenceDescription}</strong></dd></div>
              <div><dt>Penalty</dt><dd><strong>{money(n.penaltyAmount)}</strong></dd></div>
              <div><dt>Amount owing</dt><dd><strong>{money(n.amountOwing)}</strong></dd></div>
            </dl>
          </Step>

          <Step n={stepNo('step-evidence')} id="step-evidence" title={ev === 'not-applicable' ? 'Camera evidence' : 'Was it my vehicle?'} answer={evAnswer}>
            <EvidenceBody result={result} state={ev} media={media} onPlate={onPlate} plateBusy={plateBusy} />
          </Step>

          {camera && (
            <Step n={stepNo('step-camera')} id="step-camera" title="Was the camera working properly?" tone={certAns.tone === 'warn' ? 'warn' : ''} answer={certAns.text}>
              {hasCertificateList(result)
                ? <CertificateList certificates={result.certificates} />
                : oldCerts.length > 0
                  ? <ul className="grid">{oldCerts.map((e) => <EvidenceItem key={e.url} item={e} />)}</ul>
                  : <p className="notice-box" role="status">Certificate information is not available to show yet. Everything else on this page is still correct.</p>}
            </Step>
          )}

          <Step n={stepNo('step-options')} id="step-options" title="Your options" answer="Whatever you decide, Revenue NSW handles it.">
            <ul className="opts">
              {OPTIONS.map(([t, d]) => <li key={t}><strong>{t}</strong><p>{d}</p></li>)}
            </ul>
            <p className="muted">These steps happen with Revenue NSW, not on this page. Have your penalty notice number to hand and call {HELP_PHONE}.</p>
          </Step>
        </div>
      </div>
    </div>
  );
}
