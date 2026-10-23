import React, { useEffect, useState } from 'react';
import { Link } from '../components/ui.jsx';
import Gallery from '../components/Gallery.jsx';
import { NOTICES, SITES } from '../data/mockData.js';
import { NOTICE_DOCS } from '../data/evidence.js';
import { programFor } from '../config/programs.js';
import { fmtDate, fmtDateTime } from '../format.js';
import { go, segments } from '../router.js';
import { query } from '../util.js';
import { NOTES } from '../explain/notes.js';

// Mock entry points: how notice recipients reach CEVOC today.
// Grey dashed frames = EXISTING services (Service NSW / Revenue NSW), mocked for context only.
// Orange solid frames = where CEVOC PLUGS IN (new).

const FROM_KEY = 'cevoc-from';
const ACCOUNTS = ['3162457890', '3162457891', '3162457893', '3162457894', '3162457895', '3162457896'];

const docFor = (n) => NOTICE_DOCS[n] || { to: ['Account holder'], amount: 'XXX.00' };
const holder = (n) => docFor(n).to[0] === 'The Registered Operator' ? docFor(n).to[1] : docFor(n).to[0];

function handoffLink(n, from) {
  const notice = NOTICES.find((x) => x.number === n);
  // Real service: a short-lived signed token from Revenue NSW, not the registration.
  return `/handoff?n=${n}&r=${notice ? notice.rego : ''}&from=${from}`;
}

export function ExternalFrame({ owner, service, children }) {
  return (
    <div className="ext-frame">
      <div className="ext-frame__tag" role="note">
        <strong>Existing service · mock</strong>
        <span>
          {owner}: {service}. Not part of CEVOC. Recreated loosely so testers can see where CEVOC plugs in.
        </span>
      </div>
      <div className="ext-frame__body">{children}</div>
    </div>
  );
}

export function PlugIn({ label = 'CEVOC plug-in point', what, children }) {
  return (
    <div className="plug">
      <div className="plug__tag">
        <strong>{label}</strong>
        {what && <span>{what}</span>}
      </div>
      <div className="plug__body">{children}</div>
    </div>
  );
}

function NotBuilt({ action, owner }) {
  return <p className="ext-notbuilt" role="status">“{action}” is an existing {owner} function. It isn’t mocked here.</p>;
}

// ---------------- Chooser ----------------

function EntryChooser() {
  const ways = [
    ['MyServiceNSW → Fines', 'Logged in, identity already verified. Sees all their fines with amounts, due dates and status.', '/entry/myservicensw', 'Confirmed: in use (your screenshot)'],
    ['myPenalty (Revenue NSW)', 'No account. Enters details from the notice to view images, pay or request a review.', '/entry/mypenalty', 'Documented on Service NSW and Revenue NSW sites; inputs to confirm'],
    ['Straight to CEVOC', 'Fallback for people who come directly, for example from a link on the notice.', '/notice', 'Fallback'],
  ];
  return (
    <div className="nsw-container cevoc-page">
      <p className="cevoc-eyebrow">Prototype · entry points</p>
      <h1>How notice recipients get here</h1>
      <p className="nsw-intro">
        Most people start in an existing Service NSW or Revenue NSW service, not in CEVOC. Pick a starting point to walk the journey end to end.
      </p>
      <div className="entry-legend">
        <span className="entry-legend__ext">Grey dashed frame = existing service (mock)</span>
        <span className="entry-legend__plug">Orange frame = where CEVOC plugs in</span>
      </div>
      <ul className="entry-ways">
        {ways.map(([t, d, to, v]) => (
          <li key={t}>
            <Link to={to} className={`entry-way ${to === '/notice' ? 'is-cevoc' : ''}`}>
              <strong>{t}</strong>
              <span>{d}</span>
              <small>{v}</small>
            </Link>
          </li>
        ))}
      </ul>
      <p className="cevoc-muted">
        Also exist but not mocked: company fines (eNominations), phone (1300 138 118), and Revenue NSW’s newer MyFines app, whose screens we haven’t seen yet.
      </p>
    </div>
  );
}

// ---------------- MyServiceNSW mock ----------------

