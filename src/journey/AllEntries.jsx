import React, { useState } from 'react';
import { Link } from '../components/ui.jsx';
import { ExternalFrame, PlugIn } from '../entry/Entry.jsx';
import { NOTICES } from '../data/mockData.js';
import { segments } from '../router.js';
import { fmtDate } from '../format.js';
import { NOTES } from '../explain/notes.js';

// Every way a notice recipient (or someone checking a camera) can reach the information.
// verified: confirmed | documented | assumed | proposed

const handoff = (n, from) => {
  const x = NOTICES.find((y) => y.number === n);
  return `/handoff?n=${n}&r=${x ? x.rego : ''}&from=${from}`;
};

export const ENTRY_POINTS = [
  { id: 'msnsw', group: 'Online, logged in', name: 'MyServiceNSW → Fines', who: 'Most individuals', owner: 'Service NSW', verified: 'confirmed', note: 'Your screenshot; Service NSW page', to: '/entry/myservicensw', lands: 'Fine page → CEVOC link' },
  { id: 'snswapp', group: 'Online, logged in', name: 'Service NSW app', who: 'People on their phone', owner: 'Service NSW', verified: 'documented', note: 'Service NSW mentions viewing and paying fines in the app', to: '/entry/app', lands: 'Fine in app → CEVOC link' },
  { id: 'mypenalty', group: 'Online, no account', name: 'myPenalty', who: 'Anyone with the notice', owner: 'Revenue NSW', verified: 'documented', note: 'Revenue NSW and Service NSW pages; inputs to confirm', to: '/entry/mypenalty', lands: 'Images → CEVOC link' },
  { id: 'myfines', group: 'Online, no account', name: 'MyFines (fines.digital.revenue.nsw.gov.au)', who: 'Unknown', owner: 'Revenue NSW', verified: 'assumed', note: 'Exists; screens not seen. Possibly replacing myPenalty', to: '/entry/myfines', lands: 'To confirm' },
  { id: 'notice', group: 'From the notice itself', name: 'Link or QR code on the paper notice', who: 'Everyone who gets a letter', owner: 'Revenue NSW (notice) → Transport', verified: 'proposed', note: 'Not on notices today as far as we know', to: '/entry/qr', lands: 'Straight to “Your fine, explained”' },
  { id: 'search', group: 'Searching', name: 'Web search → nsw.gov.au', who: 'People who google it', owner: 'NSW Government (nsw.gov.au)', verified: 'documented', note: '“View a camera image of your offence” page', to: '/entry/search', lands: 'nsw.gov.au → myPenalty or CEVOC' },
  { id: 'company', group: 'Businesses', name: 'Company and fleet fines', who: 'Fleet managers, registered operators', owner: 'Revenue NSW (eNominations)', verified: 'documented', note: 'Separate company image page and eNominations', to: '/entry/company', lands: 'Fine → CEVOC link, then nominate' },
  { id: 'phone', group: 'Assisted', name: 'Phone 1300 138 118', who: 'People who can’t or won’t go online', owner: 'Revenue NSW contact centre', verified: 'documented', note: 'Copies of images sent after ID check', to: '/entry/phone', lands: 'Agent uses the officer view' },
  { id: 'cevoc', group: 'Direct', name: 'Straight to this site', who: 'People who already know it', owner: 'Transport (CEVOC)', verified: 'confirmed', note: 'Current CEVOC certificate site', to: '/notice', lands: 'Lookup → “Your fine, explained”' },
  { id: 'camera', group: 'No fine', name: 'Checking a camera without a fine', who: 'Lawyers, media, the curious', owner: 'Transport (CEVOC)', verified: 'confirmed', note: 'What the current CEVOC site does today', to: '/cameras', lands: 'Camera search' },
  { id: 'officer', group: 'Staff', name: 'Revenue NSW and Transport officers', who: 'Review and adjudication staff', owner: 'Transport (CEVOC)', verified: 'proposed', note: 'Organisation sign-in', to: '/officer', lands: 'Officer console' },
];

const VERIFIED = {
  confirmed: ['ok', 'Confirmed'],
  documented: ['doc', 'Documented on official sites'],
  assumed: ['warn', 'Exists, not seen'],
  proposed: ['new', 'Proposed (new)'],
};

