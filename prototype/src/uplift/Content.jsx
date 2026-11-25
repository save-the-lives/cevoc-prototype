import { Link } from '../shared/ui.jsx';
import { ENTRY_LINK } from './data.js';
import { COPY, COPY_KEYS, DYNAMIC, STATIC } from './tour.js';

// Hub page: the end-user certificate page split into dynamic data (with its source) and static copy, plus the
// copy variants to test, each written for one worry. Rendered inside the hub Shell.
export default function Content() {
  const sample = (k) => COPY[k].cert('2 March 2026', '14 March 2026');
  return (
    <>
      <p><Link to={`${ENTRY_LINK}&tour=1`} className="uh-btnlink">Open the page with the tour on ↗</Link> Switch on “Highlight dynamic data” in the tour to see each value outlined with its source.</p>
      <h2 className="uh-h2">Dynamic data</h2>
      <div className="up-scroll">
        <table className="uh-tbl">
          <thead><tr><th>Field</th><th>Where it comes from</th><th>Owner of the data</th></tr></thead>
          <tbody>{DYNAMIC.map(([f, s, o]) => <tr key={f}><td><strong>{f}</strong></td><td>{s}</td><td>{o}</td></tr>)}</tbody>
        </table>
      </div>
      <h2 className="uh-h2">Static copy</h2>
      <div className="up-scroll">
        <table className="uh-tbl">
          <thead><tr><th>Block</th><th>What it says</th></tr></thead>
          <tbody>{STATIC.map(([b, w]) => <tr key={b}><td><strong>{b}</strong></td><td>{w}</td></tr>)}</tbody>
        </table>
      </div>
      <h2 className="uh-h2">Copy variants to test</h2>
      <p>Not decided. Each variant answers a different worry a person has when they open the page. The legacy wording stays the default for the lift and shift.</p>
      <div className="uh-tiles">
        {COPY_KEYS.map((k) => (
          <article key={k} className="uh-card">
            <h3>{COPY[k].label}</h3>
            <p className="uh-meta">{COPY[k].worry}</p>
            <p><strong>Certificate sentence:</strong> {sample(k)}</p>
            <p><strong>Requirements text:</strong></p>
            <ul>{COPY[k].req.map((r) => <li key={r}>{r}</li>)}</ul>
          </article>
        ))}
      </div>
    </>
  );
}
