import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Field, FieldDescription, FieldError, FieldLabel, Header, HeaderActions, HeaderBrand, Hero, HeroContent, HeroDescription, HeroTitle, Input, Masthead, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@nswds/ui';
import { Link, Dialog, Spinner } from '../shared/ui.jsx';
import Handoff from './Handoff.jsx';
import DateField from './DateField.jsx';
import { checkDate, checkNotice, cleanNotice, isoToParts, partsToIso } from './lookupValidation.js';
import StatusBar from './StatusBar.jsx';
import { matterStatus } from './status.js';
import CertificateView from './CertificateView.jsx';
import { downloadCert } from '../lib/certDoc.js';
import Icon from './measure/Icon.jsx';
import MediaGallery from '../shared/MediaGallery.jsx';
import Measure from './Measure.jsx';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { evaluate, daysBetween } from '../lib/rules.js';
import { planFaults } from '../lib/faults.js';
import { useSim } from '../lib/useSim.js';
import { useStickyStory } from './useStickyStory.js';
import { NOTICES, SITES, CERTS, PROGRAMS, CASES, SCENARIOS, notice as findNotice, site as findSite } from '../data.js';
import { TODAY, fmtDate, fmtTime, weekday, partOfDay, ago } from '../lib/format.js';

// PUBLIC SITE: for the person who received the notice. No login, no staff entry, calm and plain.

function SiteHeader() {
  return (
    <>
      <div role="region" aria-label="NSW Government"><Masthead container="contained" /></div>
      <Header color="white" border container="contained">
        <HeaderBrand href="#/" sitename="Camera-detected offences" />
        <HeaderActions>
          <nav className="pub-nav" aria-label="Main">
            <Link to="/">Evidence</Link>
            <Link to="/cameras">Enforcement Certificate</Link>
          </nav>
        </HeaderActions>
      </Header>
    </>
  );
}

function Footer() {
  return (
    <footer className="pub-footer">
      <div className="pub-wrap pub-footer__in">
        <span>Need help? Revenue NSW 1300 138 118</span>
        <span>Prototype · all notices, people and images are fictitious</span>
      </div>
    </footer>
  );
}

// Sample notices open as a dropdown from the notice number field. Demo-only styling (amber).
function NoticeField({ value, onChange, onPick, error, onBlur }) {
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
    <Field className="pub-field" invalid={!!error} ref={ref}>
      <FieldLabel htmlFor="pn">Penalty notice number</FieldLabel>
      <FieldDescription id="pn-hint">10 digits, at the top right of your notice</FieldDescription>
      {error && <FieldError match role="alert">{error}</FieldError>}
      <div className="pn-wrap">
        <Input id="pn" inputMode="numeric" autoComplete="off" aria-describedby="pn-hint" aria-invalid={!!error || undefined} onBlur={onBlur} value={value}
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
    </Field>
  );
}

