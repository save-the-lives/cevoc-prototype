import { Suspense, lazy, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ListSkeleton, PhotoSkeleton } from './Skeleton.jsx';
import { ExpiredContext } from './expired.js';
import { hasCertificateList } from './certs.js';
import { HELP_PHONE, certificateAnswer, evidenceState, hasMeasureData, isCamera, money, niceDate, niceTime, photosAnswer, statusSummary, stepsFor } from './journey.js';
import { checkRegistration, cleanRegistration } from './lookupValidation.js';
import ProgramDetails from './ProgramDetails.jsx';
import RoadSafetyMessage from './RoadSafetyMessage.jsx';
import { detailRows, pickExplainer, pickMessage, pickProgram, videoView } from './programs.js';

// Heavier parts load on their own, after the notice details have painted.
const EvidenceGrid = lazy(() => import('./EvidenceGrid.jsx'));
const CertificateList = lazy(() => import('./CertificateList.jsx'));

const EXPLAINER_ICONS = {
  sensor: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="8" rx="2" /><line x1="7" y1="11" x2="7" y2="7" /><line x1="12" y1="11" x2="12" y2="5" /><line x1="17" y1="11" x2="17" y2="7" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0113 0" />
    </svg>
  ),
};

/** Config-driven explainer cards — icon, heading, body, optional anchor link. */
function ExplainerCards({ cards }) {
  if (!cards || cards.length === 0) return null;
  return (
    <div className="explainer-cards">
      {cards.map((c, i) => (
        <div key={i} className="explainer-card">
          {EXPLAINER_ICONS[c.icon] && <div className="explainer-icon">{EXPLAINER_ICONS[c.icon]}</div>}
          <h4>{c.heading}</h4>
          <p>{c.body}</p>
          {c.link && <button type="button" className="explainer-link" onClick={() => document.getElementById(c.link.step)?.scrollIntoView({ behavior: 'smooth' })}>{c.link.text} ↓</button>}
        </div>
      ))}
    </div>
  );
}

/** Collapsed accordion. */
function Accordion({ title, children }) {
  return (
    <details className="accordion">
      <summary>{title}</summary>
      <div className="accordion-body">{children}</div>
    </details>
  );
}

const FINES_BASE = 'https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines';
const OPTIONS = [
  { id: 'pay', title: 'Pay', text: 'In full, or ask for a payment plan or more time if money is tight.', cta: 'Pay or set up a plan', href: `${FINES_BASE}/pay-your-fine` },
  { id: 'review', title: 'Ask for a review', text: 'If you think the fine is wrong or there were special circumstances.', cta: 'Ask for a review', href: `${FINES_BASE}/request-a-review` },
  { id: 'nominate', title: 'Nominate the driver', text: "If it wasn't you.", cta: 'Nominate the driver', href: `${FINES_BASE}/nominate-someone-else-for-a-fine` },
  { id: 'court', title: 'Have a court decide', text: 'You can choose to have the matter heard in court.', cta: 'Choose court', href: `${FINES_BASE}/apply-to-go-to-court-for-a-fine` },
];

const Step = memo(function Step({ n, id, title, answer, tone, children }) {
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
});

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
      <p className="hint" id="rego2-hint">Used for this check only. We don't keep it.</p>
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

/** One message for the whole set of photos. The status region is always on the page so that a screen reader announces the text when it appears. */
function TimedOut() {
  const { expired, rerun } = useContext(ExpiredContext);
  return (
    <div role="status" data-testid="photos-timed-out">
      {expired && (
        <div className="notice-box">
          <h3>Your photos have timed out</h3>
          <p>Photo links stop working after a short time, to keep them private. To see them again, reload them: we'll take you back to the form with your notice number and date filled in. We don't keep your number plate, so you'll need to type it again.</p>
          {rerun && <p><button type="button" className="btn primary" onClick={rerun}>Reload the photos</button></p>}
        </div>
      )}
    </div>
  );
}