function MsnswShell({ who, setWho, children }) {
  return (
    <ExternalFrame owner="Service NSW" service="MyServiceNSW Account">
      <div className="msnsw">
        <header className="msnsw__top">
          <span className="msnsw__brand">Service NSW <small>MyServiceNSW Account</small></span>
          <label className="msnsw__who">
            Mock account{' '}
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              {ACCOUNTS.map((n) => (
                <option key={n} value={n}>{holder(n)}</option>
              ))}
            </select>
          </label>
        </header>
        <nav className="msnsw__tabs" aria-label="Account (mock)">
          <span>Overview</span>
          <span className="is-on">My services</span>
          <span>Notifications</span>
          <span>Manage account</span>
        </nav>
        <div className="msnsw__main">{children}</div>
      </div>
    </ExternalFrame>
  );
}

function MsnswServices({ who, setWho }) {
  return (
    <MsnswShell who={who} setWho={setWho}>
      <h2 className="msnsw__h">Fines and taxes</h2>
      <Link to="/entry/myservicensw/fines" className="msnsw__card">
        <strong>Fines</strong>
        <span>View, manage and pay your fines.</span>
        <span aria-hidden="true" className="msnsw__arrow">→</span>
      </Link>
      <span className="msnsw__btn is-disabled">Add services</span>
    </MsnswShell>
  );
}

function MsnswFines({ who, setWho }) {
  const n = NOTICES.find((x) => x.number === who);
  const doc = docFor(who);
  return (
    <MsnswShell who={who} setWho={setWho}>
      <p><Link to="/entry/myservicensw">← My services</Link></p>
      <h2 className="msnsw__h">Fines</h2>
      <table className="msnsw__table">
        <thead>
          <tr><th>Fine</th><th>Offence</th><th>Due</th><th>Amount</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><Link to={`/entry/myservicensw/fine/${who}`}>{who}</Link></td>
            <td>{n.offence}</td>
            <td>{n.due ? fmtDate(n.due) : '—'}</td>
            <td>${doc.amount}</td>
            <td>{n.status === 'review' ? 'Under review' : 'Unpaid'}</td>
          </tr>
        </tbody>
      </table>
      <p className="ext-hint">Switch the mock account (top right) to see other fines.</p>
    </MsnswShell>
  );
}

function MsnswFine({ who, setWho, number }) {
  const n = NOTICES.find((x) => x.number === number);
  const [clicked, setClicked] = useState(null);
  if (!n) return <MsnswShell who={who} setWho={setWho}><p>Fine not found.</p></MsnswShell>;
  const doc = docFor(number);
  const site = SITES.find((s) => s.code === n.site);
  return (
    <MsnswShell who={who} setWho={setWho}>
      <p><Link to="/entry/myservicensw/fines">← Fines</Link></p>
      <h2 className="msnsw__h">Fine {number}</h2>
      <dl className="msnsw__dl">
        <div><dt>Offence</dt><dd>{n.offence}</dd></div>
        <div><dt>Date and time</dt><dd>{fmtDateTime(n.dateTime)}</dd></div>
        <div><dt>Location</dt><dd>{site ? site.name : n.site}</dd></div>
        <div><dt>Amount</dt><dd>${doc.amount} (mock)</dd></div>
        <div><dt>Due</dt><dd>{n.due ? fmtDate(n.due) : '—'}</dd></div>
      </dl>
      <div className="msnsw__actions">
        {['Pay', 'Payment plan', 'Request a review', 'Nominate someone else', 'View images', 'Go to court'].map((a) => (
          <button key={a} type="button" className="msnsw__btn is-outline" onClick={() => setClicked(a)}>{a}</button>
        ))}
      </div>
      {clicked && <NotBuilt action={clicked} owner="Service NSW / Revenue NSW" />}

      <PlugIn what="New link added to the existing fine page. Opens CEVOC with this fine already identified, so nothing is typed twice.">
        <p className="plug__lead">Was the camera working properly?</p>
        <p>See the camera, how your {programFor(n.program).label.toLowerCase()} reading was taken, and the legal certificates for the day.</p>
        <Link to={handoffLink(number, 'msnsw')} className="plug__btn">Check the camera and certification →</Link>
      </PlugIn>
    </MsnswShell>
  );
}

// ---------------- myPenalty mock ----------------

function PenaltyShell({ children }) {
  return (
    <ExternalFrame owner="Revenue NSW" service="myPenalty">
      <div className="mypen">
        <header className="mypen__top">
          <span className="mypen__brand">Revenue NSW <small>myPenalty</small></span>
        </header>
        <div className="mypen__main">{children}</div>
      </div>
    </ExternalFrame>
  );
}

