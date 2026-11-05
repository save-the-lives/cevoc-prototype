import { Suspense, lazy, useState } from 'react';
import { ListSkeleton, PhotoSkeleton } from './Skeleton.jsx';
import { ExpiredContext } from './expired.js';
import { hasCertificateList } from './certs.js';
import { HELP_PHONE, certificateAnswer, evidenceState, isCamera, money, niceDate, niceTime, statusSummary, stepsFor } from './journey.js';
import { checkRegistration, cleanRegistration } from './lookupValidation.js';
import ProgramDetails from './ProgramDetails.jsx';

// Heavier parts load on their own, after the notice details have painted.
const EvidenceGrid = lazy(() => import('./EvidenceGrid.jsx'));
const CertificateList = lazy(() => import('./CertificateList.jsx'));

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
        <div aria-live="polite">
          {answer && <p className="q-answer">{answer}</p>}
          {children}
        </div>
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
          <Suspense fallback={<PhotoSkeleton count={media.length} />}><EvidenceGrid items={media} /></Suspense>
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

const READY = { details: 'ready', evidence: 'ready', certificates: 'ready' };

function Failed({ what, onRetry }) {
  return (
    <p className="notice-box" role="status">
      We couldn’t load {what}. The rest of this page is not affected.{' '}
      {onRetry && <button type="button" className="linklike" onClick={onRetry}>Try again</button>}
    </p>
  );
}

/**
 * The whole journey frame is on screen from the moment the lookup starts. `sections` says, per part, whether it is
 * still loading ('loading'), arrived ('ready') or failed ('error'); `result` is null until the notice details arrive.
 * Each section announces its own change politely. Options and help need no data, so they are always shown.
 */
