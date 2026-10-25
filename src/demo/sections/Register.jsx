import { useMemo, useState } from 'react';
import { REGISTER } from '../register.js';

const STATUSES = ['All', 'Confirmed requirement', 'Assumption to validate', 'Proposed UX improvement', 'Out of scope'];
const COLOUR = { 'Confirmed requirement': '#86efac', 'Assumption to validate': '#fca5a5', 'Proposed UX improvement': '#fcd34d', 'Out of scope': '#cbd5e1' };

// The business validation register: every assumption the prototype makes, who can settle it, and what it changes.
export default function Register() {
  const [f, setF] = useState('All');
  const rows = useMemo(() => REGISTER.filter((r) => f === 'All' || r.status === f), [f]);
  return (
    <>
      <h1>Business validation register</h1>
      <p className="demo-lede">Every assumption this prototype makes, who can settle it, and what it changes. Nothing is promoted to a requirement without an owner. All people, notices and certificates are fictitious, and no agency system is connected.</p>
      <div className="seg2" role="group" aria-label="Filter by status">
        {STATUSES.map((s) => <button key={s} type="button" aria-pressed={f === s} onClick={() => setF(s)}>{s}{s !== 'All' ? ` (${REGISTER.filter((r) => r.status === s).length})` : ` (${REGISTER.length})`}</button>)}
      </div>
      <div className="demo-tablewrap">
        <table className="demo-table">
          <thead><tr><th>#</th><th>Topic and question</th><th>Current understanding</th><th>Evidence or source</th><th>Business owner</th><th>Status</th><th>Decision or outstanding action</th><th>Impact on UX or build</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td>{r.id}</td><td><strong>{r.topic}</strong><br />{r.q}</td><td>{r.now}</td><td>{r.source}</td><td>{r.owner}</td>
              <td><strong style={{ color: COLOUR[r.status] }}>{r.status}</strong></td><td>{r.action}</td><td>{r.impact}</td></tr>))}</tbody>
        </table>
      </div>
    </>
  );
}
