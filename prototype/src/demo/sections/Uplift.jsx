import { Link } from '../../shared/ui.jsx';
import { UPLIFT_COMPARE, UPLIFT_REGISTER, UPLIFT_SAMPLES, UPLIFT_STORIES, UPLIFT_USER_STORIES, upliftLink } from '../uplift.js';
import { Framing } from './Parts.jsx';
import Register from './Register.jsx';
import { UpliftJourney } from './Reference.jsx';

// Certificate uplift (phase 1) sections of the demo hub, in the same shape as the other scenarios and register.

export function UpliftScenarios() {
  return (
    <>
      <h1>Certificate uplift: scenarios</h1>
      <p className="demo-lede">Phase 1 lifts and shifts the legacy certificate search (Customer Enquiry and Verification of Certificate): same page, fields and results, new look. Each link opens the page with the search already run. Sample data only.</p>
      <div className="demo-try">
        <Link to="/uplift" className="demo-go">Open the uplift page ↗</Link>
        {UPLIFT_SAMPLES.map((s) => <Link key={s.label} to={upliftLink(s)} className="demo-go">{s.label} ({s.note}) ↗</Link>)}
      </div>
      <UpliftJourney />
      <h2>Scenarios</h2>
      <div className="demo-stories">
        {UPLIFT_STORIES.map((s) => (
          <article key={s.title} className="demo-story is-staff">
            <h3>{s.title}</h3>
            <p className="demo-who">{s.who}</p>
            <Framing context={s.context} pain={s.pain} job={s.job} />
            <ul className="demo-steps">{s.links.map(([t, to]) => <li key={t}><Link to={to}>{t} ↗</Link></li>)}</ul>
          </article>
        ))}
      </div>
    </>
  );
}

export function UpliftStories() {
  const ids = new Set(UPLIFT_REGISTER.filter((r) => r.status === 'Assumption to validate').map((r) => r.id));
  return (
    <>
      <h1>Certificate uplift: user stories</h1>
      <p className="demo-lede">A story is ready for dev only when it has acceptance criteria and no open question blocks it. Open questions are in the uplift register.</p>
      <div className="demo-tablewrap">
        <table className="demo-table">
          <thead><tr><th>#</th><th>Story</th><th>Acceptance criteria</th><th>Blocked by</th><th>Ready for dev</th><th>Source</th></tr></thead>
          <tbody>{UPLIFT_USER_STORIES.map((s) => {
            const open = s.blockers.filter((b) => ids.has(b));
            const ready = s.ac.length > 0 && open.length === 0;
            return (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td><strong>{s.title}</strong><br />{s.story}</td>
                <td>{s.ac.length ? <ul className="demo-steps">{s.ac.map((a) => <li key={a}>{a}</li>)}</ul> : <em>None yet</em>}</td>
                <td>{open.length ? open.join(', ') : '—'}</td>
                <td><strong style={{ color: ready ? '#86efac' : '#fca5a5' }}>{ready ? 'Ready' : 'Not ready'}</strong></td>
                <td>{s.source}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </>
  );
}

export function UpliftRegister() {
  return <Register rows={UPLIFT_REGISTER} title="Certificate uplift: open questions" lede="Every question the uplift raises, who can settle it, and what it changes. Sources include the owner’s screenshots of the legacy page and the CEVOC Enhancement BRD. All certificates in the prototype are fictitious." />;
}

export function UpliftCompare() {
  return (
    <>
      <h1>Certificate uplift: legacy and target</h1>
      <p className="demo-lede">What changes on each part of the page. For phase 1 most lines are “same function, new look”.</p>
      <div className="demo-try"><Link to={upliftLink(UPLIFT_SAMPLES[0])} className="demo-go">See the target page ↗</Link></div>
      <div className="demo-tablewrap">
        <table className="demo-table">
          <thead><tr><th>Part</th><th>Legacy today</th><th>Target (phase 1)</th><th>Change</th></tr></thead>
          <tbody>{UPLIFT_COMPARE.map(([p, a, b, c]) => <tr key={p}><td><strong>{p}</strong></td><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