export default function Notice({ result, query, sections = READY, registrationGiven, onPlate, plateBusy, onRetry, onRerun, onStartAgain, headingRef }) {
  const detailsLoading = sections.details === 'loading';
  const detailsFailed = sections.details === 'error' || (!detailsLoading && !result);
  const n = result?.notice;
  const evLoading = sections.evidence === 'loading';
  const certLoading = sections.certificates === 'loading';
  const evFailed = sections.evidence === 'error';
  const certFailed = sections.certificates === 'error';
  // Until the notice is known the camera steps are shown as loading; after that they follow the data.
  const known = !!result && !!n;
  const camera = !known || isCamera(result);
  const media = (result?.evidence || []).filter((e) => e.kind !== 'CERTIFICATE');
  const oldCerts = (result?.evidence || []).filter((e) => e.kind === 'CERTIFICATE');
  const ev = known ? evidenceState(result, registrationGiven) : 'show';
  const steps = known ? stepsFor(result, ev) : [
    { id: 'step-what', label: 'What happened' }, { id: 'step-evidence', label: 'Was it my vehicle?' },
    { id: 'step-camera', label: 'Was the camera working?' }, { id: 'step-options', label: 'Your options' },
  ];
  const status = known ? statusSummary(n) : null;
  const certAns = certLoading ? { tone: 'neutral', text: 'Checking the camera certificates…' } : certificateAnswer(result || {});
  const stepNo = (id) => steps.findIndex((s) => s.id === id) + 1;
  const demo = result?.source === 'STUB' || result?.source === 'MANIFEST';
  const evAnswer = detailsLoading ? 'Fetching the camera photos…' : evLoading ? 'Fetching the camera photos…' : evFailed ? 'We couldn’t load the photos.'
    : ev === 'show' ? `Check the number plate and the vehicle in the ${media.some((m) => m.kind === 'VIDEO') ? 'photos and video' : 'photos'}.`
      : ev === 'not-applicable' ? undefined : 'We can’t show the photos yet.';

  return (
    <ExpiredContext.Provider value={onRerun || null}>
    <div className="wrap page-body">
      <p className="crumb"><button type="button" className="linklike" onClick={onStartAgain}>← Look up a different notice</button></p>
      {query && (
        <p className="query-line">
          Notice {query.infringementNumber}, offence date {niceDate(query.offenceDate)}.{' '}
          <button type="button" className="linklike" onClick={onStartAgain}>Edit<span className="sr-only"> the notice number or date</span></button>
        </p>
      )}
      {demo && <p className="banner" role="note"><strong>Prototype data only.</strong> This is not a real notice.</p>}
      <h1 ref={headingRef} tabIndex={-1}>What happened</h1>
      <p className="lede">Penalty notice ({result?.infringementNumber || query?.infringementNumber})</p>

      <section className={`stat is-${status?.tone || 'info'}`} aria-labelledby="stat-h" aria-live="polite" aria-busy={detailsLoading || undefined}>
        {status ? (
          <>
            <h2 id="stat-h">{status.stage}</h2>
            <p className="stat-lead">{status.headline}</p>
            {status.next && <p>{status.next}</p>}
            {n.statusMessage && n.noticeStatus !== 'OTHER' && <p className="muted">{n.statusMessage}</p>}
          </>
        ) : (
          <>
            <h2 id="stat-h">Notice status</h2>
            {detailsFailed ? <p className="stat-lead">We couldn’t load your notice.</p> : <p className="stat-lead">Looking up your notice…</p>}
          </>
        )}
      </section>

      <div className="story">
        <nav className="toc" aria-label="On this page">
          <ol>{steps.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.label}</a></li>)}</ol>
        </nav>
        <div>
          <Step n={stepNo('step-what')} id="step-what" title="What happened" answer={detailsLoading ? 'Looking up your notice…' : undefined}>
            {detailsLoading
              ? <ListSkeleton rows={1} label="Looking up your notice. This can take up to half a minute." />
              : detailsFailed
                ? <Failed what="your notice" onRetry={onRetry} />
                : (
                  <dl className="facts">
                    <div><dt>When</dt><dd><strong>{niceDate(n.offenceDate)}</strong><small>{niceTime(n.offenceTime)}</small></dd></div>
                    <div><dt>Where</dt><dd><strong>{n.location}</strong></dd></div>
                    <div className="span"><dt>Offence</dt><dd><strong>{n.offenceDescription}</strong></dd></div>
                    <div><dt>Penalty</dt><dd><strong>{money(n.penaltyAmount)}</strong></dd></div>
                    <div><dt>Amount owing</dt><dd><strong>{money(n.amountOwing)}</strong></dd></div>
                  </dl>
                )}
            {!detailsLoading && !detailsFailed && !evLoading && <ProgramDetails result={result} />}
          </Step>

          <Step n={stepNo('step-evidence')} id="step-evidence" title={ev === 'not-applicable' ? 'Camera evidence' : 'Was it my vehicle?'} answer={evAnswer}>
            {detailsLoading || evLoading
              ? <PhotoSkeleton label="Fetching the camera photos. This can take up to half a minute." />
              : evFailed || detailsFailed
                ? <Failed what="the photos" onRetry={onRetry} />
                : <EvidenceBody result={result} state={ev} media={media} onPlate={onPlate} plateBusy={plateBusy} />}
          </Step>

          {camera && (
            <Step n={stepNo('step-camera')} id="step-camera" title="Was the camera working properly?" tone={certAns.tone === 'warn' ? 'warn' : ''}
              answer={detailsLoading ? 'Checking the camera certificates…' : certFailed || detailsFailed ? 'We couldn’t load the certificates.' : certAns.text}>
              {detailsLoading || certLoading
                ? <ListSkeleton label="Checking the camera certificates" />
                : certFailed || detailsFailed
                  ? <Failed what="the camera certificates" onRetry={onRetry} />
                  : hasCertificateList(result)
                    ? <Suspense fallback={<ListSkeleton label="Loading the certificates" />}><CertificateList certificates={result.certificates} /></Suspense>
                    : oldCerts.length > 0
                      ? <Suspense fallback={<PhotoSkeleton count={oldCerts.length} />}><EvidenceGrid items={oldCerts} /></Suspense>
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
    </ExpiredContext.Provider>
  );
}