function MyPenalty({ path }) {
  const q = query(path);
  const [number, setNumber] = useState(q.n || '');
  const [date, setDate] = useState('');
  const [err, setErr] = useState(null);
  const [found, setFound] = useState(null);
  const [clicked, setClicked] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    const n = NOTICES.find((x) => x.number === number.replace(/\s/g, ''));
    if (!n || n.dateTime.slice(0, 10) !== date) {
      setErr('Those details don’t match a fine.');
      setFound(null);
    } else {
      setErr(null);
      setFound(n);
    }
  };

  if (found) {
    const doc = docFor(found.number);
    return (
      <PenaltyShell>
        <h2 className="mypen__h">Penalty notice {found.number}</h2>
        <p>{found.offence} · {fmtDateTime(found.dateTime)}</p>
        <p><strong>Amount:</strong> ${doc.amount} (mock) · <strong>Due:</strong> {found.due ? fmtDate(found.due) : '—'}</p>
        <h3 className="mypen__h3">Camera images</h3>
        {found.images && found.images.filter((i) => i.status === 'published').length ? (
          <Gallery images={found.images.filter((i) => i.status === 'published')} idPrefix={found.number} />
        ) : (
          <p>No images available.</p>
        )}
        <div className="msnsw__actions">
          {['Pay now', 'Request a review', 'Nominate'].map((a) => (
            <button key={a} type="button" className="mypen__btn is-outline" onClick={() => setClicked(a)}>{a}</button>
          ))}
        </div>
        {clicked && <NotBuilt action={clicked} owner="Revenue NSW" />}
        <PlugIn what="New link under the images. myPenalty already shows the photos; CEVOC adds the camera, measurement and legal checks.">
          <p className="plug__lead">Want to check the camera?</p>
          <Link to={handoffLink(found.number, 'mypenalty')} className="plug__btn">Camera and certification for this fine →</Link>
        </PlugIn>
        <p><button type="button" className="cevoc-linkbutton" onClick={() => setFound(null)}>Look up another fine</button></p>
      </PenaltyShell>
    );
  }

  return (
    <PenaltyShell>
      <h2 className="mypen__h">View your penalty notice</h2>
      <div className="cevoc-proto-note" role="note">
        Open question: Service NSW says myPenalty asks for the notice number and date of offence; the newer nsw.gov.au page mentions only the notice number. Confirm with Revenue NSW.
      </div>
      {err && <p className="mypen__err" role="alert">{err}</p>}
      <form onSubmit={submit} className="mypen__form" noValidate>
        <label>Penalty notice number<input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" /></label>
        <label>Date of offence<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button type="submit" className="mypen__btn">Continue</button>
      </form>
      <details className="ext-samples">
        <summary>Mock fines</summary>
        <ul>
          {ACCOUNTS.map((n) => {
            const x = NOTICES.find((y) => y.number === n);
            return (
              <li key={n}>
                <button type="button" className="cevoc-linkbutton" onClick={() => { setNumber(n); setDate(x.dateTime.slice(0, 10)); setErr(null); }}>
                  {n} · {fmtDate(x.dateTime)}
                </button>
              </li>
            );
          })}
        </ul>
      </details>
    </PenaltyShell>
  );
}

// ---------------- Hand-off into CEVOC ----------------

