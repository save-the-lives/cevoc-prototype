import { Link } from '../shared/ui.jsx';
import { ENTRY_LINK, OFFENCES, SOURCES } from './data.js';

// Worked example of the signed link both apps open (U15, U29, U30), with invented values only.
const O = OFFENCES[0];
const ROWS = [
  ['p', O.p, 'Penalty notice number', 'Known'],
  ['d', O.d, 'Offence date and time, yyyymmddThhmmss (here 14 March 2026, 08:30)', 'Known'],
  ['s', O.s, 'Site, zone or camera number', 'Known'],
  ['i', O.i, 'Unknown; assumed to be an index or version', 'Open (U29)'],
  ['r', O.r, `Proposed: source code for the Return link (${Object.entries(SOURCES).map(([k, v]) => `${k} = ${v.name}`).join(', ')})`, 'Proposed (U9)'],
  ['m', '0000demo0signature0not0real0000', 'Signature over the other values; any change shows the wrong-link message. Checked on the Java backend in the target stack.', 'Open (U30)'],
];

export default function SignedLink() {
  const example = `#${ENTRY_LINK}`;
  return (
    <section id="signed-link" className="uh-card sl">
      <h2 className="uh-h2">Signed link: worked example</h2>
      <p>Both apps open the same CEVOC page with a signed link. Today’s shape is <code>certificateDetails.jsf?p=&amp;d=&amp;s=&amp;i=&amp;m=</code>; in the prototype (invented values):</p>
      <p className="sl-url"><code>{example}</code></p>
      <div className="up-scroll">
        <table className="uh-tbl">
          <thead><tr><th>Parameter</th><th>Example value</th><th>Meaning</th><th>Status</th></tr></thead>
          <tbody>{ROWS.map(([k, v, m, st]) => <tr key={k}><td><code>{k}</code></td><td><code>{v}</code></td><td>{m}</td><td>{st}</td></tr>)}</tbody>
        </table>
      </div>
      <p><Link to={ENTRY_LINK}>Open this link in the live demo ↗</Link> · <Link to={ENTRY_LINK.replace(/m=[^&]+/, 'm=changed')}>Same link with a changed signature ↗</Link> · <Link to="/uplift/hub/questions?q=U29">U29</Link> · <Link to="/uplift/hub/questions?q=U30">U30</Link> · <Link to="/uplift/hub/questions?q=U15">U15</Link></p>
    </section>
  );
}
