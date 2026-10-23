import React, { useState } from 'react';
import { Link, Button, Alert, StatusTag, SummaryList, Breadcrumbs } from '../components/ui.jsx';
import { Skeleton, SlowNote, Problem } from '../components/Feedback.jsx';
import Gallery from '../components/Gallery.jsx';
import VideoPlayer from '../components/Media.jsx';
import { EvidencePack, NoticeDocument } from '../pages/EvidencePack.jsx';
import { useApp, apiCtx } from '../state.js';
import { api } from '../services/mockApi.js';
import { evaluatePack } from '../services/evidence.js';
import { useAsync } from '../useAsync.js';
import { useAssets, resolveImage } from '../services/assets.js';
import { programFor, ACTIONS } from '../config/programs.js';
import { fmtDate, fmtDateTime, TODAY } from '../format.js';
import { daysBetween, daysFromToday, weekday, partOfDay, agoText } from '../util.js';
import { go } from '../router.js';

// One page for the notice recipient, ordered by the questions they ask,
// not by which agency holds the data. Ownership is shown only to testers.

export const QUESTIONS = [
  { id: 'q-what', short: 'What happened?', owner: 'Revenue NSW (notice) + Transport (camera site)' },
  { id: 'q-me', short: 'Was it me?', owner: 'Revenue NSW today (myPenalty images)' },
  { id: 'q-enough', short: 'Is the evidence enough?', owner: 'Nobody shows this today' },
  { id: 'q-camera', short: 'Was the camera certified?', owner: 'Transport today (CEVOC certificates)' },
  { id: 'q-do', short: 'What can I do?', owner: 'Revenue NSW / Service NSW' },
];

function Owner({ show, q }) {
  if (!show) return null;
  const item = QUESTIONS.find((x) => x.id === q);
  return <span className="own-chip" role="note">Today: {item.owner}</span>;
}

