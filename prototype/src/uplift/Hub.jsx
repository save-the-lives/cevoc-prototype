import '../styles/uplift-hub.css';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '../shared/ui.jsx';
import {
  ENTRY_LINK, FIELDS, JOURNEY, LABELS, LABEL_KEYS, OPEN, QUESTIONS, RECORD_SAMPLES, SAMPLES, STATUS, STORIES, qById, recordLink, searchLink, storyReady,
} from './data.js';
import { HUB_TABS, LabelSwitch, Q } from './kit.jsx';
import Content from './Content.jsx';
import Settings from './Settings.jsx';
import Lifecycle from './Lifecycle.jsx';
import SignedLink from './SignedLink.jsx';
import { AdrPage, QuestionsPage, StoriesPage } from './Lists.jsx';
import EntryFlows from './Entry.jsx';
import JourneyViews from './JourneyViews.jsx';

// CERTIFICATE UPLIFT HUB (#/uplift/hub): the phase 1 uplift's own hub, modelled on enf-site-onboarding.
// Start here, screens to try, and a companion layer (journey, entry from the apps, legacy and target, field delta,
// stories, questions), each linking to the others and to the exact screen.

function Shell({ tab, title, lede, children }) {
  useEffect(() => { document.title = `${title} · Certificate uplift hub`; }, [title]);
  return (
    <div className="uh-hub">
      <header className="uh-hub__head">
        <div className="pub-wrap">
          <p className="uh-hub__kicker">CEVOC · phase 1 certificate uplift · prototype hub</p>
          <nav aria-label="Uplift hub" className="uh-tabs">
            {HUB_TABS.map(([id, label]) => <Link key={id} to={`/uplift/hub${id ? `/${id}` : ''}`} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined}>{label}</Link>)}
            <Link to="/uplift" className="uh-tabs__go">Search screen ↗</Link>
            <Link to={ENTRY_LINK} className="uh-tabs__go">Record screen ↗</Link>
          </nav>
        </div>
      </header>
      <main className="pub-wrap uh-hub__main" id="main">
        <div className="uh-hub__title"><h1>{title}</h1></div>
        {lede && <p className="uh-lede">{lede}</p>}
        {children}
      </main>
      <footer className="pub-wrap uh-hub__foot">Mockup only. All locations and certificates are invented. Legacy wording comes from the owner’s screenshots, which are not stored here. <Link to="/demo">Main CEVOC demo hub</Link> · <a href="https://github.com/save-the-lives/cevoc-prototype/releases/download/site-latest/cevoc-site.zip">Download this site (zip)</a>: unzip, then serve the folder (for example <code>npx serve .</code>) and open it; opening index.html straight from disk won’t work.</footer>
    </div>
  );
}

const Tag = ({ open, children }) => <span className={`uh-tag ${open ? 'is-open' : 'is-done'}`}>{children}</span>;

