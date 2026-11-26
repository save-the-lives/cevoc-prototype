import { useEffect, useState } from 'react';
import { Button, Callout, Header, HeaderBrand, Masthead } from '@nswds/ui';
import {
  CERTIFICATES, SOURCES, FAULT_CODES, OFFENCES, RECORD_SAMPLES, certificatesAt, fmtDay, locByCode, offenceFromLink, parseDay, recordLink, signedLink, typeOf,
} from './data.js';
import { COPY, DISCLAIMER, GIPA_URL, certLead, fillTemplate } from './tour.js';
import TourLayer, { useTour } from './Tour.jsx';
import { StatusTag, SupportBar } from './Search.jsx';
import { go } from '../lib/router.js';
import { Dyn, NewMark } from './kit.jsx';

// PHASE 1 UPLIFT (#/uplift/record): the legacy end-user certificate page (certificateDetails.jsf), lifted and
// shifted. Reached from "View camera certification" on the Revenue NSW fines site (Service NSW path) or from
// myPenalty: both give the same signed link ?p=&d=&s=&i=&m= (owner verified, U31). Same sections and wording as
// the legacy page: Offence Details, Camera certificate details for this offence, Enforcement cameras and
// certification requirements, Close. New: distinct messages for a missing or withdrawn certificate and a fault.
// No login. Older links ?loc=&at=dd/mm/yyyy still open the page (record 0006). Values are invented.

const PROGRAM = { RLSC: 'Red Light Speed Camera', FDSC: 'Fixed Speed Camera', ASC: 'Average Speed Camera', MPDC: 'Mobile Phone Detection Camera' };
const fromD = (d) => {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(d || '');
  return m ? { day: new Date(+m[1], +m[2] - 1, +m[3]), time: `${m[4]}:${m[5]}` } : null;
};
const longDay = (d) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

