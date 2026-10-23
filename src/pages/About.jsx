import React from 'react';
import { Link, Alert, Breadcrumbs } from '../components/ui.jsx';

const TRACE = [
  ['Public notice lookup, validation, offence summary', 'CAP-01 Public information access', '/notice'],
  ['Offence image gallery, viewer and download', 'CAP-01, CAP-06 Publication control', '/notice'],
  ['Withdrawn image / certificate states', 'CAP-06 Publication control', '/notice'],
  ['Camera search and camera details', 'CAP-04 Search and retrieval', '/cameras'],
  ['Certification on a date, history, gaps', 'CAP-04, CAP-05 Information classification', '/cameras/LIV-207'],
  ['Certificate view, print and download', 'CAP-01', '/certificates/CEV-PAR001-2026'],
  ['Mock federated sign-in, no local passwords', 'CAP-02 Authenticated access', '/officer'],
  ['Signed in but no role → access denied', 'CAP-03 Authorisation', '/officer'],
  ['Restricted fields and records for officers only', 'CAP-03, CAP-05', '/officer/search'],
  ['Officer withdraw / restore from public view', 'CAP-06, CAP-09 Administration', '/certificates/CEV-PAR001-2026'],
  ['Session audit log', 'CAP-07 Audit and traceability', '/officer/search'],
  ['Video placeholder behind a toggle', 'CAP-08 Media enablement (future, not approved)', '/notice'],
  ['Source-system outage and retry states', 'NFR-07 Resilience', '/notice'],
  ['Revenue NSW hand-off (simulated)', 'Integration point', '/notice'],
];

export default function About() {
  return (
    <div className="nsw-container cevoc-page">
      <Breadcrumbs items={[['Home', '/'], ['About this prototype', '/about']]} />
      <h1>About this prototype</h1>
      <Alert type="warning" title="Demonstration only">
        <p>All notices, cameras, certificates, people and images are fictitious. Nothing connects to Transport, Revenue NSW or identity systems. Sign-in, audit and withdrawal are simulated in your browser and reset on reload.</p>
      </Alert>
      <p>The prototype demonstrates the user journeys and behaviours in the CEVOC Solution Architecture Document. It doesn't show approved scope: video and wider media access are shown as future capabilities pending Legal, Prosecutions, privacy and security decisions.</p>

      <h2 className="cevoc-h2">What's demonstrated and why</h2>
      <div className="cevoc-table-wrap">
        <table className="nsw-table">
          <thead><tr><th>Behaviour</th><th>SAD capability / NFR</th><th>Try it</th></tr></thead>
          <tbody>
            {TRACE.map(([b, c, to]) => (
              <tr key={b}><td>{b}</td><td>{c}</td><td><Link to={to}>Open</Link></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="cevoc-h2">Not demonstrated</h2>
      <ul className="cevoc-list">
        <li>Real identity federation, network controls or API security</li>
        <li>Integration with source systems or Revenue NSW</li>
        <li>Performance, scalability and load behaviour</li>
        <li>Evidentiary handling, retention and records management</li>
        <li>Approved disclosure rules (still to be decided)</li>
      </ul>
    </div>
  );
}
