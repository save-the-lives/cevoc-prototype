import '../styles/uplift-entry.css';
import { useState } from 'react';
import { Link } from '../shared/ui.jsx';
import { DEMO_SIGNATURE, ENTRY_LINK, OFFENCES, locByCode } from './data.js';

// ENTRY FROM THE APPS (#/uplift/hub/entry): the two CURRENT journeys that end on the CEVOC certificate page,
// recreated from the owner's screenshots (25 Nov 2026) as small mock screens. Nothing here is a real screenshot and
// every value is invented: one invented fine is used for both paths so they can be compared.
// Scope (owner): only the CEVOC page is uplifted; every other step is existing and unchanged.

const F = OFFENCES[0];
const WHERE = locByCode(F.s)?.address || 'Sample location';
const WHEN = '14/03/2026 08:30';
const PERSON = 'Alex Sample';
const PLATE = 'TEST01';

const Hot = ({ children }) => <span className="en-hot">{children}</span>;
const Bar = ({ children, kind = 'snsw' }) => <div className={`en-bar is-${kind}`}>{children}</div>;
const Img = ({ small }) => <div className={`en-img${small ? ' is-small' : ''}`}>Camera image (placeholder)</div>;
const Field = ({ label, value, hot }) => (
  <div className="en-field"><span>{label}</span><span className={`en-input${hot ? ' en-hot' : ''}`}>{value || ' '}</span></div>
);

const Cevoc = () => (
  <div className="en-mock is-cevoc">
    <Bar kind="cevoc">Customer Enquiry and Verification of Certificate</Bar>
    <div className="en-body">
      <strong>Offence details</strong>
      <small>Penalty notice {F.p} · {F.program} · Site {F.s} · {WHERE} · {WHEN}</small>
      <strong>Camera certificate details for this offence</strong>
      <small>Tested on [date] and its image capture performance certified.</small>
      <Link to={ENTRY_LINK} className="en-go">Open the uplifted page ↗</Link>
    </div>
  </div>
);

const A = [
  { t: 'Service NSW home', url: 'service.nsw.gov.au', touch: '“Fines – request a review”, or Log in', mock: (
    <div className="en-mock"><Bar>Service NSW <span className="en-r">Log in</span></Bar><div className="en-body"><strong>Popular pages</strong><small>Renew registration · Driver licence</small><Hot>Fines – request a review</Hot></div></div>
  ) },
  { t: 'MyServiceNSW Account', url: 'account.service.nsw.gov.au', touch: 'Log in', mock: (
    <div className="en-mock"><Bar>MyServiceNSW Account</Bar><div className="en-body"><Hot>Log in</Hot><small>Create Account</small></div></div>
  ) },
  { t: 'Logged-in overview', url: 'account.service.nsw.gov.au/overview', touch: 'Fines card', mock: (
    <div className="en-mock"><Bar>MyServiceNSW Account <span className="en-r">Hello, {PERSON.split(' ')[0]}</span></Bar><div className="en-body"><strong>My services</strong><div className="en-cards"><span>Driver Licence</span><span>Vehicle registration</span><Hot>Fines: View, manage and pay your fines</Hot></div></div></div>
  ) },
  { t: 'Sign-on hand-off to Revenue NSW', url: 'fines.digital.revenue.nsw.gov.au', touch: 'Older fines tab', sso: true, mock: (
    <div className="en-mock"><Bar kind="rnsw">NSW Government · Revenue NSW <span className="en-r">Back to MyServiceNSW Account</span></Bar><div className="en-body"><strong>Fines overview</strong><div className="en-tabs"><span>Open</span><span>Recently closed</span><Hot>Older fines</Hot></div></div></div>
  ) },
  { t: 'Older fines: search', url: 'fines.digital.revenue.nsw.gov.au', touch: 'Search using a fine number', mock: (
    <div className="en-mock"><Bar kind="rnsw">NSW Government · Revenue NSW</Bar><div className="en-body"><Field label="Search using a fine number" value={F.p} hot /><small>1–10 of 28 result(s) · Expand all</small></div></div>
  ) },
  { t: 'Search result', url: 'fines.digital.revenue.nsw.gov.au', touch: 'See details and options', mock: (
    <div className="en-mock"><Bar kind="rnsw">NSW Government · Revenue NSW</Bar><div className="en-body"><small>1 of 1 result(s)</small><div className="en-card"><span className="en-tag">Paid</span><small>Fine {F.p} · {WHEN}</small><small>{F.offence}</small><small>Amount owing {F.amount}</small><Hot>See details and options</Hot></div></div></div>
  ) },
  { t: 'Fine details', url: 'fines.digital.revenue.nsw.gov.au', touch: 'Show images', mock: (
    <div className="en-mock"><Bar kind="rnsw">NSW Government · Revenue NSW</Bar><div className="en-body"><strong>Fine {F.p}</strong><small>{F.offence}</small><small>My options</small><Hot>Show images</Hot></div></div>
  ) },
  { t: 'Images and the certificate link', url: 'fines.digital.revenue.nsw.gov.au', touch: 'View camera certification (signed link)', mock: (
    <div className="en-mock"><Bar kind="rnsw">NSW Government · Revenue NSW</Bar><div className="en-body"><small className="en-warn">Warning for Aboriginal and Torres Strait Islander customers</small><small>Hide images · The images displayed are the original versions and have not been changed in any way.</small><Hot>View camera certification ↗</Hot><Img /><small>Pages 1 2 3 · Download</small></div></div>
  ) },
];