function EvidenceBody({ result, state, media, onPlate, plateBusy, timedOut }) {
  switch (state) {
    case 'show':
      return (
        <>
          <TimedOut />
          {!timedOut && <p className="hint">Zoom in to read plates and signs: scroll wheel or pinch on the photo, or click it to open full size.</p>}
          <Suspense fallback={<PhotoSkeleton count={media.length} />}><EvidenceGrid items={media} /></Suspense>
          <p className="muted">If someone else was driving, you can nominate them (see Your options).</p>
        </>
      );
    case 'needs-plate':
      return (
        <div className="notice-box" role="status">
          <h3>The photos need your number plate</h3>
          <p>For this notice the photos are only shown once the number plate is given. Enter it below and we'll look again.</p>
          <PlateAsk onSubmit={onPlate} busy={plateBusy} />
        </div>
      );
    case 'plate-no-images':
      return (
        <div className="notice-box" role="status">
          <h3>We couldn't show the photos</h3>
          <p>Either the number plate didn't match the notice, or the photos aren't available to show yet. Check the plate on your letter and try again. If it still doesn't work, call {HELP_PHONE}.</p>
          <PlateAsk onSubmit={onPlate} busy={plateBusy} again />
        </div>
      );
    default:
      return (
        <p className="notice-box" role="status">
          {result.notice.enforcementMethod === 'OFFICER_ISSUED'
            ? 'No camera evidence applies to this notice. It was issued by an officer, not detected by a camera.'
            : "We can't show camera evidence for this notice. That may mean no camera was involved, or it isn't available to show yet."}
        </p>
      );
  }
}

