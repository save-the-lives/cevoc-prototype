import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Dialog, NswLockup, Spinner } from '../shared/ui.jsx';
import MediaGallery from '../shared/MediaGallery.jsx';
import Measure from './Measure.jsx';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { evaluate, daysBetween } from '../lib/rules.js';
import { planFaults } from '../lib/faults.js';
import { useSim } from '../lib/useSim.js';
import { NOTICES, SITES, CERTS, PROGRAMS, CASES, SCENARIOS, notice as findNotice, site as findSite } from '../data.js';
import { TODAY, fmtDate, fmtTime, weekday, partOfDay, ago } from '../lib/format.js';

// PUBLIC SITE: for the person who received the notice. No login, no staff entry, calm and plain.

function Header() {
  return (
    <>
      <div className="pub-masthead"><div className="nsw-container">A NSW Government website</div></div>
      <header className="nsw-header">
        <div className="nsw-header__container">
          <div className="nsw-header__inner">
            <div className="nsw-header__main">
              <div className="nsw-header__title">
                <Link to="/" className="pub-brand">
                  <NswLockup />
                  <span className="pub-brand__name"><span className="nsw-header__name">Camera-detected offences</span><span className="nsw-header__description">Transport for NSW</span></span>
                </Link>
              </div>
              <nav className="pub-nav" aria-label="Main">
                <Link to="/">View a notice</Link>
                <Link to="/cameras">Check a camera</Link>
              </nav>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

function Footer() {
  return (
    <footer className="pub-footer">
      <div className="nsw-container pub-footer__in">
        <span>Need help? Revenue NSW 1300 138 118</span>
        <span>Prototype · all notices, people and images are fictitious</span>
      </div>
    </footer>
  );
}

// Sample notices open as a dropdown from the notice number field. Demo-only styling (amber).
function NoticeField({ value, onChange, onPick, error }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="nsw-form__group pub-field" ref={ref}>
      <label className="nsw-form__label" htmlFor="pn">Penalty notice number</label>
      <span className="nsw-form__helper" id="pn-hint">10 digits, at the top right of your notice</span>
      {error && <span className="nsw-form__helper nsw-form__helper--error" role="alert">{error}</span>}
      <div className="pn-wrap">
        <input id="pn" className="nsw-form__input" inputMode="numeric" autoComplete="off" aria-describedby="pn-hint" value={value}
          onFocus={() => !value && setOpen(true)} onClick={() => !value && setOpen(true)}
          onChange={(e) => { onChange(e.target.value); setOpen(false); }} />
        <button type="button" className="pn-samples" onClick={() => setOpen(!open)} aria-expanded={open}>Samples ▾</button>
      </div>
      {open && (
        <div className="snp-pop" role="listbox" aria-label="Sample notices">
          <div className="snp-strip">PROTOTYPE · SAMPLE NOTICES · ONE PER CAMERA PROGRAM</div>
          {SCENARIOS.map((s) => {
            const n = findNotice(s.notice);
            const p = PROGRAMS[findSite(n.site).program];
            return (
              <button key={s.notice} type="button" role="option" className="snp-item" onClick={() => { onPick(n); setOpen(false); }}>
                <span className="snp-num">{n.number}</span>
                <span className="snp-meta"><strong>{p.label}</strong>{s.hasVideo ? ' · ▶ video' : ''}<br />{s.title} · {fmtDate(n.dateTime)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Lookup() {
  const [num, setNum] = useState('');
  const [date, setDate] = useState('');
  const [err, setErr] = useState(null);
  const [fe, setFe] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const x = {};
    if (!/^\d{10}$/.test(num.replace(/\s/g, ''))) x.num = 'Enter the 10-digit number from your notice';
    if (!date) x.date = 'Enter the date of the offence';
    setFe(x); setErr(null);
    if (Object.keys(x).length) return;
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      const n = NOTICES.find((y) => y.number === num.replace(/\s/g, '') && y.dateTime.slice(0, 10) === date);
      if (!n) setErr('nomatch'); else go(`/notice/${n.number}`);
    }, 600);
  };

  return (
    <>
      <section className="pub-hero">
        <div className="nsw-container">
          <h1>Understand a camera-detected offence</h1>
          <p>Getting a fine is stressful. Here you can see what the camera recorded, check it was working properly, and find your options. It takes a few minutes.</p>
        </div>
      </section>
      <div className="nsw-container pub-page">
        <div className="pub-two">
          <form className="pub-form" onSubmit={submit} noValidate>
            <h2>Find your notice</h2>
            {err === 'nomatch' && <div className="nsw-in-page-alert nsw-in-page-alert--warning" role="alert"><div className="nsw-in-page-alert__content"><strong>We couldn’t find that notice.</strong> Please check both details match the letter. For your privacy we don’t say which one didn’t match.</div></div>}
            <NoticeField value={num} onChange={setNum} error={fe.num}
              onPick={(n) => { setNum(n.number); setDate(n.dateTime.slice(0, 10)); setFe({}); setErr(null); }} />
            <div className="nsw-form__group">
              <label className="nsw-form__label" htmlFor="od">Date of the offence</label>
              <span className="nsw-form__helper">Shown on the notice</span>
              {fe.date && <span className="nsw-form__helper nsw-form__helper--error" role="alert">{fe.date}</span>}
              <input id="od" className="nsw-form__input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button type="submit" className="nsw-button nsw-button--dark" disabled={busy}>{busy ? <><Spinner /> Finding it…</> : 'Show me what happened'}</button>
          </form>
          <aside className="pub-aside">
            <h2>Before you start</h2>
            <ul>
              <li>We only ask for two details from your notice.</li>
              <li>We never ask for card or bank details on this page.</li>
              <li>Paying, reviews and nominations stay with Revenue NSW. We’ll take you there.</li>
            </ul>
          </aside>
        </div>
      </div>
    </>
  );
}

function Section({ n, title, answer, tone, children }) {
  return (
    <section className="q" id={`q${n}`} aria-labelledby={`q${n}-h`}>
      <div className={`q-n ${tone === 'warn' ? 'is-warn' : ''}`} aria-hidden="true">{n}</div>
      <div className="q-body">
        <h2 id={`q${n}-h`}>{title}</h2>
        {answer && <p className="q-answer">{answer}</p>}
        {children}
      </div>
    </section>
  );
}

function CertList({ n, fault }) {
  const { statusOf } = useStore();
  const { status, retry } = useSim(fault, 700, [n.number]);
  const ev = evaluate(n, statusOf);
  if (status === 'error')
    return (
      <div className="nsw-in-page-alert nsw-in-page-alert--error" role="alert"><div className="nsw-in-page-alert__content">
        <strong>We can’t check the certificates right now.</strong> Everything else on this page is correct. <button type="button" className="pub-link" onClick={retry}>Try again</button></div></div>
    );
  if (status !== 'ready')
    return <p className="pub-loading"><Spinner /> {status === 'slow' ? 'Still checking certificates, taking longer than usual…' : 'Checking the camera’s certificates…'}</p>;
  return (
    <ul className="certs">
      {ev.items.map((it, i) => (
        <li key={i} className={it.current ? 'is-ok' : 'is-warn'}>
          <span className="certs-ic" aria-hidden="true">{it.current ? '✓' : '!'}</span>
          <div>
            <strong>{it.req.label}</strong>
            <p>{it.cert ? `${fmtDate(it.cert.date)}${it.age ? `, ${it.age} days before the offence` : ', on the day'}. The law requires this ${it.req.window}.` : it.why}</p>
            {it.withdrawn && <p className="muted">A later certificate was withdrawn by Transport and doesn’t count.</p>}
          </div>
          <span className={`nsw-status-label nsw-status-label--${it.current ? 'success' : 'warning'}`}>{it.current ? 'Current' : 'Not current'}</span>
        </li>
      ))}
    </ul>
  );
}

function NoticePage({ number }) {
  const { statusOf, faultSettings } = useStore();
  const [leaving, setLeaving] = useState(false);
  const n = findNotice(number);
  const plan = useMemo(() => (n ? planFaults(n, faultSettings) : {}), [n, JSON.stringify(faultSettings)]); // eslint-disable-line
  if (!n) return <div className="nsw-container pub-page"><h1>Notice not found</h1><Link to="/">Start again</Link></div>;

  const s = findSite(n.site);
  const prog = PROGRAMS[s.program];
  const ev = evaluate(n, statusOf);
  const left = daysBetween(TODAY, n.due);
  const openCase = CASES.find((c) => c.notice === n.number);
  const lag = daysBetween(n.dateTime, n.issued);
  const hasVideo = n.media.some((m) => m.type === 'video');

  const evidenceAnswer = ev.current
    ? 'Yes. The images, the measurement and the camera’s legal certificates all line up.'
    : `Not completely. ${ev.notCurrent} of the camera’s certificates ${ev.notCurrent > 1 ? 'were' : 'was'} not current on the day. You may want to mention this if you ask for a review.`;

  return (
    <div className="nsw-container pub-page">
      <p className="pub-crumb"><Link to="/">View a notice</Link> <span aria-hidden="true">›</span> {n.number}</p>
      <h1>What happened</h1>
      <p className="pub-lede">{prog.label} · Penalty notice {n.number}</p>

      {openCase ? (
        <div className="nsw-in-page-alert nsw-in-page-alert--info"><div className="nsw-in-page-alert__content"><strong>Your {openCase.type === 'court' ? 'court election' : 'review request'} is with Revenue NSW.</strong> You don’t need to do anything else for now. This page shows the same evidence they’re looking at.</div></div>
      ) : (
        <div className={`nsw-in-page-alert nsw-in-page-alert--${left <= 7 ? 'warning' : 'info'}`}><div className="nsw-in-page-alert__content">
          <strong>{left < 0 ? `The due date (${fmtDate(n.due)}) has passed.` : `You have until ${fmtDate(n.due)} (${left} days) to decide what to do.`}</strong> Take your time to read through. Help with paying is available if you need it.
        </div></div>
      )}

      <div className="pub-story">
        <nav className="pub-toc" aria-label="On this page">
          {['What happened', 'Was it my vehicle?', 'How it was measured', 'Was the camera working?', 'Your options'].map((t, i) => (
            <a key={t} href={`#/notice/${n.number}`} onClick={(e) => { e.preventDefault(); document.getElementById(`q${i + 1}`)?.scrollIntoView({ behavior: 'smooth' }); }}>
              <span className={i === 3 && !ev.current ? 'is-warn' : ''}>{i + 1}</span>{t}
            </a>
          ))}
        </nav>

        <div>
          <Section n={1} title="What happened" answer={`${weekday(n.dateTime)} ${partOfDay(n.dateTime)}, ${ago(daysBetween(n.dateTime, TODAY))}, in ${s.suburb}.`}>
            <div className="facts">
              <div><span>When</span><strong>{fmtDate(n.dateTime)}</strong><small>{fmtTime(n.dateTime)}</small></div>
              <div><span>Where</span><strong>{s.name}</strong><small>Heading {s.direction.toLowerCase()}</small></div>
              <div><span>Vehicle</span><strong>{n.rego}</strong><small>{n.vehicle}</small></div>
              <div><span>Offence</span><strong>{n.offence}</strong></div>
            </div>
            <p className="muted">Don’t remember the trip? That’s common. The notice was posted {lag} days after it happened.</p>
          </Section>

          <Section n={2} title="Was it my vehicle?" answer={`Check the number plate ${n.rego} in the images${hasVideo ? ' and video' : ''}.`}>
            <MediaGallery items={n.media} plan={plan} prefix={n.number} variant="public" />
            <p className="muted">If someone else was driving, you can nominate them with Revenue NSW (see Your options).</p>
          </Section>

          <Section n={3} title="How it was measured" answer={prog.measureLabel}>
            <Measure n={n} program={s.program} />
            <details className="pub-more"><summary>How a {prog.label.toLowerCase()} works</summary><p>{prog.how}</p></details>
          </Section>

          <Section n={4} title="Was the camera working properly?" tone={ev.current ? '' : 'warn'} answer={evidenceAnswer}>
            <CertList n={n} fault={plan.certs} />
            <p className="muted">This is a plain-English summary, not legal advice. <Link to={`/camera/${s.code}`}>See all certificates for this camera</Link></p>
          </Section>

          <Section n={5} title="Your options" answer="Whatever you decide, Revenue NSW handles it. Your notice details will be filled in for you.">
            <ul className="opts">
              <li><strong>Pay</strong> in full, or ask for a payment plan or more time if money is tight</li>
              <li><strong>Ask for a review</strong> if you think the fine is wrong or there were special circumstances</li>
              <li><strong>Nominate the driver</strong> if it wasn’t you</li>
              <li><strong>Have a court decide</strong></li>
            </ul>
            <div className="handoff">
              <div><span className="owner-tag">Revenue NSW</span><p>Opens in a new tab. You can come back here any time.</p></div>
              <button type="button" className="nsw-button nsw-button--dark" onClick={() => setLeaving(true)}>Continue with Revenue NSW ↗</button>
            </div>
          </Section>
        </div>
      </div>

      {leaving && (
        <Dialog title="You’re going to Revenue NSW" onClose={() => setLeaving(false)}>
          <p>Revenue NSW handles payments, payment plans, reviews, nominations and court elections. Notice {n.number} will be ready for you there.</p>
          <p className="proto-line">Prototype: Revenue NSW isn’t connected, so nothing will open.</p>
          <div className="dlg-actions"><button type="button" className="nsw-button nsw-button--dark-outline" onClick={() => setLeaving(false)}>Stay on this page</button></div>
        </Dialog>
      )}
    </div>
  );
}

function Cameras() {
  const [q, setQ] = useState('');
  const list = SITES.filter((s) => (s.code + s.name + s.suburb).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="nsw-container pub-page">
      <h1>Check a camera</h1>
      <p className="pub-lede">See any camera’s certificates, with or without a notice.</p>
      <label className="sr-only" htmlFor="camq">Search cameras</label>
      <input id="camq" className="nsw-form__input pub-search" placeholder="Search by road, suburb or camera code" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="cam-list">
        {list.map((s) => (
          <li key={s.code}><Link to={`/camera/${s.code}`}><strong>{s.name}</strong><span>{PROGRAMS[s.program].label} · {s.code}</span></Link></li>
        ))}
        {!list.length && <li className="muted">No cameras match. Try a suburb name.</li>}
      </ul>
    </div>
  );
}

function Camera({ code }) {
  const { statusOf } = useStore();
  const s = findSite(code);
  if (!s) return <div className="nsw-container pub-page"><h1>Camera not found</h1><Link to="/cameras">Search cameras</Link></div>;
  const list = CERTS.filter((c) => c.site === code).sort((a, b) => b.date.localeCompare(a.date));
  const type = (c) => (c.section === 's137' ? 'Device tested and sealed' : c.section === 's132' ? 'Distance surveyed' : c.session ? 'Checked before session' : `Camera inspected${c.point ? ` (point ${c.point})` : ''}`);
  return (
    <div className="nsw-container pub-page">
      <p className="pub-crumb"><Link to="/cameras">Check a camera</Link> <span aria-hidden="true">›</span> {s.code}</p>
      <h1>{s.name}</h1>
      <p className="pub-lede">{PROGRAMS[s.program].label} · {s.direction} · {s.limit} km/h</p>
      <table className="nsw-table">
        <thead><tr><th>Check</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>
          {list.map((c) => {
            const w = statusOf(c) === 'withdrawn';
            return (
              <tr key={c.id} className={w ? 'is-withdrawn' : ''}>
                <td>{type(c)}<small>{c.id}</small></td>
                <td>{fmtDate(c.date)}</td>
                <td><span className={`nsw-status-label nsw-status-label--${w ? 'warning' : 'success'}`}>{w ? 'Withdrawn' : 'On record'}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PublicSite({ parts }) {
  const [a, b] = parts;
  let body;
  if (!a) body = <Lookup />;
  else if (a === 'notice') body = <NoticePage key={b} number={b} />;
  else if (a === 'cameras') body = <Cameras />;
  else if (a === 'camera') body = <Camera code={b} />;
  else body = <div className="nsw-container pub-page"><h1>Page not found</h1><Link to="/">Go to the start</Link></div>;
  return (
    <div className="pub">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1}>{body}</main>
      <Footer />
    </div>
  );
}
