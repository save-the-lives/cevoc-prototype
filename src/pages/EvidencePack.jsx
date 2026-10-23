import React, { useEffect, useState } from 'react';
import { Link, Button, Alert, StatusTag, Dialog, Loading } from '../components/ui.jsx';
import { Problem } from '../components/Feedback.jsx';
import { NoticeLookup, NoticeResult } from './Notice.jsx';
import { ReviewCase } from './OfficerReview.jsx';
import { useApp, apiCtx } from '../state.js';
import { api, can } from '../services/mockApi.js';
import { evaluatePack } from '../services/evidence.js';
import { RULES, REQUIRED, SECURITY_INDICATOR } from '../config/evidenceRules.js';
import { programFor } from '../config/programs.js';
import { NOTICE_DOCS, mockIndicator } from '../data/evidence.js';
import { NOTICES, SITES, REVIEW_CASES } from '../data/mockData.js';
import { go } from '../router.js';
import { query } from '../util.js';
import { fmtDate, fmtDateTime } from '../format.js';

const STATUS = {
  ok: ['current', 'Met'],
  lapsed: ['unavailable', 'Not met'],
  missing: ['unavailable', 'Not found'],
  'on-request': ['info', 'Prepared if needed'],
};

// Looks the notice up automatically when the link carries n and r, so results show straight away.
export function NoticeAuto({ path }) {
  const app = useApp();
  const q = query(path);
  const auto = !!(q.n && q.r);
  const [state, setState] = useState(auto ? 'loading' : 'form');
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!auto) return undefined;
    let live = true;
    api
      .lookupNotice(apiCtx(app), q.n.replace(/\s/g, ''), q.r)
      .then((n) => {
        if (!live) return;
        if (n) {
          app.setNotice(n);
          go('/notice/result');
        } else {
          setErr('nomatch');
          setState('form');
        }
      })
      .catch((e) => {
        if (!live) return;
        setErr(e);
        setState('form');
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (state === 'loading')
    return (
      <div className="nsw-container cevoc-page">
        <h1>Finding your offence</h1>
        <Loading text="Checking your notice details" />
      </div>
    );

  return (
    <>
      {err && (
        <div className="nsw-container" style={{ paddingTop: '1rem' }}>
          {err === 'nomatch' ? (
            <Alert type="warning" title="We couldn’t find a matching offence">
              <p>Check that the penalty notice number and registration match your notice exactly.</p>
            </Alert>
          ) : (
            <Problem error={err} />
          )}
        </div>
      )}
      <NoticeLookup path={path} />
    </>
  );
}

function CertDocument({ item, notice }) {
  const c = item.cert;
  const site = SITES.find((s) => s.code === c.site);
  const r = item.rule;
  return (
    <article className="cevoc-legalcert">
      <p className="cevoc-certificate__sample">SAMPLE · FICTITIOUS · NOT A REAL CERTIFICATE</p>
      <p className="cevoc-legalcert__law">{r.law}</p>
      <h3>{item.title}</h3>
      {c.rule === 's137' && (
        <p>
          I, <strong>{c.officer.name}</strong> ({c.officer.id}), an appropriate inspection officer for the device, certify that: (a) device{' '}
          <strong>{c.deviceSerial}</strong> at {site?.name} is an approved traffic enforcement device approved for speed measurement ({c.gazette}); (b) on{' '}
          <strong>{fmtDate(c.date)}</strong> the device was tested in accordance with the statutory rules and sealed (seal {c.sealNo}); and (c) on that day the device
          was accurate and operating properly.
        </p>
      )}
      {c.rule === 's138' && (
        <>
          <p>
            I, <strong>{c.officer.name}</strong> ({c.officer.id}), an appropriate inspection officer, certify that on <strong>{fmtDate(c.date)}</strong>
            {c.time ? ` at ${c.time}` : ''} I inspected the approved traffic enforcement device <strong>{c.deviceSerial}</strong>
            {c.point ? ` at Point ${c.point}` : ''} of {site?.name} and found it to be operating correctly.
            {c.sessionText ? ` ${c.sessionText}.` : ''}
          </p>
          {c.gazette && <p className="cevoc-muted">{c.gazette}</p>}
          <ul className="cevoc-checks">
            {c.checks.map((x) => (
              <li key={x}>✓ {x}</li>
            ))}
          </ul>
        </>
      )}
      {c.rule === 's132' && (
        <p>
          I, <strong>{c.officer.name}</strong> ({c.officer.id}), a registered surveyor, certify that on <strong>{fmtDate(c.date)}</strong> the shortest practicable
          distance between Point A and Point B of the {site?.name} is <strong>{c.distanceKm.toFixed(3)} km</strong>. The average speed limit for the length of road is{' '}
          <strong>{c.limit} km/h</strong> ({c.heavyLimit} km/h for heavy vehicles). {c.description}
        </p>
      )}
      {c.rule === 's257' && (
        <p>
          Certified extract of Transport records dated <strong>{fmtDate(c.date)}</strong>, prepared by {c.officer.name} ({c.officer.id}): {c.description}
        </p>
      )}
      <p className="cevoc-muted">
        Relates to penalty notice {notice.number}, offence on {fmtDateTime(notice.dateTime)}.
      </p>
    </article>
  );
}

function plainLine(item) {
  if (item.status === 'missing') return `No ${item.rule.publicLabel.toLowerCase()} record found before the offence.`;
  const c = item.cert;
  if (item.status === 'on-request') return `${item.rule.publicLabel}: ${item.rule.windowText}.`;
  if (c.rule === 's132') return `Surveyed ${fmtDate(c.date)}: ${c.distanceKm} km between the cameras.`;
  if (item.rule.sameDay)
    return item.status === 'ok'
      ? `Checked at ${c.time} on the day, before the session started.`
      : `Last check ${fmtDate(c.date)}. A check is needed ${item.rule.windowText}.`;
  const when = `${fmtDate(c.date)}, ${item.age} day${item.age === 1 ? '' : 's'} before the offence`;
  return item.status === 'ok'
    ? `${item.rule.publicLabel} ${when}. Required ${item.rule.windowText}.`
    : `${item.rule.publicLabel} ${when}. Required ${item.rule.windowText}, so this check is not met.`;
}

export function EvidencePack({ notice, officerView }) {
  const [open, setOpen] = useState(null);
  const pack = evaluatePack(notice);
  const program = programFor(notice.program);
  const images = (notice.images || []).filter((i) => i.status === 'published');

  return (
    <section className="cevoc-pack" aria-labelledby="pack-h">
      <h2 id="pack-h" className="cevoc-h2">
        {officerView ? 'Statutory evidence pack' : 'Legal checks for this camera'}{' '}
        {pack.complete ? <StatusTag status="current" label="All checks met" /> : <StatusTag status="unavailable" label={`${pack.problems.length} not met`} />}
      </h2>
      <p className="cevoc-muted">
        {program.label}: the law requires the certificates below for this kind of camera.{' '}
        <Link to="/evidence-rules">How these rules work</Link>
      </p>
      {!pack.known && (
        <div className="cevoc-proto-note" role="note">
          No certificate rules are configured for <code>{notice.program}</code>, so the default set (s137 and s138(2)) is checked.
        </div>
      )}
      {!pack.complete && (
        <Alert type="warning" title={officerView ? 'Evidence pack incomplete' : 'One or more legal checks aren’t met'}>
          <p>
            {officerView
              ? 'This notice may not be supported in court. Consider withdrawing it or referring it to Transport.'
              : 'You may want to ask Revenue NSW for a review and mention this. This isn’t legal advice.'}
          </p>
        </Alert>
      )}

      <ul className="cevoc-packlist">
        {pack.items.map((item, i) => (
          <li key={i} className={`cevoc-packitem is-${item.status}`}>
            <div className="cevoc-packitem__head">
              <span className="cevoc-packitem__sec">{item.rule.section}</span>
              <strong>{item.title}</strong>
              <StatusTag status={STATUS[item.status][0]} label={STATUS[item.status][1]} />
            </div>
            <p>{officerView ? item.rule.plain : ''} {plainLine(item)}</p>
            {item.cert && (officerView || item.status !== 'on-request') && (
              <Button variant="dark-outline" onClick={() => setOpen(item)}>
                View certificate
              </Button>
            )}
          </li>
        ))}
      </ul>

      {images.length > 0 && (
        <details className="nsw-accordion">
          <summary>Image security indicators ({images.length})</summary>
          <p className="cevoc-muted">{SECURITY_INDICATOR.plain} {SECURITY_INDICATOR.law}. Values below are mock.</p>
          <table className="nsw-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>SHA-256 security indicator (mock)</th>
              </tr>
            </thead>
            <tbody>
              {images.map((im) => (
                <tr key={im.id}>
                  <td>{im.id}</td>
                  <td><code className="cevoc-hash">{mockIndicator(`${notice.number}:${im.id}`)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {open && (
        <Dialog wide title={open.title} onClose={() => setOpen(null)}>
          <CertDocument item={open} notice={notice} />
          <div className="cevoc-actions">
            <Button onClick={() => window.print()}>Print</Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

export function NoticeDocument({ notice, onClose }) {
  const doc = NOTICE_DOCS[notice.number] || { to: ['The Registered Operator'], offenceCode: 'MOCK', amount: 'XXX.00', demerits: 'X' };
  const site = SITES.find((s) => s.code === notice.site);
  const program = programFor(notice.program);
  return (
    <Dialog wide title={`Penalty notice ${notice.number}`} onClose={onClose}>
      <article className="cevoc-pn">
        <div className="cevoc-pn__watermark" aria-hidden="true">SAMPLE</div>
        <header className="cevoc-pn__head">
          <div>
            <strong>Revenue NSW</strong>
            <span>Penalty Notice (MOCK)</span>
          </div>
          <div className="cevoc-pn__ref">
            <span>Penalty notice number</span>
            <strong>{notice.number}</strong>
          </div>
        </header>
        <div className="cevoc-pn__grid">
          <address className="cevoc-pn__to">
            {doc.to.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
          <dl className="cevoc-pn__dates">
            <div><dt>Date issued</dt><dd>{notice.issued ? fmtDate(notice.issued) : '—'}</dd></div>
            <div><dt>Due date</dt><dd>{notice.due ? fmtDate(notice.due) : '—'}</dd></div>
            <div><dt>Amount payable</dt><dd>${doc.amount}</dd></div>
          </dl>
        </div>
        <h3>Offence details</h3>
        <table className="nsw-table">
          <tbody>
            <tr><th scope="row">Offence</th><td>{notice.offence}</td></tr>
            <tr><th scope="row">Offence code</th><td>{doc.offenceCode}</td></tr>
            <tr><th scope="row">Date and time</th><td>{fmtDateTime(notice.dateTime)}</td></tr>
            <tr><th scope="row">Location</th><td>{site ? `${site.name}, ${site.direction}` : notice.site}</td></tr>
            <tr><th scope="row">Camera</th><td>{program.label} · {notice.site}</td></tr>
            <tr><th scope="row">Vehicle</th><td>{notice.vehicle} · {notice.rego}</td></tr>
            {notice.recordedSpeed && site && (
              <tr><th scope="row">Speed</th><td>{notice.recordedSpeed} km/h {notice.segment ? 'average ' : ''}in a {site.speedLimit} km/h zone</td></tr>
            )}
            <tr><th scope="row">Demerit points</th><td>{doc.demerits}</td></tr>
          </tbody>
        </table>
        {doc.note && <p className="cevoc-muted">{doc.note}</p>}
        <h3>What you can do by the due date</h3>
        <ul>
          <li>Pay the full amount, or ask about a payment plan or more time to pay.</li>
          <li>Ask for a review if you think the fine is wrong or there were special circumstances.</li>
          <li>Nominate the driver if you weren’t driving.</li>
          <li>Elect to have the matter decided by a court.</li>
        </ul>
        <p className="cevoc-pn__view">
          View the photos and camera certification online with your notice number and registration (this prototype).
        </p>
        <footer className="cevoc-pn__foot">
          FICTITIOUS SAMPLE for prototyping. Names, addresses, offence codes, amounts and demerit points are invented and do not reflect current NSW penalties.
        </footer>
      </article>
    </Dialog>
  );
}

// Offence page plus the notice letter and legal checks.
export function NoticeResultV5() {
  const app = useApp();
  const [showDoc, setShowDoc] = useState(false);
  const n = app.notice;
  return (
    <>
      <NoticeResult />
      {n && (
        <div className="nsw-container cevoc-page cevoc-page--tight">
          <section className="cevoc-panel">
            <h2 className="cevoc-h2">Your penalty notice</h2>
            <p>See the notice as it was sent, including the amount and due date.</p>
            <Button variant="dark-outline" onClick={() => setShowDoc(true)}>View penalty notice</Button>
          </section>
          <EvidencePack notice={n} officerView={!!app.officer && can(app.officer, 'cert:restricted')} />
          {showDoc && <NoticeDocument notice={n} onClose={() => setShowDoc(false)} />}
        </div>
      )}
    </>
  );
}

// Review workspace plus the full statutory evidence pack.
export function ReviewCaseV5({ id }) {
  const app = useApp();
  const [showDoc, setShowDoc] = useState(false);
  const kase = REVIEW_CASES.find((c) => c.id === id);
  const notice = kase && NOTICES.find((x) => x.number === kase.notice);
  return (
    <>
      <ReviewCase id={id} />
      {notice && can(app.officer, 'review') && (
        <>
          <div className="cevoc-actions">
            <Button variant="dark-outline" onClick={() => setShowDoc(true)}>View penalty notice as issued</Button>
          </div>
          <EvidencePack notice={notice} officerView />
          {showDoc && <NoticeDocument notice={notice} onClose={() => setShowDoc(false)} />}
        </>
      )}
    </>
  );
}

const PROGRAM_ORDER = ['FIXED_SPEED', 'MOBILE_SPEED', 'AVERAGE_SPEED', 'RED_LIGHT', 'RED_LIGHT_SPEED', 'MOBILE_PHONE'];

export function EvidenceRules() {
  return (
    <div className="nsw-container cevoc-page">
      <h1>How camera evidence is checked</h1>
      <p className="nsw-intro">
        Before a camera photo can be relied on, NSW law requires certificates showing the camera was approved, tested and inspected within set time limits.
      </p>
      <Alert type="info">
        <p>Plain-English summary for this prototype, not legal advice. Check the current Road Transport Act 2013 and Road Transport (General) Regulation 2021.</p>
      </Alert>
      <h2 className="cevoc-h2">The certificates</h2>
      <div className="cevoc-table-wrap">
        <table className="nsw-table">
          <thead>
            <tr><th>Section</th><th>Certificate</th><th>What it shows</th><th>Time limit</th><th>Source</th></tr>
          </thead>
          <tbody>
            {Object.entries(RULES).map(([k, r]) => (
              <tr key={k}>
                <td><strong>{r.section}</strong></td>
                <td>{r.title}</td>
                <td>{r.plain}</td>
                <td>{r.windowText}</td>
                <td><small>{r.law}</small></td>
              </tr>
            ))}
            <tr>
              <td><strong>s138(1)</strong></td>
              <td>Security indicator</td>
              <td>{SECURITY_INDICATOR.plain}</td>
              <td>On every digital photo</td>
              <td><small>{SECURITY_INDICATOR.law}</small></td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2 className="cevoc-h2">What each camera type needs</h2>
      <div className="cevoc-table-wrap">
        <table className="nsw-table">
          <thead>
            <tr><th>Camera type</th><th>Certificates checked</th></tr>
          </thead>
          <tbody>
            {PROGRAM_ORDER.map((code) => (
              <tr key={code}>
                <td>{programFor(code).label}</td>
                <td>{REQUIRED[code].map((r) => `${RULES[r.rule].section}${r.label ? ` (${r.label})` : ''}`).join(' · ')}</td>
              </tr>
            ))}
            <tr>
              <td>Any program not yet configured</td>
              <td>s137 · s138(2) (default)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="cevoc-muted">
        Program sets are based on sample evidence briefs and need confirming with program owners.{' '}
        <Link to="/notice?n=3162457895&r=NEW001">See a notice where a check isn’t met</Link>
      </p>
    </div>
  );
}