const B = [
  { t: 'Revenue NSW home', url: 'revenue.nsw.gov.au', touch: 'myPenalty: Pay your fine online', mock: (
    <div className="en-mock"><Bar kind="rnsw">NSW Government · Revenue NSW</Bar><div className="en-body"><small>Taxes · Fines and fees · Grants and schemes · Unclaimed money</small><strong>Easy access</strong><small>Make a payment · Online services</small><Hot>myPenalty: Pay your fine online</Hot></div></div>
  ) },
  { t: 'myPenalty: About your fine', url: 'apps09.revenue.nsw.gov.au/customer_service/finesonline', touch: 'Notice number, date, Next', mock: (
    <div className="en-mock"><Bar kind="rnsw">NSW Government · Revenue NSW · myPenalty</Bar><div className="en-body"><small>Enter details exactly as they appear on the penalty notice. Privacy collection notice.</small><Field label="Penalty notice number *" value={F.p} /><Field label="Date of offence * (DD/MM/YYYY)" value="14/03/2026" /><Hot>Next</Hot></div></div>
  ) },
  { t: 'Penalty summary', url: 'apps09.revenue.nsw.gov.au', touch: 'Images panel', mock: (
    <div className="en-mock"><Bar kind="rnsw">NSW Government · Revenue NSW · myPenalty</Bar><div className="en-body"><strong>Penalty summary</strong><small>Amount {F.amount} · {WHERE}</small><small>Demerit points note for learner and provisional drivers</small><small>Manage another penalty</small></div></div>
  ) },
  { t: 'Registration to see images', url: 'apps09.revenue.nsw.gov.au', touch: 'Registration number, View images', extra: true, mock: (
    <div className="en-mock"><Bar kind="rnsw">NSW Government · Revenue NSW · myPenalty</Bar><div className="en-body"><strong>Images</strong><small>Enter your vehicle registration number to view images</small><Field label="Registration number" value={PLATE} hot /><Hot>View images</Hot></div></div>
  ) },
  { t: 'Penalty notice images and the certificate link', url: 'apps09.revenue.nsw.gov.au', touch: 'View certification details (signed link)', mock: (
    <div className="en-mock"><Bar kind="rnsw">NSW Government · Revenue NSW · myPenalty</Bar><div className="en-body"><Img /><div className="en-thumbs"><Img small /><Img small /><Img small /></div><small>Download Images · The images displayed are in the original versions and have not been changed in any way.</small><strong>Camera Certification</strong><Hot>View certification details for this camera on the Roads and Maritime Services (RMS) website ↗</Hot><small>contact RMS</small></div></div>
  ) },
];