export default function Record({ query = {} }) {
  const { copy } = useTour();
  const C = COPY[copy] || COPY.legacy;
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [closedMsg, setClosedMsg] = useState(false);
  useEffect(() => { document.title = 'Certificate details | Customer Enquiry and Verification of Certificate'; }, []);

  // Resolve the link: signed (p d s i m) or the older loc + at.
  const signed = query.p !== undefined || query.m !== undefined;
  const off = signed ? offenceFromLink(query) : null;
  const code = signed ? (off ? off.s : String(query.s || '')) : String(query.loc || '').trim();
  const when = signed ? (off ? fromD(off.d) : null) : (() => { const [d, t] = String(query.at || '').split(' '); const day = parseDay(d); return day ? { day, time: t || '' } : null; })();
  const loc = locByCode(code);
  const one = query.id ? CERTIFICATES.find((x) => x.id === query.id) : null;
  const badLink = signed ? !off : (!loc || (!when && !one));
  const retry = () => { setBusy(true); setTimeout(() => { setBusy(false); setNonce(nonce + 1); }, 600); };

  let body;
  if (busy) body = <p role="status">Checking again…</p>;
  else if (FAULT_CODES.has(code)) {
    body = (
      <Callout status="danger" title="We couldn’t get the certificate details right now" role="alert">
        <p>This is a problem with our system. It does not mean the camera had no certificate. Please try again later.</p>
        <Button type="button" variant="outline" onClick={retry}>Try again</Button>
      </Callout>
    );
  } else if (badLink) {
    body = (
      <Callout status="info" title="We couldn’t open the certificate details from this link">
        <p>The link may be incomplete or out of date. Go back to your fine in the Service NSW app or myPenalty and select the camera certification link again, or call 13 22 13.</p>
      </Callout>
    );
  } else {
    const day = one ? parseDay(one.certified) : when.day;
    // Section 3 lists every certificate type in force on the offence day (one line each); a type with none in force
    // gets the missing-certificate warning. The types per program are an app setting (U16, ADR-001).
    const { inForce, withdrawn, missing, present } = one ? { inForce: [one], withdrawn: [], missing: [], present: [one] } : certificatesAt(code, day);
    const offenceDay = one ? null : when.day;
    const label = (x) => typeOf(loc.program, x.kind).label;
    body = (
      <>
        <section className="cd-sec" data-tour="offence" aria-labelledby="cd-off">
          <h2 id="cd-off">Offence Details</h2>
          <dl className="cd-dl">
            <dt>Penalty notice number</dt><dd>{off ? <Dyn src="Signed link: p">{off.p}</Dyn> : 'Not in this link'}</dd>
            <dt>Program type</dt><dd><Dyn src="CMCS site record">{off ? off.program : PROGRAM[loc.program]}</Dyn></dd>
            <NewMark as="dt">Offence type</NewMark><dd>{off ? <Dyn isNew src="Offence type: source unknown (U39)">{off.offenceType || 'Not in this link'}</Dyn> : 'Not in this link'}</dd>
            <dt>Site, zone or camera number</dt><dd><Dyn src="Signed link: s">{loc.code}</Dyn></dd>
            <dt>Site location</dt><dd><Dyn src="CMCS site record">{loc.address}</Dyn></dd>
            {!one && <><dt>Date of offence</dt><dd><Dyn src="Signed link: d">{fmtDay(when.day)}</Dyn></dd></>}
            {!one && when.time && <><dt>Time of offence</dt><dd><Dyn src="Signed link: d">{when.time}</Dyn></dd></>}
          </dl>
        </section>

        <section className="cd-sec" data-tour="cert" aria-labelledby="cd-cert">
          <h2 id="cd-cert">Camera certificate details for this offence</h2>
          {present.length > 0 && (
            <div className="cd-lead" data-testid="cert-lines">
              <p>{renderTemplate(certLead(C, present.length, !!offenceDay), { offenceDate: offenceDay && longDay(offenceDay) })}</p>
              <ul className="cd-certs">
                {present.map((x) => <li key={x.id}>{renderTemplate(C.cert.line, { type: label(x), certified: longDay(parseDay(x.certified)), expiry: longDay(parseDay(x.expiry)) })}</li>)}
              </ul>
              {C.cert.tail && <p>{C.cert.tail}</p>}
            </div>
          )}
          {(present.length + withdrawn.length) > 0 && <p className="cd-status">Certificate status: {[...present, ...withdrawn].map((r) => <span key={r.id} className="cd-status__i"><Dyn isNew src="CMCS: certificate type">{label(r)}</Dyn>&nbsp;<Dyn isNew src="CMCS: certificate status today"><StatusTag r={r} /></Dyn></span>)}</p>}
          <div data-tour="states" className="cd-states">
            {missing.length > 0 && (
              <Callout status="warning" title={<>No <Dyn isNew src="CMCS: missing certificate type">{missing.map((m) => m.toLowerCase()).join(' or ')}</Dyn> certificate was in force on <Dyn src="Signed link: d">{fmtDay(day)}</Dyn></>}>
                <p>Our records show a gap in certification for this camera on that day{present.length > 0 ? `, for the certificate ${missing.length > 1 ? 'types' : 'type'} named above. The certificates listed above were in force` : ''}. This is not a system problem. If this affects your decision, call 13 22 13 before you choose what to do.</p>
              </Callout>
            )}
            {withdrawn.length > 0 && (
              <Callout status="info" title="A certificate covering this day was withdrawn">
                <p>The <Dyn isNew src="CMCS: certificate type">{withdrawn.map((w) => label(w).toLowerCase()).join(' and ')}</Dyn> certificate certified on <Dyn isNew src="CMCS: certification date">{withdrawn.map((w) => w.certified).join(', ')}</Dyn> was withdrawn on <Dyn isNew src="CMCS: withdrawal date">{withdrawn.map((w) => w.withdrawn).join(', ')}</Dyn> and does not count.</p>
              </Callout>
            )}
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="pub up uh cd" key={nonce}>
      <a className="skip" href="#up-main" onClick={(e) => { e.preventDefault(); document.getElementById('up-main')?.focus(); }}>Skip to content</a>
      <div role="region" aria-label="NSW Government"><Masthead container="contained" /></div>
      <Header color="white" border container="contained"><HeaderBrand href={window.location.hash || '#/uplift/record'} sitename="Customer Enquiry and Verification of Certificate" /></Header>
      <SupportBar />
      <main id="up-main" tabIndex={-1} className="pub-wrap pub-page up-page cd-main">
        <h1 data-tour="title">Certificate details</h1>
        {body}
        <section className="cd-sec cd-req" data-tour="requirements" aria-labelledby="cd-req">
          <h2 id="cd-req">Enforcement cameras and certification requirements</h2>
          {C.req.map((para) => <p key={para}>{para}</p>)}
        </section>
        <p className="cd-disclaimer" data-tour="disclaimer">{DISCLAIMER.before}<a href={GIPA_URL} target="_blank" rel="noreferrer">{DISCLAIMER.link}</a>{DISCLAIMER.after}</p>
        <div className="uh-actions" data-tour="close">
          {off && query.r && SOURCES[query.r]
            ? <a className="cd-return" href={SOURCES[query.r].url} target="_blank" rel="noreferrer"><span>Return to <Dyn isNew src="Signed link: r, app setting record.returnLinks">{SOURCES[query.r].name}</Dyn></span></a>
            : <><button type="button" className="cd-close" onClick={() => { window.close(); setClosedMsg(true); }}>Close</button>{closedMsg && <p className="cd-closetab">You can close this tab.</p>}</>}
        </div>
      </main>
      <TourLayer screen="record" controls={(
        <section>
          <h3>Sample links</h3>
          <ul className="tr-list">
            {OFFENCES.map((o) => <li key={o.p}><button type="button" className="tr-link" onClick={() => go(signedLink(o))}>Signed link: {o.program}</button></li>)}
            {RECORD_SAMPLES.slice(1).map((s) => <li key={s.label}><button type="button" className="tr-link" onClick={() => go(recordLink(s))}>{s.label}</button> <small>{s.note}</small></li>)}
            <li><button type="button" className="tr-link" onClick={() => go(`${signedLink(OFFENCES[0]).replace(/m=[^&]+/, 'm=tampered')}`)}>Tampered link</button> <small>Wrong signature</small></li>
          </ul>
        </section>
      )} />
    </div>
  );
}

// Fills a copy variant's template (lead-in or line) and marks each value as dynamic data, whatever the wording.
const DYN_SRC = {
  type: 'CMCS: certificate type (names from app setting certificate.typesPerProgram)',
  certified: 'CMCS / CES (FAES): certification date',
  expiry: 'CMCS / CES (FAES): expiry date',
  offenceDate: 'Signed link: d',
};
// New against the legacy sentence (which had only the certification date): the certificate type, the expiry date and, in
// variant A, the offence date.
const NEW_IN_TEMPLATE = new Set(['type', 'expiry', 'offenceDate']);
function renderTemplate(tpl, vals) {
  return fillTemplate(tpl, vals, (name, value, key) => (value === null || value === undefined || value === false ? '' : <Dyn key={key} src={DYN_SRC[name]} isNew={NEW_IN_TEMPLATE.has(name)}>{value}</Dyn>));
}
