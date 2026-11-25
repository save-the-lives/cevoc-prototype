import { Link } from '../shared/ui.jsx';
import { StatusTag } from './Search.jsx';

// Hub page: certificate lifecycle status behaviour (U22, owner 25 Nov 2026). Statuses come from CMCS, the source
// of truth. Owner's rule: an unapproved certificate is never displayed. The rest is proposed, to be confirmed.
const RULES = [
  ['Unapproved (issued, not approved) / draft', 'No', 'Treated as “no certificate yet”. Owner’s rule.', null],
  ['Approved / current', 'Yes', 'Shown normally.', { status: 'Published', certified: '01/09/2026', expiry: '01/09/2027' }],
  ['Expired (valid on the offence date)', 'Yes', 'Shown normally for offences inside its period.', { status: 'Published', certified: '01/09/2024', expiry: '01/09/2025' }],
  ['Withdrawn', 'Proposed: yes, if it covered the offence date', 'Shown with a Withdrawn tag and the date, so the record is transparent; does not count as in force.', { status: 'Withdrawn', withdrawn: '12/12/2025', certified: '01/12/2025', expiry: '28/02/2026' }],
  ['Re-issued', 'Yes', 'The replacement shows with a Re-issued marker (BRD BR_09); the original shows as withdrawn.', { status: 'Published', reissueOf: 'x', certified: '15/12/2025', expiry: '28/02/2026' }],
  ['Cancelled', 'Proposed: no', 'Not shown; logged as a data error.', null],
  ['Duplicate', 'One row', 'Collapsed to one row by the grouping key (U4) and flagged as a data error.', 'dup'],
];
const MOCK = [
  { id: 'm1', period: 'YEARLY', certified: '01/09/2026', expiry: '01/09/2027', status: 'Published' },
  { id: 'm2', period: 'QUARTERLY', certified: '01/09/2024', expiry: '30/11/2024', status: 'Published' },
  { id: 'm3', period: 'QUARTERLY', certified: '01/12/2025', expiry: '28/02/2026', status: 'Withdrawn', withdrawn: '12/12/2025' },
  { id: 'm4', period: 'QUARTERLY', certified: '15/12/2025', expiry: '28/02/2026', status: 'Published', reissueOf: 'm3' },
  { id: 'm5', period: 'YEARLY', certified: '12/08/2025', expiry: '12/08/2026', status: 'Published', duplicates: 1 },
];

export default function Lifecycle() {
  return (
    <>
      <p>Statuses come from CMCS, the source of truth. Owner’s rule: <strong>an unapproved certificate is never displayed.</strong> The rest is proposed, to be confirmed (<Link to="/uplift/hub/questions?q=U22">U22</Link>; see also <Link to="/uplift/hub/questions?q=U2">U2</Link> visibility and <Link to="/uplift/hub/questions?q=U4">U4</Link> duplicates). Each rule is an app setting (<code>certificate.statusRules</code>). Next step: ask CMCS for the full list of lifecycle statuses and their meanings.</p>
      <h2 className="uh-h2">Behaviour by status</h2>
      <div className="up-scroll">
        <table className="uh-tbl">
          <thead><tr><th>Status</th><th>Shown?</th><th>How</th><th>Tag</th></tr></thead>
          <tbody>{RULES.map(([s, shown, how, ex]) => (
            <tr key={s}><td><strong>{s}</strong></td><td>{shown}</td><td>{how}</td>
              <td>{ex === 'dup' ? <span className="st-tag is-error">Data error: duplicate ×2</span> : ex ? <StatusTag r={ex} /> : '—'}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <h2 className="uh-h2">How it looks in the search results (invented data)</h2>
      <p className="uh-meta">One row per status. Status is always text plus colour, never colour alone.</p>
      <div className="up-scroll">
        <table className="up-table uh-table">
          <thead><tr><th>Location</th><th>Certificate</th><th>Certification cycle</th><th>Certified on</th><th>Expires on</th></tr></thead>
          <tbody>{MOCK.map((r) => (
            <tr key={r.id}><td>1234</td><td>Approved Traffic Enforcement Device<StatusTag r={r} />{r.duplicates > 0 && <span className="st-tag is-error">Data error: duplicate ×{r.duplicates + 1}</span>}</td><td>{r.period}</td><td>{r.certified}</td><td>{r.expiry}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="uh-meta">“Current” and “Expired” are worked out against today; a certificate that has expired still counts for offences inside its period. Try it live: <Link to="/uplift?locs=1234,4567&from=01%2F11%2F2025&to=30%2F06%2F2026&run=1">search with withdrawn, re-issued and duplicate rows ↗</Link></p>
    </>
  );
}
