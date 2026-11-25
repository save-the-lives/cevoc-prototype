import { useEffect } from 'react';
import { Header, HeaderBrand, Masthead } from '@nswds/ui';
import { ROWS, parse, parseDay } from './Uplift.jsx';

// PHASE 1 UPLIFT MOCK-UP (#/uplift/record): the certificate record view. One view, two ways in, no login for either:
//   end user:  ?loc=&at=DD/MM/YYYY HH:MM  -> only the certificate(s) in force at that moment (from the link on a notice)
//   Revenue:   ?loc=&id=                   -> one row opened from the multi-record search
// Details the BRD asks for (BR_01) are shown as placeholders until CMCS sample data arrives (open question U3).
// Sample data only.

const PENDING = ['Device model', 'Gazette reference', 'Approved for', 'Location', 'Inspection date and time', 'Inspection details'];

function Card({ r, loc }) {
  return (
    <article className="up-card">
      <h2>{r.desc}</h2>
      <dl>
        <dt>Certificate type</dt><dd>{r.type}</dd>
        <dt>Period</dt><dd>{r.period}</dd>
        <dt>Certified date</dt><dd>{r.certified}</dd>
        <dt>Expiry date</dt><dd>{r.expiry}</dd>
        <dt>Location code</dt><dd>{loc}</dd>
        {PENDING.map((k) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd className="is-pending">Awaiting CMCS sample data (U3)</dd></div>)}
      </dl>
    </article>
  );
}

export default function UpliftRecord({ query = {} }) {
  const loc = (query.loc || '').trim();
  const at = query.at ? parse(query.at) : null;
  const one = query.id !== undefined ? ROWS.find((r) => String(r.id) === String(query.id)) : null;
  const endUser = !!query.at;
  const rows = loc === '0000' ? [] : endUser ? (at ? ROWS.filter((r) => parseDay(r.certified) <= at && parseDay(r.expiry) >= at) : []) : one ? [one] : [];
  useEffect(() => { document.title = 'Certificate record | Customer Enquiry and Verification of Certificate (uplift mock-up)'; }, []);

  return (
    <div className="pub up">
      <div role="region" aria-label="NSW Government"><Masthead container="contained" /></div>
      <Header color="white" border container="contained">
        <HeaderBrand href="#/uplift" sitename="Customer Enquiry and Verification of Certificate" />
      </Header>
      <div className="up-flag"><div className="pub-wrap">Uplift mock-up · certificate record view, no login · sample data <span className="up-proposed">Proposed (U6)</span></div></div>
      <main id="up-main" tabIndex={-1} className="pub-wrap pub-page up-page">
        {endUser ? (
          <>
            <h1>Camera certificate for your offence</h1>
            <p className="up-ctx">Location code <strong>{loc || '—'}</strong> at <strong>{query.at}</strong>. These are the certificates that were in force at that time.</p>
          </>
        ) : (
          <>
            <p className="pub-crumb"><a href="#/uplift" onClick={(e) => { e.preventDefault(); window.history.back(); }}>← Back to search results</a></p>
            <h1>Certificate record</h1>
            <p className="up-ctx">Location code <strong>{loc || '—'}</strong>. Opened from the search results.</p>
          </>
        )}
        {rows.length > 0 ? (
          <>
            {endUser && rows.length > 1 && <p className="up-note">{rows.length} certificates applied at that time. Which one counts for an offence is an open question (U5).</p>}
            <div className="up-cards">{rows.map((r) => <Card key={r.id} r={r} loc={loc} />)}</div>
          </>
        ) : (
          <p role="status" className="up-ctx">No records found.</p>
        )}
        <p className="up-foot">The same view serves both: a person with a notice gets only the record for their offence; Revenue staff open any row from the search list. Neither needs a login. No download, save or print. See the <a href="#/demo/uplift-scenarios">demo hub</a> for stories and open questions.</p>
      </main>
    </div>
  );
}
