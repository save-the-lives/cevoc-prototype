// What this prototype shows, and how firmly. "Proposed" items are shown for discussion and are not approved capabilities.
const ROWS = [
  ['Staff search across penalty notices, plates, reviews, cameras, certificates and requests', 'In scope (assumed)', 'Uses the notice, certificate and camera records CEVOC already holds. Needs a search API over those records.'],
  ['Role-based landing: doers land on search, managers on the dashboard', 'Proposed', 'Needs role and group claims from single sign-on (for example a manager group).'],
  ['Certificate check by camera location code and date range', 'Proposed', 'Needs certificate effective dates and withdrawal history from the certificate register, queryable by site and date.'],
  ['Revenue reviews and court elections in a work queue with decisions', 'Prototype stand-in', 'Revenue NSW already has its own case system. A real CEVOC would show evidence and validation and hand the case back, not replace that system.'],
  ['Technical request to Transport, with advice returned', 'Proposed', 'Needs agreed referral criteria, the data passed across, and who owns each step. Advice only: Revenue NSW decides the customer’s outcome.'],
  ['Acknowledge, investigate, advise lifecycle and time in state', 'Proposed (referral orchestration)', 'Needs a shared status model and event timestamps from both agencies.'],
  ['Response targets, “due soon”, overdue and escalation', 'Proposed (SLA-like)', 'Targets are internal and configurable here. They are not statutory. Needs policy owners to set them.'],
  ['Live event feed and notifications', 'Simulated', 'Needs an event channel between systems. Nothing is connected.'],
  ['Operational dashboards (counts, action lists)', 'Proposed', 'Only shows counts the underlying data can support. Measures like first-contact resolution are not captured today.'],
  ['Manager privileges (assign work to others, team workload)', 'Proposed', 'Needs roles defined by each agency.'],
  ['Opening a case from the agency’s own system, and returning', 'Simulated integration', 'Needs a deep-link contract and a return address from each system.'],
  ['Single sign-on', 'Simulated', 'Needs each agency’s identity provider and group mapping. No credentials are handled here.'],
  ['Decision reasons and a letter preview', 'Proposed (correspondence)', 'Customer correspondence is outside the approved scope. Shown only to illustrate a decision record.'],
  ['What Transport can see of the customer', 'Open decision', 'The technical workbench currently shows the customer’s stated concern and links to the Revenue case. A data-minimisation rule is needed.'],
];
const TONE = { 'In scope (assumed)': '#146b3a', Proposed: '#5a4300', 'Open decision': '#8c1129' };

export default function Capabilities() {
  return (
    <>
      <h1>Capability status</h1>
      <p className="demo-lede">What is in the prototype and how firmly. Anything marked Proposed or Simulated is for discussion and needs business approval. Nothing here is connected to a real agency system. All people, notices and certificates are fictitious.</p>
      <div className="demo-tablewrap">
        <table className="demo-table">
          <thead><tr><th>Capability</th><th>Status</th><th>What it would need</th></tr></thead>
          <tbody>{ROWS.map(([c, s, n]) => (
            <tr key={c}><td>{c}</td><td><strong style={{ color: TONE[s] || '#22272b' }}>{s}</strong></td><td>{n}</td></tr>))}</tbody>
        </table>
      </div>
    </>
  );
}
