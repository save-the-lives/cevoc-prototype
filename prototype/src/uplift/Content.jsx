import { useRef, useState } from 'react';
import { Link } from '../shared/ui.jsx';
import { ENTRY_LINK, OFFENCES, locByCode } from './data.js';
import { COPY, COPY_KEYS, DISCLAIMER, DYNAMIC, GIPA_URL, STATIC } from './tour.js';

// Hub page: the end-user certificate page as it will look for a real offence (invented values), one tab per copy
// variant, with dynamic data and static copy colour-coded; then the dynamic data lined up with the BRD (new items
// marked, owner unknown), and the static copy, which lives in a configurable template (story S20).

const O = OFFENCES[0];
const LOC = locByCode(O.s);
const CERT_DATE = '2 March 2026';

const D = ({ src, children }) => <span className="ct-dyn" data-src={src}>{children}<span className="ct-src">{src}</span></span>;
const S = ({ children, as: Tag = 'span', ...rest }) => <Tag className="ct-static" {...rest}>{children}</Tag>;

function Preview({ k, colours }) {
  const C = COPY[k];
  const sentence = C.cert('\u0000', '14 March 2026');
  const [a, b] = sentence.split('\u0000');
  return (
    <div className={`ct-page${colours ? ' is-coloured' : ''}`}>
      <div className="ct-mast">A NSW Government website</div>
      <div className="ct-head"><span className="ct-logo">NSW</span><S>Customer Enquiry and Verification of Certificate</S></div>
      <div className="ct-bar"><S>Contact us</S> · <S>Help</S> · <D src="Today’s date">Wednesday 25 November 2026</D></div>
      <div className="ct-body">
        <h3 className="ct-h1"><S>Certificate details</S></h3>
        <h4><S>Offence Details</S></h4>
        <dl className="ct-dl">
          <dt><S>Penalty notice number</S></dt><dd><D src="Signed link p · Revenue NSW / Transport">{O.p}</D></dd>
          <dt><S>Program type</S></dt><dd><D src="CMCS site · Transport">{O.program}</D></dd>
          <dt><S>Site, zone or camera number</S></dt><dd><D src="Signed link s · Transport">{O.s}</D></dd>
          <dt><S>Site location</S></dt><dd><D src="CMCS site · Transport">{LOC.address}</D></dd>
          <dt><S>Date of offence</S></dt><dd><D src="Signed link d · Transport / Revenue NSW">14/03/2026</D></dd>
          <dt><S>Time of offence</S></dt><dd><D src="Signed link d · Transport">08:30</D></dd>
        </dl>
        <h4><S>Camera certificate details for this offence</S></h4>
        <p className="ct-lead"><S>{a}</S><D src="CMCS / CES (FAES)">{CERT_DATE}</D><S>{b}</S></p>
        <h4><S>Enforcement cameras and certification requirements</S></h4>
        {C.req.map((p) => <p key={p}><S>{p}</S></p>)}
        <p className="ct-disc"><span className="ct-proposed">Proposed legal text (U8)</span> <S>{DISCLAIMER.before}<a href={GIPA_URL} target="_blank" rel="noreferrer">{DISCLAIMER.link}</a>{DISCLAIMER.after}</S></p>
        <span className="ct-btn"><S>Close</S></span>
      </div>
    </div>
  );
}

function Tabs() {
  const [tab, setTab] = useState('legacy');
  const [colours, setColours] = useState(true);
  const refs = useRef({});
  const key = (e, i) => {
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? COPY_KEYS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const k = COPY_KEYS[(n + COPY_KEYS.length) % COPY_KEYS.length];
    setTab(k); refs.current[k]?.focus();
  };
  return (
    <section className="ct-tabs">
      <div className="ct-tabs__top">
        <div role="tablist" aria-label="Copy variant" className="ct-tablist">
          {COPY_KEYS.map((k, i) => (
            <button key={k} ref={(el) => { refs.current[k] = el; }} type="button" role="tab" id={`ct-tab-${k}`} aria-selected={tab === k} aria-controls={`ct-panel-${k}`} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)} onKeyDown={(e) => key(e, i)}>
              {COPY[k].label}
            </button>
          ))}
        </div>
        <label className="ct-toggle"><input type="checkbox" checked={colours} onChange={(e) => setColours(e.target.checked)} /> Colour dynamic and static</label>
      </div>
      {COPY_KEYS.map((k) => (
        <div key={k} role="tabpanel" id={`ct-panel-${k}`} aria-labelledby={`ct-tab-${k}`} hidden={tab !== k}>
          <p className="ct-worry"><strong>Why this version:</strong> {COPY[k].worry}</p>
          {colours && (
            <p className="ct-legend" aria-label="Legend">
              <span className="ct-sw ct-sw--dyn" /> Dynamic data, labelled with its source and owner
              <span className="ct-sw ct-sw--static" /> Static copy, from the configurable template
            </p>
          )}
          <Preview k={k} colours={colours} />
        </div>
      ))}
    </section>
  );
}

export default function Content() {
  return (
    <>
      <p>The certificate page exactly as a person would see it for a real offence (all values invented), one tab per copy variant. <Link to={`${ENTRY_LINK}&tour=1`}>Open the live page with the tour ↗</Link></p>
      <Tabs />

      <h2 className="uh-h2">Dynamic data, against the BRD</h2>
      <p>Rows marked <span className="uh-tag is-warn">New</span> are asked for by the BRD but not on the page today; their source and owner are unknown until CMCS sample data arrives (U3).</p>
      <div className="up-scroll">
        <table className="uh-tbl">
          <thead><tr><th>Field</th><th>Page</th><th>Where it comes from</th><th>Owner of the data</th><th>In the BRD</th><th>Status</th></tr></thead>
          <tbody>{DYNAMIC.map((r) => (
            <tr key={r.field} className={r.status === 'New' ? 'ct-new' : ''}>
              <td><strong>{r.field}</strong></td><td>{r.page}</td><td>{r.source}</td><td>{r.owner}</td><td>{r.brd}</td>
              <td><span className={`uh-tag ${r.status === 'New' ? 'is-warn' : 'is-done'}`}>{r.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <h2 className="uh-h2">Static copy: a maintained, configurable template</h2>
      <div className="uh-card ct-req">
        <p><strong>Requirement (S20):</strong> every static block on the page lives in a configurable template that Transport can maintain, so wording changes without rewriting or redeploying the application. Placeholders such as <code>{'{certificationDate}'}</code> pull in the dynamic values; each change is previewed, approved, versioned and can be rolled back. <Link to="/uplift/hub/stories?s=S20">Story S20</Link> · <Link to="/uplift/hub/questions?q=U35">Who maintains it (U35)</Link></p>
      </div>
      <div className="up-scroll">
        <table className="uh-tbl">
          <thead><tr><th>Block</th><th>What it says</th><th>In the BRD</th><th>Status</th></tr></thead>
          <tbody>{STATIC.map((r) => (
            <tr key={r.block} className={r.status === 'New' ? 'ct-new' : ''}>
              <td><strong>{r.block}</strong></td><td>{r.what}</td><td>{r.brd}</td>
              <td><span className={`uh-tag ${r.status === 'New' ? 'is-warn' : 'is-done'}`}>{r.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