function Home() {
  const open = QUESTIONS.filter(OPEN).length;
  const ready = STORIES.filter(storyReady).length;
  return (
    <Shell tab="" title="Certificate uplift hub" lede="Phase 1 uplifts the legacy certificate search (Customer Enquiry and Verification of Certificate) to the NSW Design System, for two kinds of user, neither of whom logs in: a person checking the camera on their notice, and Revenue NSW staff searching many cameras.">
      <div className="uh-grid2">
        <section className="uh-card">
          <h2>Start here</h2>
          <h3>What this is</h3>
          <p>A clickable mock-up with invented data. It keeps every function of the legacy page and changes how it looks and works: several locations at once, a day range in one calendar, rows that expand in place, and clear messages when a certificate is missing or the system fails.</p>
          <h3>Who it is for</h3>
          <p>Revenue NSW and Transport users, the CMCS data owner, Legal, and the delivery team.</p>
          <h3>How to read it</h3>
          <p>The screens look exactly as a real user would see them. Press the small <strong>Tour</strong> button (bottom right) on any screen for the reviewer’s overlay: numbered notes on each area with the legacy and new names, its stories and open questions, sample searches and links, the label switch, and on the record page “Highlight dynamic data” and the copy variants. Escape closes it.</p>
          <p className="uh-meta">{STORIES.length} stories, {ready} ready for dev · {QUESTIONS.length} questions, {open} open</p>
        </section>
        <section className="uh-card">
          <h2>Things to try</h2>
          <ol className="uh-try">
            {SAMPLES.map((s) => <li key={s.label}><Link to={searchLink(s)}>{s.label}</Link>: {s.note.toLowerCase()}.</li>)}
            {RECORD_SAMPLES.slice(0, 4).map((s) => <li key={s.label}><Link to={recordLink(s)}>Person with a notice: {s.label.toLowerCase()}</Link>.</li>)}
            <li>On the search screen, type <em>Testville</em> in the locations box, pick both, open the calendar and click two days.</li>
            <li>On either key screen, press <em>Tour</em> and switch the labels between legacy and new names.</li>
          </ol>
        </section>
      </div>
      <h2 className="uh-h2">Key screens: drive the demo and gather requirements here</h2>
      <div className="uh-tiles uh-tiles--key">
        <Link to="/uplift" className="uh-tile"><h3>Certificate search (Revenue NSW staff)</h3><p>Several locations by code or address, day range, sortable results that expand in place, gap and fault messages.</p></Link>
        <Link to={ENTRY_LINK} className="uh-tile"><h3>Certificate details (person with a fine)</h3><p>The legacy end-user page, lifted and shifted. Reached from the same signed link in the Service NSW path and myPenalty.</p></Link>
      </div>
      <h2 className="uh-h2">Companion layer</h2>
      <div className="uh-tiles">
        <Link to="/uplift/hub/journey" className="uh-tile"><h3>Journey</h3><p>The public user first, forked by app, then staff.</p></Link>
        <Link to="/uplift/hub/entry" className="uh-tile"><h3>Entry from the apps</h3><p>The two current journeys, Service NSW (logged in) and myPenalty (no login), recreated step by step. Only the CEVOC page changes.</p></Link>
        <Link to="/uplift/hub/content" className="uh-tile"><h3>Page content</h3><p>The end-user page split into dynamic data and static copy, and copy variants to test.</p></Link>
        <Link to="/uplift/hub/compare" className="uh-tile"><h3>Legacy and target</h3><p>Each part of the page, side by side.</p></Link>
        <Link to="/uplift/hub/fields" className="uh-tile"><h3>Field delta</h3><p>Fields on the legacy page against what the BRD asks for, and the label changes.</p></Link>
        <Link to="/uplift/hub/stories" className="uh-tile"><h3>Stories</h3><p>Given/When/Then acceptance criteria, ready or not.</p></Link>
        <Link to="/uplift/hub/questions" className="uh-tile"><h3>Questions</h3><p>Everything still undecided, who can answer, and what it changes.</p></Link>
      </div>
    </Shell>
  );
}