function Lookup() {
  const [num, setNum] = useState('');
  const [parts, setParts] = useState({ d: '', m: '', y: '' });
  const [err, setErr] = useState(null);
  const [fe, setFe] = useState({});
  const [bad, setBad] = useState([]);
  const [busy, setBusy] = useState(false);
  const [misses, setMisses] = useState(0);
  const [touched, setTouched] = useState({});
  const sumRef = useRef(null);

  // Check one or both fields. Shown as you leave a field (after you've typed in it) and again on submit.
  const validate = (which = ['num', 'date']) => {
    const x = {}; let b = [];
    if (which.includes('num')) { const m = checkNotice(num); if (m) x.num = m; }
    if (which.includes('date')) { const r = checkDate(parts); if (r) { x.date = r.msg; b = r.bad; } }
    return { x, b };
  };
  const leave = (field) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const { x, b } = validate([field]);
    setFe((f) => { const { [field]: _o, ...rest } = f; return { ...rest, ...x }; });
    if (field === 'date') setBad(b);
  };

  const submit = (e) => {
    e.preventDefault();
    const { x, b } = validate();
    setFe(x); setBad(b); setErr(null); setTouched({ num: true, date: true });
    if (Object.keys(x).length) { setTimeout(() => sumRef.current?.focus(), 0); return; }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      const iso = partsToIso(parts);
      const n = NOTICES.find((y) => y.number === cleanNotice(num) && y.dateTime.slice(0, 10) === iso);
      if (!n) { setErr('nomatch'); setMisses((m) => m + 1); setTimeout(() => sumRef.current?.focus(), 0); } else go(`/notice/${n.number}`);
    }, 600);
  };
  const problems = [fe.num && { id: 'pn', msg: fe.num }, fe.date && { id: 'od-d', msg: fe.date }].filter(Boolean);
  const focusField = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.focus(); };

  return (
    <>
      <Hero color="dark" layout="stack" container="contained">
        <HeroContent>
          <HeroTitle>Understand a camera-detected offence</HeroTitle>
          <HeroDescription>Getting a fine is stressful. Here you can see what the camera recorded, check it was working properly, and find your options. It takes a few minutes.</HeroDescription>
        </HeroContent>
      </Hero>
      <div className="pub-wrap pub-page">
        <div className="pub-two">
          <form className="pub-form" onSubmit={submit} noValidate>
            <h2>Find your notice</h2>
            {problems.length > 0 && (
              <div className="pub-errsum" role="alert" tabIndex={-1} ref={sumRef} aria-labelledby="errsum-h">
                <h3 id="errsum-h">There {problems.length === 1 ? 'is a problem' : 'are problems'} with your details</h3>
                <ul>{problems.map((p) => <li key={p.id}><a href={`#${p.id}`} onClick={focusField(p.id)}>{p.msg}</a></li>)}</ul>
              </div>
            )}
            {err === 'nomatch' && !problems.length && (
              <div className="pub-errsum" role="alert" tabIndex={-1} ref={sumRef} aria-labelledby="nm-h">
                <h3 id="nm-h">We couldn’t find that notice</h3>
                <p>Check both details match your letter. For your privacy we don’t say which one didn’t match.</p>
                {misses >= 2 && <p>Still stuck? The notice number is at the top right of the letter, and the offence date is in the “What happened” section. Revenue NSW can help on 1300 138 118.</p>}
              </div>
            )}
            <NoticeField value={num} onChange={(v) => { setNum(v); setErr(null); if (fe.num) setFe((f) => { const { num: _n, ...r } = f; return r; }); }} error={fe.num} onBlur={() => touched.num !== false && num && leave('num')}
              onPick={(n) => { setNum(n.number); setParts(isoToParts(n.dateTime.slice(0, 10))); setFe({}); setBad([]); setErr(null); }} />
            <DateField id="od" legend="Date of the offence" hint="Shown on the notice. For example, 24 10 2026" parts={parts} error={fe.date} bad={bad}
              onChange={(p) => { setParts(p); setErr(null); if (fe.date) { setFe((f) => { const { date: _d, ...r } = f; return r; }); setBad([]); } }}
              onBlurField={() => setTimeout(() => { if (!document.getElementById('od')?.contains(document.activeElement) && (parts.d || parts.m || parts.y)) leave('date'); }, 0)} />
            <Button type="submit" disabled={busy}>{busy ? <><Spinner /> Finding it…</> : 'Show me what happened'}</Button>
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

function Section({ n, title, answer, tone, state, children }) {
  return (
    <section className={`q ${state ? `is-${state}` : ''}`} id={`q${n}`} aria-labelledby={`q${n}-h`}>
      <div className={`q-n ${tone === 'warn' ? 'is-warn' : ''}`} aria-hidden="true">{state === 'done' ? '✓' : n}</div>
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
  const [viewing, setViewing] = useState(null);
  if (status === 'error')
    return (
      <Alert status="danger" title="We can’t check the certificates right now." role="alert">
        Everything else on this page is correct. <button type="button" className="pub-link" onClick={retry}>Try again</button>
      </Alert>
    );
  if (status !== 'ready')
    return <p className="pub-loading"><Spinner /> {status === 'slow' ? 'Still checking certificates, taking longer than usual…' : 'Checking the camera’s certificates…'}</p>;
  const site = findSite(n.site);
  const when = (it) => `${fmtDate(it.cert.date)}${it.age ? `, ${it.age} days before the offence` : ', on the day'}`;
  const window = (it) => it.req.window.replace(/^within /, '');
  return (
    <>
      <ul className="certs">
        {ev.items.map((it, i) => (
          <li key={i} className={it.current ? 'is-ok' : 'is-warn'}>
            {!it.current && <span className="certs-ic" aria-hidden="true">!</span>}
            <div>
              <div className="certs-head"><strong>{it.req.label}</strong><Tag color={it.current ? 'success' : 'warning'} className={it.current ? '' : 'pub-tag-warn'}>{it.current ? 'Current' : 'Not current'}</Tag></div>
              <p>
                {it.cert
                  ? (it.current ? `${when(it)}. It needs to be done ${it.req.window}.` : `${when(it)}. That’s longer than the usual ${window(it)}, so you may want to mention it if you ask for a review.`)
                  : 'We couldn’t find a certificate on record for this check before the offence. You may want to mention this if you ask for a review.'}
              </p>
              {it.withdrawn && <p className="muted">A later certificate was withdrawn by Transport and doesn’t count.</p>}
              {it.cert && (
                <div className="certs-act">
                  <button type="button" className="pub-act" onClick={() => setViewing(it.cert)} aria-label={`View certificate ${it.cert.id}, ${it.req.label}`}><Icon name="view" />View</button>
                  <button type="button" className="pub-act" onClick={() => downloadCert(it.cert, site)} aria-label={`Download PDF of certificate ${it.cert.id}, ${it.req.label}`}><Icon name="download" />Download PDF</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {viewing && <CertificateView cert={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

const LEARN = [
  { title: 'Speeding and how it affects you', org: 'Transport for NSW, Centre for Road Safety', text: 'Plain-language facts on speed limits, stopping distances and why limits are set where they are.', href: 'https://roadsafety.transport.nsw.gov.au/speeding/' },
  { title: 'Safe speeds and Towards Zero', org: 'Transport for NSW', text: 'How NSW is working towards no deaths or serious injuries on its roads, and where cameras fit in.', href: 'https://www.towardszero.nsw.gov.au/' },
  { title: 'How Victoria approaches road safety', org: 'Transport Accident Commission and Towards Zero Victoria', text: 'Another Australian state that pairs cameras with education, and explains its reasoning.', href: 'https://www.towardszero.vic.gov.au/' },
];

const OPTIONS = [
  { id: 'pay', title: 'Pay', text: 'In full, or ask for a payment plan or more time if money is tight.', cta: 'Pay or set up a plan', what: 'Paying and payment plans' },
  { id: 'review', title: 'Ask for a review', text: 'If you think the fine is wrong or there were special circumstances.', cta: 'Ask for a review', what: 'Asking for a review' },
  { id: 'nominate', title: 'Nominate the driver', text: 'If it wasn’t you.', cta: 'Nominate the driver', what: 'Nominating the driver' },
  { id: 'court', title: 'Have a court decide', text: 'You can choose to have the matter heard in court.', cta: 'Choose court', what: 'Choosing a court hearing' },
];

function NoticePage({ number }) {
  const { statusOf, faultSettings } = useStore();
  const [leaving, setLeaving] = useState(null);
  const n = findNotice(number);
  const plan = useMemo(() => (n ? planFaults(n, faultSettings) : {}), [n, JSON.stringify(faultSettings)]); // eslint-disable-line
  const story = useStickyStory(5, number);
  if (!n) return <div className="pub-wrap pub-page"><h1>Notice not found</h1><Link to="/">Start again</Link></div>;

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

  const st = (i) => (i - 1 < story.active ? 'done' : i - 1 === story.active ? 'now' : '');
  const status = matterStatus({ n, left, openCase, ev });

  return (
    <div className="pub-wrap pub-page" ref={story.pageRef}>
      <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#/">Evidence</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{n.number}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
      <h1>What happened</h1>
      <p className="pub-lede">{prog.label} · Penalty notice {n.number}</p>

      <div ref={story.sentinelRef} className="pub-sentinel" aria-hidden="true" />
      <StatusBar status={status} notice={n.number} stuck={story.stuck} barRef={story.barRef} miniRef={story.miniRef} onPay={() => setLeaving(OPTIONS[0])} />

      <div className="pub-story">
        <nav className="pub-toc" aria-label="On this page" ref={story.tocRef} style={{ '--prog': story.active / 4 }}>
          {['What happened', 'Was it my vehicle?', 'How it was measured', 'Was the camera working?', 'Your options'].map((t, i) => (
            <a key={t} href={`#/notice/${n.number}`} className={i < story.active ? 'is-done' : i === story.active ? 'is-now' : ''} aria-current={i === story.active ? 'step' : undefined}
              onClick={(e) => { e.preventDefault(); document.getElementById(`q${i + 1}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>
              <span className={i === 3 && !ev.current ? 'is-warn' : ''} aria-hidden="true">{i < story.active ? '✓' : i + 1}</span>
              <em>{t}{i < story.active && <i className="sr-only"> (done)</i>}</em>
            </a>
          ))}
        </nav>

        <div>
          <Section n={1} state={st(1)} title="What happened" answer={`${weekday(n.dateTime)} ${partOfDay(n.dateTime)}, ${ago(daysBetween(n.dateTime, TODAY))}, in ${s.suburb}.`}>
            <div className="facts">
              <div><span>When</span><strong>{fmtDate(n.dateTime)}</strong><small>{fmtTime(n.dateTime)}</small></div>
              <div><span>Where</span><strong>{s.name}</strong><small>Heading {s.direction.toLowerCase()}</small></div>
              <div><span>Vehicle</span><strong>{n.rego}</strong><small>{n.vehicle}</small></div>
              <div><span>Offence</span><strong>{n.offence}</strong></div>
            </div>
            <p className="muted">Don’t remember the trip? That’s common. The notice was posted {lag} days after it happened.</p>
          </Section>

          <Section n={2} state={st(2)} title="Was it my vehicle?" answer={`Check the number plate ${n.rego} in the images${hasVideo ? ' and video' : ''}.`}>
            <MediaGallery items={n.media} plan={plan} prefix={n.number} variant="public" />
            <p className="muted">If someone else was driving, you can nominate them with Revenue NSW (see Your options).</p>
          </Section>

          <Section n={3} state={st(3)} title="How it was measured" answer={prog.measureLabel}>
            <Measure n={n} program={s.program} />
          </Section>

          <Section n={4} state={st(4)} title="Was the camera working properly?" tone={ev.current ? '' : 'warn'} answer={evidenceAnswer}>
            <CertList n={n} fault={plan.certs} />
            <p className="muted">This is a plain-English summary, not legal advice. <Link to={`/camera/${s.code}`}>See all certificates for this camera</Link></p>
          </Section>

          <Section n={5} state={st(5)} title="Your options" answer="Whatever you decide, Revenue NSW handles it. Your notice details will be filled in for you.">
            <ul className="opts2">
              {OPTIONS.map((o) => (
                <li key={o.id}>
                  <div><strong>{o.title}</strong><p>{o.text}</p></div>
                  <Handoff what={o.what} notice={n.number}><button type="button" className="pub-out" onClick={() => setLeaving(o)}><span className="u">{o.cta}</span><span aria-hidden="true"> ↗</span><span className="sr-only"> (opens Revenue NSW)</span></button></Handoff>
                </li>
              ))}
            </ul>
            <p className="muted">These steps happen on Revenue NSW’s system. Your notice details are filled in for you, and you can come back here any time.</p>
          </Section>
        </div>
      </div>

      <aside className="learn" aria-labelledby="learn-h">
        <h2 id="learn-h">If you’d like to know more</h2>
        <p>Nobody enjoys getting a notice. If it’s useful, these explain why cameras and limits are where they are. You don’t need to read any of this to deal with your notice.</p>
        <ul>
          {LEARN.map((l) => (
            <li key={l.href}><a href={l.href} target="_blank" rel="noreferrer noopener"><strong>{l.title}</strong><span className="sr-only"> (opens in a new tab)</span></a><small>{l.org}</small><p>{l.text}</p></li>
          ))}
        </ul>
        <p className="proto-line">Prototype: link addresses are to be confirmed with Transport for NSW before release.</p>
      </aside>

      {leaving && (
        <Dialog title="You’re going to Revenue NSW" onClose={() => setLeaving(null)}>
          <p>{leaving.what} is handled by Revenue NSW. Notice {n.number} will be ready for you there.</p>
          <p className="proto-line">Prototype: Revenue NSW isn’t connected, so nothing will open.</p>
          <div className="dlg-actions"><Button type="button" variant="outline" onClick={() => setLeaving(null)}>Stay on this page</Button></div>
        </Dialog>
      )}
    </div>
  );
}

function Cameras() {
  const [q, setQ] = useState('');
  const list = SITES.filter((s) => (s.code + s.name + s.suburb).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="pub-wrap pub-page">
      <h1>Enforcement Certificate</h1>
      <p className="pub-lede">See any camera’s certificates, with or without a notice.</p>
      <label className="sr-only" htmlFor="camq">Search cameras</label>
      <Input id="camq" className="pub-search" placeholder="Search by road, suburb or camera code" value={q} onChange={(e) => setQ(e.target.value)} />
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
  if (!s) return <div className="pub-wrap pub-page"><h1>Camera not found</h1><Link to="/cameras">Search cameras</Link></div>;
  const list = CERTS.filter((c) => c.site === code).sort((a, b) => b.date.localeCompare(a.date));
  const type = (c) => (c.section === 's137' ? 'Device tested and sealed' : c.section === 's132' ? 'Distance surveyed' : c.session ? 'Checked before session' : `Camera inspected${c.point ? ` (point ${c.point})` : ''}`);
  return (
    <div className="pub-wrap pub-page">
      <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#/cameras">Enforcement Certificate</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{s.code}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
      <h1>{s.name}</h1>
      <p className="pub-lede">{PROGRAMS[s.program].label} · {s.direction} · {s.limit} km/h</p>
      <Table>
        <TableHeader><TableRow><TableHead>Check</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {list.map((c) => {
            const w = statusOf(c) === 'withdrawn';
            return (
              <TableRow key={c.id} className={w ? 'is-withdrawn' : ''}>
                <TableCell>{type(c)}<small>{c.id}</small></TableCell>
                <TableCell>{fmtDate(c.date)}</TableCell>
                <TableCell><Tag color={w ? 'warning' : 'success'} className={w ? 'pub-tag-warn' : ''}>{w ? 'Withdrawn' : 'On record'}</Tag></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function PublicSite({ parts }) {
  const { state } = useStore();
  const path = parts.join('/');
  const first = useRef(true);
  useEffect(() => {
    const [a, b] = parts;
    const page = a === 'notice' && b ? `Notice ${b}` : a === 'cameras' ? 'Enforcement Certificate' : a === 'camera' && b ? `Camera ${b}` : 'Find your notice';
    document.title = `${page} | Camera-detected offences | NSW Government (prototype)`;
    // after a page change, move focus to the new page heading so screen reader and keyboard users start in the right place
    if (first.current) { first.current = false; return; }
    const h = document.querySelector('#main h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }, [path]); // eslint-disable-line
  const [a, b] = parts;
  let body;
  if (!a) body = <Lookup />;
  else if (a === 'notice') body = <NoticePage key={b} number={b} />;
  else if (a === 'cameras') body = <Cameras />;
  else if (a === 'camera') body = <Camera code={b} />;
  else body = <div className="pub-wrap pub-page"><h1>Page not found</h1><Link to="/">Go to the start</Link></div>;
  return (
    <div className={`pub ${state.handoffs ? 'show-handoffs' : ''}`}>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>{body}</main>
      <Footer />
    </div>
  );
}