function QuestionNav({ answered }) {
  return (
    <nav className="story-nav" aria-label="Your questions">
      <ol>
        {QUESTIONS.map((q, i) => (
          <li key={q.id}>
            <a href={`#${q.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(q.id)?.scrollIntoView({ behavior: 'smooth' }); }}>
              <span className={`story-nav__n ${answered[q.id] === false ? 'is-warn' : ''}`}>{i + 1}</span>
              {q.short}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Section({ id, n, title, answer, children, showOwner }) {
  return (
    <section id={id} className="story-q" aria-labelledby={`${id}-h`}>
      <header className="story-q__head">
        <span className="story-q__n" aria-hidden="true">{n}</span>
        <div>
          <h2 id={`${id}-h`}>{title}</h2>
          {answer && <p className="story-q__answer">{answer}</p>}
        </div>
        <Owner show={showOwner} q={id} />
      </header>
      <div className="story-q__body">{children}</div>
    </section>
  );
}

function evidenceVerdict(n, pack, imagesOk) {
  const reasons = [];
  if (!imagesOk) reasons.push('the images can’t be shown right now');
  if (!pack.complete) reasons.push(`${pack.problems.length} legal check${pack.problems.length === 1 ? ' isn’t' : 's aren’t'} met`);
  if (reasons.length === 0) return { ok: true, text: 'Yes. The photos, the measurement and the camera’s legal checks all line up.' };
  return { ok: false, text: `Not completely: ${reasons.join(' and ')}. You can ask Revenue NSW for a review.` };
}

export default function FineStory() {
  const app = useApp();
  const manifest = useAssets();
  const [showOwner, setShowOwner] = useState(false);
  const [doc, setDoc] = useState(false);
  const [action, setAction] = useState(null);
  const n = app.notice;
  const site = useAsync(() => (n ? api.getSite(apiCtx(app), n.site) : Promise.resolve(null)), [n?.site, app.demo.outage, app.demo.latency]);
  const certs = useAsync(() => (n ? api.certificatesForSite(apiCtx(app), n.site) : Promise.resolve([])), [n?.site, app.demo.outage, app.demo.latency, app.demo.certOutage, app.overrides]);

  if (!n)
    return (
      <div className="nsw-container cevoc-page">
        <h1>Find your fine first</h1>
        <Alert type="warning" title="We need to know which fine you’re asking about">
          <p>Start from MyServiceNSW or myPenalty, or enter the details from your notice.</p>
        </Alert>
        <div className="cevoc-actions">
          <Link className="nsw-button nsw-button--dark" to="/notice">Enter notice details</Link>
          <Link className="nsw-button nsw-button--dark-outline" to="/entry">Other ways in</Link>
        </div>
      </div>
    );

  const program = programFor(n.program);
  const pack = evaluatePack(n);
  const published = (n.images || []).filter((i) => i.status === 'published');
  const imagesOk = !n.imagesUnavailable && published.length > 0;
  const verdict = evidenceVerdict(n, pack, imagesOk);
  const s = site.data;
  const ago = daysBetween(n.dateTime, TODAY);
  const left = n.due ? daysFromToday(n.due) : null;
  const video = n.media && n.media[0];

  const answered = { 'q-enough': verdict.ok, 'q-camera': pack.complete };

  const whatAnswer = `${n.offence}, ${weekday(n.dateTime)} ${partOfDay(n.dateTime)}, ${agoText(ago)}${s ? `, ${s.suburb}` : ''}.`;
  const meAnswer = n.imagesUnavailable
    ? 'We can’t show the images right now.'
    : imagesOk
    ? `Check the number plate ${n.rego} in the photos below.`
    : 'No images are available for this fine.';
  const camAnswer = pack.complete ? 'Yes. Every certificate the law requires was in date.' : `${pack.problems.length} required check${pack.problems.length === 1 ? ' was' : 's were'} not met.`;

  return (
    <div className="nsw-container cevoc-page story">
      <Breadcrumbs items={[['Home', '/'], ['Your fine', '/notice/result']]} />
      <div className="story-top">
        <div>
          <p className="cevoc-eyebrow">Fine {n.number} · {program.label}</p>
          <h1>Your fine, explained</h1>
          <p className="nsw-intro">Everything about this fine in one place: what happened, the photos, whether the evidence holds up, and what you can do.</p>
        </div>
        <button type="button" className={`own-toggle ${showOwner ? 'is-on' : ''}`} onClick={() => setShowOwner(!showOwner)} aria-pressed={showOwner}>
          Tester view: {showOwner ? 'hide' : 'show'} who owns each part today
        </button>
      </div>

      {n.status === 'review' ? (
        <Alert type="info" title="Your review request is being considered">
          <p>You asked on {fmtDate(n.reviewLodged)}. You don’t need to do anything else right now.</p>
        </Alert>
      ) : left != null && (
        <Alert type={left <= 7 ? 'warning' : 'info'} title={left < 0 ? `The due date (${fmtDate(n.due)}) has passed` : `Due ${fmtDate(n.due)}: ${left} day${left === 1 ? '' : 's'} left`}>
          <p>You can still look at everything below first. Options, including more time to pay, are at the end.</p>
        </Alert>
      )}

      <div className="story-layout">
        <QuestionNav answered={answered} />
        <div className="story-main">
          <Section id="q-what" n="1" title="What happened?" answer={whatAnswer} showOwner={showOwner}>
            <div className="story-facts">
              <div><span>When</span><strong>{weekday(n.dateTime)}, {fmtDateTime(n.dateTime)}</strong><small>{agoText(ago)} · notice issued {n.issued ? `${daysBetween(n.dateTime, n.issued)} days later` : '—'}</small></div>
              <div><span>Where</span><strong>{s ? s.name : n.site}</strong><small>{s ? `Heading ${s.direction.toLowerCase()}, ${s.speedLimit} km/h zone` : ''}</small></div>
              <div><span>Vehicle</span><strong>{n.rego}</strong><small>{n.vehicle}</small></div>
            </div>
            {s && <img className="story-site" src={resolveImage(manifest, s.photo.slot, s.photo.fallback)} alt={`Camera location: ${s.name}`} />}
            <p className="cevoc-muted">Don’t remember it? Notices often arrive weeks later. The time of day and place above are the best memory joggers.</p>
            <Button variant="dark-outline" onClick={() => setDoc(true)}>See the notice as it was sent</Button>
          </Section>

          <Section id="q-me" n="2" title="Was it me?" answer={meAnswer} showOwner={showOwner}>
            {n.imagesUnavailable ? (
              <Alert type="warning" title="Images can’t be shown right now">
                <p>The image service isn’t responding. Everything else on this page is correct.</p>
              </Alert>
            ) : (n.images || []).length ? (
              <Gallery images={n.images} idPrefix={n.number} />
            ) : (
              <p>No images are available for this fine.</p>
            )}
            {video && app.demo.media && (
              <div className="story-video">
                <h3>Video <StatusTag status="future" /></h3>
                <VideoPlayer video={video} downloadName={`${n.number}-${video.id}-SAMPLE.mp4`} />
                <p className="cevoc-muted">Video is a proposed future capability, not approved. Sample clip.</p>
              </div>
            )}
            <p className="cevoc-muted">Not your vehicle, or someone else was driving? See “You weren’t driving” under question 5.</p>
          </Section>

          <Section id="q-enough" n="3" title="Is the evidence enough?" answer={verdict.text} showOwner={showOwner}>
            <ul className="story-checks">
              <li className={imagesOk ? 'ok' : 'warn'}>
                <strong>Photos</strong> {imagesOk ? `${published.length} photo${published.length === 1 ? '' : 's'}, each with a tamper-evident security code.` : 'Not available right now.'}
              </li>
              <li className="ok">
                <strong>Measurement</strong>{' '}
                {program.measurement === 'average' && n.segment
                  ? `${n.segment.distanceKm} km between two cameras in ${Math.round((n.segment.distanceKm / n.recordedSpeed) * 60)} minutes = ${n.recordedSpeed} km/h average${s ? ` (limit ${s.speedLimit})` : ''}.`
                  : program.measurement === 'signal'
                  ? `Light had been red for ${n.redFor ?? '—'} seconds when the vehicle crossed the line.`
                  : n.recordedSpeed && s
                  ? `${n.recordedSpeed} km/h in a ${s.speedLimit} km/h zone.`
                  : 'Recorded by the camera.'}
              </li>
              <li className={pack.complete ? 'ok' : 'warn'}>
                <strong>Camera legal checks</strong> {pack.complete ? 'All met (see question 4).' : `${pack.problems.length} not met (see question 4).`}
              </li>
            </ul>
            <details className="nsw-accordion">
              <summary>How this camera works</summary>
              <p>{program.explainer}</p>
            </details>
            <p className="cevoc-muted">This is a plain-English summary, not legal advice.</p>
          </Section>

          <Section id="q-camera" n="4" title="Was the camera certified at the time?" answer={camAnswer} showOwner={showOwner}>
            {certs.error ? (
              <Problem error={certs.error} onRetry={certs.reload} />
            ) : certs.loading ? (
              <>
                <Skeleton lines={3} label="Checking certification" />
                <SlowNote active />
              </>
            ) : (
              <EvidencePack notice={n} officerView={false} />
            )}
            {s && <p><Link to={`/cameras/${s.code}`}>Full certificate history for this camera</Link></p>}
          </Section>

          <Section id="q-do" n="5" title="What can I do?" answer="Choose what fits. None of these is the “right” answer." showOwner={showOwner}>
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
            {action && (
              <Alert type="info" title={ACTIONS[action].title}>
                <p>In the target service this continues in Revenue NSW or MyServiceNSW with this fine already filled in. Prototype only: not connected.</p>
              </Alert>
            )}
            <Button variant="dark-outline" onClick={() => { app.setNotice(null); go('/notice'); }}>Look at another fine</Button>
          </Section>
        </div>
      </div>
      {doc && <NoticeDocument notice={n} onClose={() => setDoc(false)} />}
    </div>
  );
}
