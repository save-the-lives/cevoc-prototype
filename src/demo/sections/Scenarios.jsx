import { Link } from '../../shared/ui.jsx';
import { SCENARIOS, PROGRAMS, notice as findNotice, site as findSite } from '../../data.js';
import { STAFF_STORIES } from '../content.js';
import { Framing } from './Parts.jsx';

export function PublicScenarios() {
  return (
    <>
      <h1>Public scenarios</h1>
      <p className="demo-lede">One per camera program, each framed as context, pain and job to be done.</p>
      <div className="demo-stories">
        {SCENARIOS.map((s) => {
          const n = findNotice(s.notice);
          const prog = PROGRAMS[findSite(n.site).program];
          return (
            <article key={s.notice} className="demo-story">
              <p className="demo-prog">{prog.label}{s.hasVideo ? <span className="demo-pill">▶ video</span> : null}{s.issue ? <span className="demo-pill is-warn">issue</span> : null}</p>
              <h3>{s.title}</h3>
              <p className="demo-who">{s.persona}</p>
              <Framing context={s.context} pain={s.pain} job={s.job} />
              {s.issue && <p className="demo-issue">{s.issue}</p>}
              <Link to={`/notice/${n.number}`} className="demo-go">Open as the public ↗</Link>
            </article>
          );
        })}
      </div>
    </>
  );
}

export function StaffScenarios() {
  return (
    <>
      <h1>Staff scenarios</h1>
      <p className="demo-lede">Each opens the workspace already signed in as the right person.</p>
      <div className="demo-stories">
        {STAFF_STORIES.map((s) => (
          <article key={s.title} className="demo-story is-staff">
            <h3>{s.title}</h3>
            <p className="demo-who">{s.who}</p>
            <Framing context={s.context} pain={s.pain} job={s.job} />
            <ul className="demo-steps">{s.links.map(([t, to]) => <li key={to}><Link to={to}>{t} ↗</Link></li>)}</ul>
          </article>
        ))}
      </div>
    </>
  );
}