function Lane({ title, steps }) {
  return (
    <section className="uh-lane">
      <h2>{title}</h2>
      <ol className="uh-steps">
        {steps.map((s, i) => (
          <li key={s.id} className={`uh-step is-${s.kind}`}>
            <span className="uh-step__n">{i + 1}</span>
            <strong>{s.name}</strong>
            {s.fork ? <span className="uh-fork">{s.fork.map((f, j) => <span key={f}>{j > 0 && <em> or </em>}{f}</span>)}</span> : <span className="uh-step__who">{s.who}</span>}
            <small>{s.note}</small>
            {s.to && <Link to={s.to}>Open this step ↗</Link>}
            {s.qs && <span>{s.qs.map((id) => <Q key={id} id={id} />)}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Journey() {
  return (
    <Shell tab="journey" title="Journey" lede="Who reaches the certificate page and how, shown three ways to compare. Dashed: existing, unchanged. Orange: CEVOC, the only uplifted step.">
      <JourneyViews />
    </Shell>
  );
}

function Entry() {
  return (
    <Shell tab="entry" title="Entry from the apps" lede="The two journeys that reach the CEVOC certificate page today, recreated as mock screens with one invented fine. Only the CEVOC page is uplifted; every other step stays as it is.">
      <EntryFlows />
      <SignedLink />
    </Shell>
  );
}

// Legacy and target, one accordion per part, legacy look recreated on the left, target on the right.
const Lg = {
  Banner: () => <div className="lg-banner"><span>Customer Enquiry and Verification of Certificate</span><span className="lg-logo">NSW</span></div>,
  Bar: () => <div className="lg-bar">✉ Contact us · ? Help · Wednesday, 25 November 2026</div>,
  Box: ({ w = 110, v = '' }) => <span className="lg-box" style={{ width: w }}>{v}</span>,
  Btn: ({ red, children }) => <span className={`lg-btn${red ? ' is-red' : ''}`}><span className="lg-btn__i">{red ? 'X' : '➔'}</span>{children}</span>,
};
const Tg = {
  Btn: ({ outline, children }) => <span className={`tg-btn${outline ? ' is-outline' : ''}`}>{children}</span>,
  Field: ({ label, children }) => <span className="tg-field"><span className="tg-label">{label}</span>{children}</span>,
};
const COMPARE = [
  { part: 'Header', change: 'Same content, new look', legacy: <><Lg.Banner /><Lg.Bar /></>, target: <><div className="tg-head"><span className="tg-logo">NSW</span> Customer Enquiry and Verification of Certificate</div><div className="tg-bar">Contact us · Help · Wednesday 25 November 2026</div></> },
  { part: 'Instructions', change: 'Clearer wording (label switch)', legacy: <div className="lg-text"><span className="lg-h">Search</span><br />Please enter the search parameters<br /><small><span className="lg-star">*</span>indicates mandatory fields.</small></div>, target: <div className="tg-text"><strong className="tg-h">Find camera certificates</strong><br />Search by camera location and a date range.<br /><small>All fields are required.</small></div> },
  { part: 'Location', change: 'One location becomes several, by code or address', legacy: <div className="lg-text"><span className="lg-star">*</span> <b>Location code</b> : <Lg.Box w={80} v="1234" /></div>, target: <Tg.Field label="Camera locations"><span className="tg-chips"><span className="tg-chip">1234 · Example St… ✕</span><span className="tg-chip">4567 · Specimen Pde… ✕</span><span className="tg-ph">Add another</span></span></Tg.Field> },
  { part: 'Dates', change: 'Date and time become days; one calendar picks the range', legacy: <div className="lg-text"><span className="lg-star">*</span> <b>Date/Time from</b> : <Lg.Box w={120} /> <span className="lg-cal">▦</span>&nbsp; <span className="lg-star">*</span> <b>Date/Time to</b> : <Lg.Box w={120} v="25/11/2026 12:03" /> <span className="lg-cal">▦</span></div>, target: <span className="tg-row"><Tg.Field label="From"><span className="tg-input">01/11/2025</span></Tg.Field><Tg.Field label="To"><span className="tg-input">30/06/2026</span></Tg.Field><span className="tg-calbtn">▦</span></span> },
  { part: 'Buttons', change: 'Same three actions, full-size, aligned', legacy: <div><Lg.Btn>SEARCH</Lg.Btn> <Lg.Btn>CLEAR</Lg.Btn> <Lg.Btn red>CLOSE</Lg.Btn></div>, target: <span className="tg-row"><Tg.Btn>Search</Tg.Btn><Tg.Btn outline>Clear</Tg.Btn><Tg.Btn outline>Close</Tg.Btn></span> },
  { part: 'Errors', change: 'Error summary linked to each field', legacy: <div className="lg-text">Little guidance on what is wrong.</div>, target: <div className="tg-err"><strong>There is a problem</strong><br /><u>Add at least one camera location.</u><br /><u>Enter the From date.</u></div> },
  { part: 'Results', change: 'Same columns plus Location; rows expand in place', legacy: <table className="lg-table"><thead><tr><th>Certificate Description</th><th>Certificate type ⇕</th><th>Period ⇕</th><th>Certified date ⇕</th><th>Expiry date ⇕</th></tr></thead><tbody><tr><td>Approved Traffic Enforcement Device</td><td>Red Light Speed Camera</td><td>YEARLY</td><td>12/08/2025</td><td>12/08/2026</td></tr></tbody></table>, target: <table className="tg-table"><thead><tr><th /><th>Location</th><th>Certificate</th><th>Camera type</th><th>Certification cycle</th><th>Certified on</th><th>Expires on</th></tr></thead><tbody><tr><td>▾</td><td>1234</td><td>Approved Traffic Enforcement Device</td><td>Red Light Speed Camera</td><td>YEARLY</td><td>12/08/2025</td><td>12/08/2026</td></tr><tr><td /><td colSpan={6}><small>Status: Published · Device model: awaiting CMCS…</small></td></tr></tbody></table> },
  { part: 'Nothing to show', change: 'Three distinct messages: no match, missing certificate, system fault', legacy: <table className="lg-table"><tbody><tr><td>No records found.</td></tr></tbody></table>, target: <div className="tg-stack"><span className="tg-empty">No certificates found · Change the dates</span><span className="tg-warn">Missing certificate: no quarterly certificate from 01/03/2026 to 14/03/2026</span><span className="tg-danger">We couldn’t get certificates right now. This is a problem with our system, not a missing certificate.</span></div> },
  { part: 'Downloads', change: 'Same: none', legacy: <div className="lg-text">None</div>, target: <div className="tg-text">None</div> },
];
function Compare() {
  return (
    <Shell tab="compare" title="Legacy and target" lede="Each part of the page. Open a part to see the legacy look, recreated from the owner’s screenshots, beside the target.">
      <div className="uh-acc">
        {COMPARE.map((r, i) => (
          <details key={r.part} open={i === 0}>
            <summary><strong>{r.part}</strong><span>{r.change}</span></summary>
            <div className="uh-sbs">
              <figure><figcaption>Legacy today</figcaption><div className="lg">{r.legacy}</div></figure>
              <figure><figcaption>Target (phase 1)</figcaption><div className="tg">{r.target}</div></figure>
            </div>
          </details>
        ))}
      </div>
    </Shell>
  );
}

function Fields() {
  return (
    <Shell tab="fields" title="Field delta" lede="Every field on the legacy page against what the BRD asks for. “New” means the API or data may need to change; the source is to be confirmed from CMCS samples.">
      <div className="up-scroll">
        <table className="uh-tbl">
          <thead><tr><th>Field</th><th>On legacy page</th><th>In the BRD</th><th>Delta</th><th>Change</th><th>Likely source</th><th>Question</th></tr></thead>
          <tbody>{FIELDS.map((f) => (
            <tr key={f.field}><td><strong>{f.field}</strong></td><td>{f.legacy}</td><td>{f.brd}</td><td><span className={`uh-tag ${f.delta === 'New' ? 'is-warn' : f.delta === 'Changed' ? 'is-open' : 'is-done'}`}>{f.delta}</span></td><td>{f.change}</td><td>{f.source}</td><td>{f.q && <Q id={f.q} />}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <h2 className="uh-h2">Label changes <Q id="U28" /></h2>
      <div className="up-scroll">
        <table className="uh-tbl">
          <thead><tr><th>Legacy name</th><th>New name</th></tr></thead>
          <tbody>{LABEL_KEYS.map((k) => <tr key={k}><td>{LABELS.legacy[k]}</td><td>{LABELS.next[k]}</td></tr>)}</tbody>
        </table>
      </div>
      <h2 className="uh-h2">API for other government sites <Q id="U7" /></h2>
      <p><code>GET /api/v1/certificates?locations=1234,4567&amp;from=2025-11-01&amp;to=2026-06-30</code> returns the rows the search shows, as JSON, including status, re-issue and gaps. Same answer for Service NSW, Revenue NSW and this page.</p>
    </Shell>
  );
}



export default function Hub({ page, query = {} }) {
  if (page === 'journey') return <Journey />;
  if (page === 'entry') return <Entry />;
  if (page === 'compare') return <Compare />;
  if (page === 'fields') return <Fields />;
  if (page === 'lifecycle') return <Shell tab="lifecycle" title="Certificate lifecycle" lede="How each certificate status from CMCS shows on the search and the record page."><Lifecycle /></Shell>;
  if (page === 'adr' || page === 'decisions') return <Shell tab="adr" title="Architecture decision records" lede="ADR-001 onwards: each with context, options, decision, consequences and the questions and stories it touches. Search, edit with the pencil, export or import. Proposed until confirmed."><AdrPage query={query} /></Shell>;
  if (page === 'settings') return <Shell tab="settings" title="App settings" lede="Every configurable value the uplift relies on, its default and who owns it."><Settings /></Shell>;
  if (page === 'content') return <Shell tab="content" title="Page content" lede="The end-user certificate page split into dynamic data and static copy, with copy variants to test."><Content /></Shell>;
  if (page === 'stories') return <Shell tab="stories" title="Stories" lede="Tagged by user type, path and BRD requirement. Search, filter, sort, edit with the pencil, and export or import the latest state. A story is ready for dev only when it has acceptance criteria and none of its questions is open."><StoriesPage query={query} /></Shell>;
  if (page === 'questions') return <Shell tab="questions" title="Questions" lede="Everything still undecided, who can answer it, and what it changes. Search, filter and sort; edit with the pencil; export or import the latest state."><QuestionsPage query={query} /></Shell>;
  return <Home />;
}