/** Mobile step counter: "2/4 Was it my vehicle?" with a segmented progress bar, expandable to the full list. Desktop: vertical rail. */
function StepNav({ steps }) {
  const [tocOpen, setTocOpen] = useState(false);
  const [active, setActive] = useState(0);
  const total = steps.length;

  // Track which step is in view via IntersectionObserver
  useEffect(() => {
    const ids = steps.map((s) => s.id);
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return;
    const ob = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const idx = ids.indexOf(e.target.id);
          if (idx >= 0) setActive(idx);
        }
      }
    }, { rootMargin: '-20% 0px -60% 0px' });
    els.forEach((el) => ob.observe(el));
    return () => ob.disconnect();
  }, [steps.map((s) => s.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollTo = (id) => {
    setTocOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return (
    <nav className="toc" aria-label="On this page" style={{ '--prog': active / Math.max(total - 1, 1) }} onKeyDown={(e) => { if (e.key === 'Escape') setTocOpen(false); }}>
      {/* Phone: one steady line — "2/4 Was it my vehicle?" — with a segmented bar and an expandable list on tap */}
      <div className="toc-mini">
        <button type="button" className="toc-mini__btn" aria-expanded={tocOpen} aria-controls="toc-list" onClick={() => setTocOpen((o) => !o)}>
          <b>{active + 1}/{total}</b><em>{steps[active]?.label}</em><i aria-hidden="true">{tocOpen ? '▴' : '▾'}</i>
          <span className="sr-only">Step {active + 1} of {total}. {tocOpen ? 'Hide' : 'Show'} all steps</span>
        </button>
        <div className="toc-mini__seg" aria-hidden="true">{steps.map((s, i) => <i key={s.id} className={i <= active ? 'on' : ''} />)}</div>
      </div>
      {/* Full list: always visible on desktop, expandable on phone */}
      <div id="toc-list" className={`toc-list${tocOpen ? ' is-open' : ''}`}>
        <ol>
          {steps.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={i < active ? 'is-done' : i === active ? 'is-now' : ''} aria-current={i === active ? 'step' : undefined}
                onClick={(e) => { e.preventDefault(); scrollTo(s.id); }}>
                <span aria-hidden="true">{i < active ? '✓' : i + 1}</span>
                <em>{s.label}</em>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

const READY = { details: 'ready', evidence: 'ready', certificates: 'ready' };

function Failed({ what, note, onRetry }) {
  return (
    <p className="notice-box" role="status">
      We couldn't load {what}. {note || 'The rest of this page is not affected.'}{' '}
      {onRetry && <button type="button" className="linklike" onClick={onRetry}>Try again</button>}
    </p>
  );
}

/**
 * The whole journey frame is on screen from the moment the lookup starts. `sections` says, per part, whether it is
 * still loading ('loading'), arrived ('ready') or failed ('error'); `result` is null until the notice details arrive.
 * Each section announces its own change politely. Options and help need no data, so they are always shown.
 */
export default function Notice({ result, query, sections = READY, registrationGiven, onPlate, plateBusy, onRetry, onRerun, onEdit, onNew, headingRef }) {
  const [timedOut, setTimedOut] = useState(false); // any photo link has expired
  const report = useCallback(() => setTimedOut(true), []);
  const detailsLoading = sections.details === 'loading';
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  useEffect(() => {
    if (!detailsLoading) { setLoadingTooLong(false); return; }
    const t = setTimeout(() => setLoadingTooLong(true), 45000); // 45s
    return () => clearTimeout(t);
  }, [detailsLoading]);
  const detailsFailed = sections.details === 'error' || (!detailsLoading && !result);
  const n = result?.notice;
  const evLoading = sections.evidence === 'loading';
  const certLoading = sections.certificates === 'loading';
  const evFailed = sections.evidence === 'error';
  useEffect(() => { if (evLoading) setTimedOut(false); }, [evLoading]); // fresh links on a retry
  const certFailed = sections.certificates === 'error';
  // Until the notice is known the camera steps are shown as loading; after that they follow the data.
  const known = !!result && !!n;
  const camera = !known || isCamera(result);
  // The program's video switch decides whether a video is rendered (and so fetched) at all.
  const video = known ? videoView(result) : { render: true, message: null };
  const media = (result?.evidence || []).filter((e) => e.kind !== 'CERTIFICATE' && (video.render || e.kind !== 'VIDEO'));
  const oldCerts = (result?.evidence || []).filter((e) => e.kind === 'CERTIFICATE');
  const ev = known ? evidenceState({ ...result, evidence: [...media, ...(result.evidence || []).filter((e) => e.kind === 'CERTIFICATE')] }, registrationGiven) : 'show';
  const steps = known ? stepsFor(result, ev) : [
    { id: 'step-what', label: 'What happened' }, { id: 'step-evidence', label: 'Was it my vehicle?' },
    { id: 'step-measure', label: 'How it was measured' }, { id: 'step-camera', label: 'Was the camera working?' }, { id: 'step-options', label: 'Your options' },
  ];
  const prog = known ? pickProgram(result) : null;
  const status = known ? statusSummary(n, query?.infringementNumber) : null;
  const certAns = certLoading ? { tone: 'neutral', text: 'Checking the camera certificates…' } : certificateAnswer(result || {});
  const stepNo = (id) => steps.findIndex((s) => s.id === id) + 1;
  const expiredCtx = useMemo(() => ({ rerun: onRerun || null, expired: timedOut, report }), [onRerun, timedOut, report]);
  const demo = result?.source === 'STUB' || result?.source === 'MANIFEST';
  const evAnswer = detailsLoading ? 'Fetching the camera photos…'
    : evLoading ? 'Fetching the camera photos…'
    : evFailed ? "We couldn't load the photos."
    : ev === 'show' ? photosAnswer({ hasVideo: media.some((m) => m.kind === 'VIDEO'), timedOut })
    : ev === 'not-applicable' ? 'This notice was not issued by a camera. There are no camera photos.'
    : ev === 'plate-no-images' ? 'No photos are available for this notice.'
    : ev === 'needs-plate' ? 'Enter your registration number to see the photos.'
    : "We can't show the photos yet.";

  return (
    <ExpiredContext.Provider value={expiredCtx}>
    <div className="wrap page-body">
      <div className="top-nav">
        <button type="button" className="linklike" onClick={onEdit}>← Edit</button>
        <button type="button" className="linklike" onClick={onNew}>New lookup</button>
      </div>
      {query && (
        <p className="query-line" ref={headingRef} tabIndex={-1}>
          {prog?.label || 'Camera offence'}, {niceDate(query.offenceDate)}.
        </p>
      )}
      {demo && <p className="banner" role="note"><strong>Demonstration data only.</strong> This is not a real notice.</p>}

      <section className={`stat is-${status?.tone || 'info'}`} aria-labelledby="stat-h" aria-live="polite" aria-busy={detailsLoading || undefined}>
        {status ? (
          status.resolved ? (
            /* Resolved (paid, caution): confirmation with notice number */
            <div className="stat-resolved">
              <span className="stat-icon" aria-hidden="true">&#9432;</span>
              <div>
                <p className="stat-lead">{status.headline}</p>
                <p className="muted">{status.sub}</p>
              </div>
            </div>
          ) : (
            /* Not paid: compact single-line with options link */
            <div className="stat-compact">
              <span className="stat-icon" aria-hidden="true">&#9432;</span>
              <p className="stat-lead">{status.headline}</p>
              <button type="button" className="stat-link" onClick={() => document.getElementById('step-options')?.scrollIntoView({ behavior: 'smooth' })}>My options ↓</button>
            </div>
          )
        ) : (
          <>
            <h2 id="stat-h">Notice status</h2>
            {detailsFailed ? <p className="stat-lead">We couldn't load your notice.</p>
              : loadingTooLong ? <p className="stat-lead">This is taking longer than expected. Check the notice number and offence date.</p>
              : <p className="stat-lead">Looking up your notice…</p>}
          </>
        )}
      </section>

      <div className="story">
        <StepNav steps={steps} />
        <div>
          <Step n={stepNo('step-what')} id="step-what" title="What happened" answer={detailsLoading ? 'Looking up your notice…' : undefined}>
            {detailsLoading
              ? loadingTooLong
                ? <Failed what="your notice" note="This is taking longer than expected. Check the penalty notice number and offence date are correct." onRetry={onRetry} />
                : <ListSkeleton rows={1} label="Looking up your notice. This can take up to half a minute." />
              : detailsFailed
                ? <Failed what="your notice" onRetry={onRetry} />
                : (
                  <dl className="facts">
                    {n.offenceTime && <div><dt>Time</dt><dd><strong>{niceTime(n.offenceTime)}</strong></dd></div>}
                    <div><dt>Where</dt><dd><strong>{n.location}</strong></dd></div>
                    <div className="span"><dt>Offence</dt><dd><strong>{n.offenceDescription}</strong></dd></div>
                    <div><dt>Penalty</dt><dd><strong>{money(n.penaltyAmount)}</strong></dd></div>
                    <div><dt>Amount owing</dt><dd><strong>{money(n.amountOwing)}</strong></dd></div>
                  </dl>
                )}
          </Step>

          <Step n={stepNo('step-evidence')} id="step-evidence" title={ev === 'not-applicable' ? 'Camera evidence' : 'Was it my vehicle?'} answer={evAnswer}>
            {detailsLoading || evLoading
              ? <PhotoSkeleton label="Fetching the camera photos. This can take up to half a minute." />
              : evFailed || detailsFailed
                ? <Failed what="the photos" onRetry={onRetry} />
              : ev === 'not-applicable'
                ? <p className="muted">This notice was issued by an officer, not a camera. There are no camera photos to show.</p>
              : ev === 'plate-no-images'
                ? <p className="muted">No photos are available for this notice. They may have been removed after the retention period.</p>
                : (
                  <>
                    <EvidenceBody result={result} state={ev} media={media} onPlate={onPlate} plateBusy={plateBusy} timedOut={timedOut} />
                    {camera && ev !== 'needs-plate' && video.message && <p className="notice-box" role="status" data-testid="video-note">{video.message}</p>}
                  </>
                )}
          </Step>

          {camera && known && hasMeasureData(result) && (() => {
            const prog = pickProgram(result);
            const safetyMsg = pickMessage(result);
            return (
              <Step n={stepNo('step-measure')} id="step-measure" title="How it was measured"
                answer={prog?.measureSubtitle || undefined}>
                <ProgramDetails result={result} />
                {safetyMsg && (
                  <Accordion title="Why this matters">
                    <p>{safetyMsg.text}</p>
                  </Accordion>
                )}
                <Accordion title={`How does this ${(prog?.label || 'camera').toLowerCase()} work?`}>
                  <ExplainerCards cards={pickExplainer(result)} />
                </Accordion>
              </Step>
            );
          })()}

          {camera && (
            <Step n={stepNo('step-camera')} id="step-camera" title="Was the camera working properly?" tone={certAns.tone === 'warn' ? 'warn' : ''}
              answer={detailsLoading ? 'Checking the camera certificates…' : certFailed || detailsFailed ? "We couldn't load the certificates." : certAns.text}>
              {detailsLoading || certLoading
                ? <ListSkeleton label="Checking the camera certificates" />
                : certFailed || detailsFailed
                  ? <Failed what="the camera certificates" onRetry={onRetry} />
                  : hasCertificateList(result)
                    ? <Suspense fallback={<ListSkeleton label="Loading the certificates" />}><CertificateList certificates={result.certificates} coverage={result.certificateCoverage} uncoveredTypes={result.uncoveredTypes} /></Suspense>
                    : result?.certificateCoverage?.status === 'none'
                      ? null
                      : oldCerts.length > 0
                        ? <Suspense fallback={<PhotoSkeleton count={oldCerts.length} />}><EvidenceGrid items={oldCerts} /></Suspense>
                        : <p className="notice-box" role="status">Certificate information is not available to show yet. Everything else on this page is still correct.</p>}
            </Step>
          )}

          <Step n={stepNo('step-options')} id="step-options" title="Your options" answer="Whatever you decide, your notice details will be filled in for you.">
            <ul className="option-list">
              {OPTIONS.map((o) => (
                <li key={o.id} className="option-row">
                  <div className="option-info">
                    <strong>{o.title}</strong>
                    <p>{o.text}</p>
                  </div>
                  <a href={o.href} className="option-cta" target="_blank" rel="noopener noreferrer" aria-label={o.cta}>{o.cta}<span aria-hidden="true"> ↗</span></a>
                </li>
              ))}
            </ul>
          </Step>

        </div>
      </div>
    </div>
    </ExpiredContext.Provider>
  );
}
