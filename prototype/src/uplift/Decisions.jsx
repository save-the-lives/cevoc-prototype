import { Link } from '../shared/ui.jsx';

// Hub page: architecture decisions raised by the uplift (owner, 25 Nov 2026). Proposed until confirmed.
const OPTIONS = [
  {
    name: 'A. Program rules as app settings read by the page',
    how: 'Per program, app settings list which certificate types apply and show, on what cycle, and which wins when several are in force; another app setting turns each program on or off on the page. The React page reads them and applies the rules itself.',
    newProgram: 'Add the program’s settings and switch it on. No code change if the new program fits the existing rule shapes; a code change on the page (and in every other consumer, e.g. Service NSW, Revenue NSW) if it needs a new kind of rule.',
    pros: ['Visible and editable without a release', 'Simple backend'],
    cons: ['Rule logic is duplicated in every front end that shows certificates', 'Each consumer must be updated for a new rule shape', 'Easy for the page and the API to disagree'],
  },
  {
    name: 'B. Decoupled: the API decides, the page only displays',
    how: 'The Java backend holds the per-program rules (as app settings on the server side) and returns, for a site and date range or a signed link, exactly what to show: certificates in force, which one counts, labels and the program’s template. The React page has no program knowledge.',
    newProgram: 'Add the program’s rules and template in the backend’s app settings and switch it on. The page and every other consumer pick it up with no change; only a genuinely new rule shape needs backend code, in one place.',
    pros: ['One source of truth for every consumer (CEVOC page, later Transport facelift, Service NSW, Revenue NSW)', 'Adding a program costs no page maintenance', 'Rules are tested once, in the backend'],
    cons: ['API responses are richer (display-ready)', 'Rule changes need backend settings access'],
  },
];

export default function Decisions() {
  return (
    <>
      <article className="uh-card ad">
        <p className="uh-meta"><span className="uh-tag is-open">Proposed · Confirmation required</span> Raised from <Link to="/uplift/hub/questions?q=U16">U16</Link>; related <Link to="/uplift/hub/questions?q=U5">U5</Link>, <Link to="/uplift/hub/questions?q=U36">U36</Link>, <Link to="/uplift/hub/stories?s=S21">S21</Link></p>
        <h2 className="uh-h2">AD-1: Where the rules for each camera program live</h2>
        <p><strong>Context.</strong> Each enforcement program (red light speed, fixed speed, average speed, mobile phone detection, and any added later) may need different certificate types, cycles and wording. The design must scale when a new program is added, without reworking the page each time.</p>
        <div className="ad-opts">
          {OPTIONS.map((o) => (
            <section key={o.name} className="ad-opt">
              <h3>{o.name}</h3>
              <p>{o.how}</p>
              <p><strong>Cost of adding a new program:</strong> {o.newProgram}</p>
              <p><strong>For</strong></p><ul>{o.pros.map((x) => <li key={x}>{x}</li>)}</ul>
              <p><strong>Against</strong></p><ul>{o.cons.map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
          ))}
        </div>
        <p><strong>Proposed decision: B.</strong> The rules are app settings, but held and applied by the backend, which returns display-ready results; an app setting per program turns it on or off. Justification: several front ends will show the same certificates (this page, the later Transport facelift, and possibly Service NSW and Revenue NSW, U7 and U37), so the rules must live in one place; a new program then costs no page maintenance.</p>
        <p className="uh-meta">To confirm with the product owner and enterprise architecture.</p>
      </article>
    </>
  );
}