function Lane({ id, title, sub, steps }) {
  const all = [...steps, { t: 'CEVOC certificate page', url: 'cevoc.transport.nsw.gov.au', touch: 'Uplifted', cevoc: true, mock: <Cevoc /> }];
  return (
    <section className="en-lane" aria-labelledby={`en-${id}`}>
      <h2 id={`en-${id}`}>{title}</h2>
      <p className="en-sub">{sub}</p>
      <ol className="en-steps">
        {all.map((s, i) => (
          <li key={s.t} className={`en-step${s.cevoc ? ' is-cevoc' : ''}`}>
            <div className="en-step__head">
              <span className="en-n">{i + 1}</span>
              <strong>{s.t}</strong>
              <span className={`en-tag2${s.cevoc ? ' is-up' : ''}`}>{s.cevoc ? 'Uplifted (the only change)' : 'Existing, unchanged'}</span>
              {s.extra && <span className="en-tag2 is-extra">Extra step on this path</span>}
              {s.sso && <span className="en-tag2 is-extra">Single sign-on, no second login</span>}
            </div>
            <code className="en-url">{s.url}</code>
            {s.mock}
            {!s.cevoc && <small className="en-touch">Next: {s.touch}</small>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function EntryFlows() {
  const [lane, setLane] = useState('both');
  const sample = `certificateDetails.jsf?p=${F.p}&d=${F.d}&s=${F.s}&i=${F.i}&m=${DEMO_SIGNATURE}`;
  return (
    <div className="en">
      <p className="en-note">The invented fine used on both paths: {F.program.toLowerCase()}, {WHEN}, notice {F.p}. The notice, the images and the Service NSW and Revenue NSW pages stay as they are.</p>
      <div className="seg2 uh-seg" role="group" aria-label="Show journey">
        {[['both', 'Both'], ['a', 'A · Service NSW (logged in)'], ['b', 'B · myPenalty (no login)']].map(([k, t]) => (
          <button key={k} type="button" aria-pressed={lane === k} onClick={() => setLane(k)}>{t}</button>
        ))}
      </div>
      <div className={`en-lanes${lane === 'both' ? ' is-both' : ''}`}>
        {lane !== 'b' && <Lane id="a" title="A · Service NSW, logged in" sub="Service NSW login, then Revenue NSW’s fines site (fines.digital) by single sign-on." steps={A} />}
        {lane !== 'a' && <Lane id="b" title="B · Revenue NSW myPenalty, no login" sub="Revenue NSW’s public myPenalty (apps09): notice number and date, then the registration to see images." steps={B} />}
      </div>
      <section className="en-diff" aria-labelledby="en-diff-h">
        <h2 id="en-diff-h">What differs, and what doesn’t</h2>
        <ul>
          <li><strong>Two different Revenue NSW websites</strong> that look alike: fines.digital.revenue.nsw.gov.au (path A) and apps09.revenue.nsw.gov.au/customer_service/finesonline (path B). <Link to="/uplift/hub/questions?q=U31">U31</Link></li>
          <li><strong>Path B asks for the vehicle registration</strong> before it shows the images; path A, signed in, does not. <Link to="/uplift/hub/questions?q=U32">U32</Link></li>
          <li><strong>Both end with the identical signed link</strong> (verified by the owner), so one CEVOC page serves both. <Link to="/uplift/hub/questions?q=U15">U15</Link>
            <code className="en-link">{sample}</code>
            <dl className="en-params">
              <dt>p</dt><dd>penalty notice number</dd>
              <dt>d</dt><dd>offence date and time, yyyyMMddTHHmmss</dd>
              <dt>s</dt><dd>site or camera number</dd>
              <dt>i</dt><dd>unknown <Link to="/uplift/hub/questions?q=U29">U29</Link></dd>
              <dt>m</dt><dd>signature <Link to="/uplift/hub/questions?q=U30">U30</Link></dd>
            </dl>
            <small>Values shown are invented.</small>
          </li>
          <li><strong>myPenalty still says “Roads and Maritime Services (RMS)”</strong> and “contact RMS”. Out of scope for CEVOC; to raise with Revenue NSW. <Link to="/uplift/hub/questions?q=U33">U33</Link></li>
        </ul>
        <Link to={ENTRY_LINK} className="en-go">Open the uplifted CEVOC page with the invented signed link ↗</Link>
      </section>
    </div>
  );
}
