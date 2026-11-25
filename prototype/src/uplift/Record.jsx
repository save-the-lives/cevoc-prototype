import { useEffect, useState } from 'react';
import { Button, Callout, Header, HeaderBrand, Masthead } from '@nswds/ui';
import { CERTIFICATES, FAULT_CODES, RECORD_SAMPLES, certificatesAt, fmtDay, locByCode, parseDay, recordLink } from './data.js';
import { ProtoBar, Q, StoriesBar, useLabels } from './kit.jsx';
import { Details } from './Search.jsx';
import { go } from '../lib/router.js';

// PHASE 1 UPLIFT (#/uplift/record): what a person reaches from the link on their notice in the Service NSW app or
// myPenalty. No login. Only the certificates in force on the offence day; a withdrawn certificate is shown as
// withdrawn; a genuinely missing certificate and a system fault each have their own message (U22 to U24).
// ?loc=&at=dd/mm/yyyy (end user), or ?loc=&id= (one certificate opened directly).

function Card({ r, L }) {
  return (
    <article className={`up-card${r.status === 'Withdrawn' ? ' is-withdrawn' : ''}`}>
      <h2>{r.desc}{r.status === 'Withdrawn' && <span className="uh-tag is-warn">Withdrawn</span>}{r.reissueOf && <span className="uh-tag">Re-issued</span>}</h2>
      <dl>
        <dt>{L.type}</dt><dd>{r.type}</dd>
        <dt>{L.period}</dt><dd>{r.period}</dd>
        <dt>{L.certified}</dt><dd>{r.certified}</dd>
        <dt>{L.expiry}</dt><dd>{r.expiry}</dd>
      </dl>
      <Details r={r} />
    </article>
  );
}

export default function Record({ query = {} }) {
  const { L } = useLabels();
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => { document.title = 'Camera certificate for your offence (uplift prototype)'; }, []);
  const code = (query.loc || '').trim();
  const loc = locByCode(code);
  const day = parseDay((query.at || '').split(' ')[0]);
  const one = query.id ? CERTIFICATES.find((x) => x.id === query.id) : null;
  const retry = () => { setLoading(true); setTimeout(() => { setLoading(false); setNonce(nonce + 1); }, 600); };

  let body;
  if (loading) body = <p role="status">Checking again…</p>;
  else if (FAULT_CODES.has(code)) {
    body = (
      <Callout status="danger" title="We couldn’t get the certificate right now" role="alert">
        <p>This is a problem with our system. It does not mean the camera had no certificate. Please try again later.</p>
        <Button type="button" variant="outline" onClick={retry}>Try again</Button> <Q id="U24" />
      </Callout>
    );
  } else if (!loc || (!day && !one)) {
    body = (
      <Callout status="info" title="We couldn’t match this link to a camera">
        <p>The link may be incomplete or out of date. Open your notice again in the Service NSW app or myPenalty and use the link there, or contact Revenue NSW.</p>
        <Q id="U15" />
      </Callout>
    );
  } else if (one) {
    body = <div className="up-cards"><Card r={one} L={L} /></div>;
  } else {
    const { inForce, withdrawn, missing } = certificatesAt(code, day);
    body = (
      <>
        {missing.length > 0 && (
          <Callout status="warning" title={`No ${missing.map((m) => m.toLowerCase()).join(' or ')} certificate was in force on ${fmtDay(day)}`}>
            <p>Our records show a gap for this camera on that day. This is not a system problem. If this matters to your decision, contact Revenue NSW customer enquiries before you choose what to do.</p>
            <Q id="U23" /> <Q id="U16" />
          </Callout>
        )}
        {withdrawn.length > 0 && (
          <Callout status="info" title="A certificate covering this day was withdrawn">
            <p>It is shown below, marked Withdrawn. It does not count as in force. <Q id="U22" /></p>
          </Callout>
        )}
        {inForce.length > 1 && <p className="up-note">{inForce.length} certificates were in force that day. <Q id="U5" /></p>}
        <div className="up-cards">{[...inForce, ...withdrawn].map((r) => <Card key={r.id} r={r} L={L} />)}</div>
      </>
    );
  }

  return (
    <div className="pub up uh" key={nonce}>
      <div role="region" aria-label="NSW Government"><Masthead container="contained" /></div>
      <Header color="white" border container="contained"><HeaderBrand href="#/uplift" sitename="Customer Enquiry and Verification of Certificate" /></Header>
      <ProtoBar>
        <label className="uh-pick">Sample link{' '}
          <select value="" onChange={(e) => e.target.value && go(e.target.value)}>
            <option value="">Choose…</option>
            {RECORD_SAMPLES.map((s) => <option key={s.label} value={recordLink(s)}>{s.label}</option>)}
          </select>
        </label>
      </ProtoBar>
      <main id="up-main" tabIndex={-1} className="pub-wrap pub-page up-page">
        <h1>{one ? 'Certificate' : 'Camera certificate for your offence'}</h1>
        {loc && (
          <p className="up-ctx">
            Camera at <strong>{loc.address}</strong> (location {loc.code}){day && !one ? <> on <strong>{fmtDay(day)}</strong></> : null}.
            {!one && ' Only the certificates for that day are shown.'} <Q id="U14" />
          </p>
        )}
        {body}
        <p className="up-foot">No download, save or print. <Q id="U1" /> Disclaimer to come from Legal. <Q id="U8" /> Explanatory text to come. <Q id="U13" /></p>
        <p className="up-foot">When you are ready, go back to the Service NSW app or myPenalty to pay, request a review or elect to go to court.</p>
      </main>
      <StoriesBar screen="record" />
    </div>
  );
}