export function Handoff({ path }) {
  const q = query(path);
  useEffect(() => {
    try {
      sessionStorage.setItem(FROM_KEY, JSON.stringify({ from: q.from, n: q.n }));
    } catch (e) {
      /* ignore */
    }
    go(`/notice?n=${q.n || ''}&r=${q.r || ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return (
    <div className="nsw-container cevoc-page">
      <p className="cevoc-muted">Opening camera information for fine {q.n}…</p>
    </div>
  );
}

const ORIGINS = {
  msnsw: ['MyServiceNSW', (n) => `/entry/myservicensw/fine/${n}`],
  mypenalty: ['myPenalty', (n) => `/entry/mypenalty?n=${n}`],
};

export function ReturnBanner() {
  const [from, setFrom] = useState(null);
  useEffect(() => {
    try {
      setFrom(JSON.parse(sessionStorage.getItem(FROM_KEY) || 'null'));
    } catch (e) {
      setFrom(null);
    }
  }, []);
  if (!from || !ORIGINS[from.from]) return null;
  const [name, to] = ORIGINS[from.from];
  const clear = () => {
    try {
      sessionStorage.removeItem(FROM_KEY);
    } catch (e) {
      /* ignore */
    }
    setFrom(null);
  };
  return (
    <div className="nsw-container" style={{ paddingTop: '1rem' }}>
      <PlugIn label="CEVOC return hand-off" what="Sends the person back to where they started, so pay, review and nominate happen in the service that owns them.">
        <div className="plug__row">
          <span>You came from <strong>{name}</strong>. When you’re done, go back there to pay, ask for a review or nominate.</span>
          <span className="plug__row-actions">
            <Link to={to(from.n)} className="plug__btn">← Back to {name}</Link>
            <button type="button" className="cevoc-linkbutton" onClick={clear}>Dismiss</button>
          </span>
        </div>
      </PlugIn>
    </div>
  );
}

// Slim tester strip on the CEVOC home page.
export function EntryStrip() {
  return (
    <div className="entry-strip" role="note">
      <div className="nsw-container">
        <strong>Testers:</strong> most people won’t start here.{' '}
        <Link to="/entry">Start where notice recipients really start</Link> (MyServiceNSW or myPenalty).
      </div>
    </div>
  );
}

export default function EntryRoutes({ path }) {
  const [, b, c, d] = segments(path);
  const [who, setWho] = useState(ACCOUNTS[0]);
  const pick = (n) => {
    setWho(n);
    if (b === 'myservicensw' && c === 'fine') go(`/entry/myservicensw/fine/${n}`);
  };
  useEffect(() => {
    if (b === 'myservicensw' && c === 'fine' && d && ACCOUNTS.includes(d)) setWho(d);
  }, [b, c, d]);

  let body;
  if (b === 'myservicensw' && c === 'fines') body = <MsnswFines who={who} setWho={pick} />;
  else if (b === 'myservicensw' && c === 'fine') body = <MsnswFine who={who} setWho={pick} number={d} />;
  else if (b === 'myservicensw') body = <MsnswServices who={who} setWho={pick} />;
  else if (b === 'mypenalty') body = <MyPenalty key={path} path={path} />;
  else return <EntryChooser />;

  return (
    <div className="entry-page">
      <p className="entry-back"><Link to="/entry">← All entry points</Link></p>
      {body}
    </div>
  );
}

// Explain-mode notes for the entry points.
const ENTRY_NOTES = [
  {
    id: 'ext-frame', selector: '.ext-frame__tag', title: 'Existing service (mock)',
    why: 'Grey dashed frames mark services CEVOC doesn’t own: MyServiceNSW and Revenue NSW’s myPenalty. They’re recreated loosely only to show the real starting point and where CEVOC connects.',
    who: 'Testers, Service NSW and Revenue NSW stakeholders', principle: 'Honest about scope',
    status: 'Mock. Screens are approximate, not copies.',
  },
  {
    id: 'plug', selector: '.plug__tag', title: 'CEVOC plug-in point',
    why: 'Orange frames show exactly what CEVOC adds to someone else’s service: one link out from the fine, and one link back. Everything else stays with Service NSW and Revenue NSW.',
    who: 'All notice recipients; integration and Revenue NSW teams', principle: 'Same data, different lenses',
    sad: 'Integration point (Revenue NSW hand-off)', status: 'Needs agreement with Service NSW and Revenue NSW',
  },
  {
    id: 'handoff-token', selector: '.plug__btn', title: 'Deep link with the fine already identified',
    why: 'The person has already proved who they are. Making them retype details is a needless trust hit. In the prototype the link carries the notice number and rego; a real link should carry a short-lived signed token instead.',
    who: 'Everyone arriving from MyServiceNSW or myPenalty', principle: 'Design for the worst moment',
    sad: 'Security / privacy', status: 'Token approach to agree with Cyber',
  },
  {
    id: 'notbuilt', selector: '.ext-notbuilt', title: 'Not mocked',
    why: 'Pay, review, nominate and the rest are existing functions owned by Service NSW and Revenue NSW. CEVOC doesn’t replace them, so the prototype doesn’t pretend to.',
    who: 'Testers', principle: 'Honest about scope', status: 'Prototype-only',
  },
  {
    id: 'entry-strip', selector: '.entry-strip', title: 'Most people don’t start here',
    why: 'Notice recipients usually start in MyServiceNSW or myPenalty. This strip lets testers start where real people do.',
    who: 'Testers', principle: 'Design for the worst moment', status: 'Prototype-only',
  },
];
for (const note of ENTRY_NOTES) if (!NOTES.some((x) => x.id === note.id)) NOTES.push(note);