export function AllEntryChooser() {
  const groups = [...new Set(ENTRY_POINTS.map((e) => e.group))];
  return (
    <div className="nsw-container cevoc-page">
      <p className="cevoc-eyebrow">Prototype · all entry points</p>
      <h1>Every way in</h1>
      <p className="nsw-intro">
        People don’t care which agency owns what. Whichever door they come through, they should land on the same answer: <Link to="/ia">one page ordered by their questions</Link>.
      </p>
      <div className="entry-legend">
        <span className="entry-legend__ext">Grey dashed frame = existing service (mock)</span>
        <span className="entry-legend__plug">Orange frame = where CEVOC plugs in</span>
      </div>
      {groups.map((g) => (
        <section key={g}>
          <h2 className="cevoc-h2">{g}</h2>
          <ul className="entry-ways">
            {ENTRY_POINTS.filter((e) => e.group === g).map((e) => (
              <li key={e.id}>
                <Link to={e.to} className={`entry-way ${e.owner.startsWith('Transport') ? 'is-cevoc' : ''}`}>
                  <strong>{e.name}</strong>
                  <span>{e.who}</span>
                  <span className="entry-way__lands">Lands on: {e.lands}</span>
                  <small><span className={`ver ver--${VERIFIED[e.verified][0]}`}>{VERIFIED[e.verified][1]}</span> {e.owner} · {e.note}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Pick({ onPick }) {
  return (
    <select className="ext-pick" onChange={(e) => onPick(e.target.value)} defaultValue={NOTICES[0].number} aria-label="Mock fine">
      {NOTICES.filter((n) => !n.upstreamFailure).map((n) => (
        <option key={n.number} value={n.number}>{n.number} · {n.offence}</option>
      ))}
    </select>
  );
}

function AppMock() {
  const [n, setN] = useState(NOTICES[0].number);
  const x = NOTICES.find((y) => y.number === n);
  return (
    <ExternalFrame owner="Service NSW" service="Service NSW app">
      <div className="phone">
        <div className="phone__screen">
          <div className="phone__push">
            <strong>Service NSW</strong>
            <span>You have a new fine. Tap to view.</span>
          </div>
          <h3>Fines</h3>
          <Pick onPick={setN} />
          <div className="phone__card">
            <strong>{x.offence}</strong>
            <span>Due {x.due ? fmtDate(x.due) : '—'}</span>
            <span className="phone__btns"><span>Pay</span><span>Review</span><span>Images</span></span>
          </div>
          <PlugIn what="Same CEVOC link as on the website, inside the app.">
            <Link to={handoff(n, 'msnsw')} className="plug__btn">What happened? Camera and evidence →</Link>
          </PlugIn>
        </div>
      </div>
    </ExternalFrame>
  );
}

function MyFinesMock() {
  return (
    <ExternalFrame owner="Revenue NSW" service="MyFines (fines.digital.revenue.nsw.gov.au)">
      <div className="mypen__main">
        <h2 className="mypen__h">MyFines</h2>
        <div className="cevoc-proto-note" role="note">
          We haven’t seen inside MyFines. It may be replacing myPenalty. Screenshot a fine page from it and the prototype will be modelled on that instead.
        </div>
        <PlugIn what="Expected plug-in: the same “camera and evidence” link from the fine page.">
          <Link to="/entry/mypenalty" className="plug__btn">Use the myPenalty mock for now →</Link>
        </PlugIn>
      </div>
    </ExternalFrame>
  );
}

function QrMock() {
  const [n, setN] = useState(NOTICES[0].number);
  return (
    <ExternalFrame owner="Revenue NSW" service="Paper penalty notice">
      <div className="letter">
        <p className="letter__h">PENALTY NOTICE (mock)</p>
        <Pick onPick={setN} />
        <p>Penalty notice number <strong>{n}</strong></p>
        <p className="cevoc-muted">… amount, due date and offence details …</p>
        <PlugIn label="CEVOC plug-in point · proposed" what="A short link and QR code printed on the notice, taking people straight to their fine’s story. Not on notices today as far as we know.">
          <div className="qr-row">
            <div className="qr" aria-hidden="true">
              {Array.from({ length: 49 }).map((_, i) => <i key={i} className={(i * 7 + n.charCodeAt(i % 10)) % 3 ? '' : 'on'} />)}
            </div>
            <div>
              <p className="plug__lead">See what happened</p>
              <p>Photos, the camera, and whether it was certified.</p>
              <Link to={handoff(n, 'notice')} className="plug__btn">Scan (simulate) →</Link>
            </div>
          </div>
        </PlugIn>
      </div>
    </ExternalFrame>
  );
}

function SearchMock() {
  return (
    <ExternalFrame owner="Search engine → NSW Government" service="Web search and nsw.gov.au">
      <div className="serp">
        <div className="serp__box">nsw speed camera fine photo</div>
        <div className="serp__res">
          <small>nsw.gov.au › fines › view-camera-image</small>
          <strong>View a camera image of your offence | NSW Government</strong>
          <span>If you’re named on a fine you can view the digital image… (existing page)</span>
        </div>
        <div className="serp__res">
          <small>cevoc.transport.nsw.gov.au (current CEVOC)</small>
          <strong>Camera certificates</strong>
          <span>Certificates only today. People can’t see their fine here.</span>
        </div>
        <PlugIn what="nsw.gov.au and the CEVOC search result both lead to the same combined experience.">
          <Link to="/notice" className="plug__btn">Go to “Your fine, explained” →</Link>
        </PlugIn>
      </div>
    </ExternalFrame>
  );
}

function CompanyMock() {
  return (
    <ExternalFrame owner="Revenue NSW" service="Company fines and eNominations">
      <div className="mypen__main">
        <h2 className="mypen__h">Fines for Fleetwise Rentals Pty Ltd (mock)</h2>
        <table className="msnsw__table">
          <thead><tr><th>Fine</th><th>Vehicle</th><th>Status</th><th>Camera and evidence</th></tr></thead>
          <tbody>
            {['3162457896', '3162457894'].map((num) => {
              const x = NOTICES.find((y) => y.number === num);
              return (
                <tr key={num}>
                  <td>{num}</td><td>{x.rego}</td><td>Awaiting nomination</td>
                  <td className="plug-cell"><Link to={handoff(num, 'msnsw')}>Check →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="ext-notbuilt">“Nominate driver” (eNominations) is an existing Revenue NSW function. It isn’t mocked here.</p>
        <p className="cevoc-muted">Orange cells = CEVOC plug-in point. Fleet managers need the exact time and plate to match against bookings before nominating.</p>
      </div>
    </ExternalFrame>
  );
}

function PhoneMock() {
  return (
    <ExternalFrame owner="Revenue NSW" service="Contact centre, 1300 138 118">
      <div className="mypen__main">
        <h2 className="mypen__h">Assisted channel</h2>
        <ol>
          <li>Caller gives their notice number and proves identity (address, date of birth or licence).</li>
          <li>Agent opens the fine.</li>
          <li>Today: images are posted out.</li>
        </ol>
        <PlugIn what="Proposed: the agent sees the same story as the customer, plus restricted detail, so they can explain it on the call.">
          <Link to="/officer?email=alex.chen@revenue.nsw.gov.au" className="plug__btn">Open as a Revenue NSW officer →</Link>
        </PlugIn>
      </div>
    </ExternalFrame>
  );
}

export function isNewEntry(path) {
  const [a, b] = segments(path);
  return a === 'entry' && (!b || ['app', 'myfines', 'qr', 'search', 'company', 'phone'].includes(b));
}

export default function AllEntries({ path }) {
  const [, b] = segments(path);
  const body = { app: <AppMock />, myfines: <MyFinesMock />, qr: <QrMock />, search: <SearchMock />, company: <CompanyMock />, phone: <PhoneMock /> }[b];
  if (!body) return <AllEntryChooser />;
  return (
    <div className="entry-page">
      <p className="entry-back"><Link to="/entry">← All entry points</Link></p>
      {body}
    </div>
  );
}

const MORE_NOTES = [
  {
    id: 'ver', selector: '.ver', title: 'How sure we are about each entry point',
    why: 'Confirmed = seen in use. Documented = described on an official NSW site but not walked through. Exists, not seen = we know the site exists but not what’s in it. Proposed = doesn’t exist today.',
    who: 'Testers, Revenue NSW, Service NSW', principle: 'Honest about scope', status: 'Validate with Revenue NSW',
  },
  {
    id: 'qr', selector: '.qr', title: 'QR code on the notice (proposed)',
    why: 'The paper notice is the one thing every recipient has. A short link straight to their fine removes the hunt across agencies.',
    who: 'Mia, Priya, Ahmed', principle: 'Design for the worst moment', status: 'Proposed; needs Revenue NSW agreement and a secure token',
  },
  {
    id: 'own', selector: '.own-chip', title: 'Who owns this part today',
    why: 'Photos sit with Revenue NSW (myPenalty); certificates sit with Transport (CEVOC); nobody answers “is the evidence enough?”. The recipient shouldn’t have to know any of that, so this label is for testers only.',
    who: 'Testers, Revenue NSW and Transport stakeholders', principle: 'Same data, different lenses', status: 'Ownership of the combined page to be agreed',
  },
  {
    id: 'story-nav', selector: '.story-nav', title: 'Ordered by the person’s questions',
    why: 'What happened → was it me → is the evidence enough → was the camera certified → what can I do. That’s the order people ask in, so it’s the order of the page. Agency boundaries don’t appear.',
    who: 'All notice recipients', principle: 'Evidence before admin', sad: 'Information architecture', status: 'Hypothesis to test',
  },
  {
    id: 'enough', selector: '#q-enough', title: 'Is the evidence enough?',
    why: 'The question people actually have, and that no service answers today. We combine photos, measurement and legal checks into one plain answer, without giving legal advice.',
    who: 'Dave, Mia', principle: 'Evidence before admin', status: 'Wording needs Legal and Revenue NSW review',
  },
];
for (const note of MORE_NOTES) if (!NOTES.some((x) => x.id === note.id)) NOTES.push(note);
