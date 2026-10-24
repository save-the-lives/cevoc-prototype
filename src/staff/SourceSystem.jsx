import { CASES, notice as findNotice, staff as findStaff } from '../data.js';
import { Link } from '../shared/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { CASE_STATE, caseState } from '../lib/workflow.js';
import { useRoute } from '../lib/router.js';

// A stand-in for the agency's existing case system, so the prototype can show a person arriving in CEVOC from it
// with the reference already known, and returning. It is NOT a real integration and says so on the page.
const refOf = (id) => `RCM-${558000 + Number(id.replace(/\D/g, '').slice(-3))}`;

export default function SourceSystem() {
  const { state } = useStore();
  const { query } = useRoute();
  const rows = CASES.filter((c) => c.type === 'review' || c.type === 'court');
  return (
    <main className="src" id="main">
      <p className="src-banner" role="note"><strong>Prototype stand-in.</strong> This page imitates an existing Revenue NSW case management system. No real system is connected.</p>
      <h1>Revenue NSW case management <small>(simulated)</small></h1>
      <p>Open a case in CEVOC to see its camera evidence and validation. Come back with the link on the CEVOC page.</p>
      <div className="src-wrap"><table className="src-table">
        <thead><tr><th>Reference</th><th>Case</th><th>Customer</th><th>Officer</th><th>Status here</th><th>CEVOC status</th><th><span className="sr-only">Open</span></th></tr></thead>
        <tbody>
          {rows.map((c) => {
            const n = findNotice(c.notice);
            const a = c.id in state.assign ? state.assign[c.id] : c.assignee;
            const st = caseState(c.id, state, a);
            const as = a && findStaff(a)?.agency === 'rnsw' ? a : 'alex';
            return (
              <tr key={c.id} className={query.case === c.id ? 'is-hit' : ''}>
                <td>{refOf(c.id)}</td><td>{c.id}</td><td>{n.holder}</td><td>{a ? findStaff(a).name : 'Unassigned'}</td>
                <td>{state.decisions[c.id] ? 'Outcome received from CEVOC' : 'Under review'}</td>
                <td>{CASE_STATE[st].label}</td>
                <td><Link to={`/staff/case/${c.id}?from=external&src=revenue&ref=${refOf(c.id)}&as=${as}`}>Open in CEVOC ↗</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      <p><Link to="/demo">Back to the demo hub</Link></p>
    </main>
  );
}
