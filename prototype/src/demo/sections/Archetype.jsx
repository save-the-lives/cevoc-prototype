import { Link } from '../../shared/ui.jsx';
import { SCENARIOS, PROGRAMS, notice as findNotice, site as findSite } from '../../data.js';
import { Badge, Framing, PathPicture, Try } from './Parts.jsx';

export default function Archetype({ a }) {
  const scenarios = SCENARIOS.filter((s) => a.notices.includes(s.notice));
  return (
    <>
      <p className="demo-tag">User kind</p>
      <h1>{a.name}</h1>
      <p className="demo-lede">{a.who}</p>

      <h2>Their journey</h2>
      <PathPicture steps={a.steps} />
      <div className="demo-legend"><span className="is-person">The person</span><span className="is-ext">Existing service</span><span className="is-ours">CEVOC</span><span className="is-out">Hand-off</span></div>

      <h2>What they need</h2>
      <Framing pain={a.pain} job={a.job} />

      <h2>Ways in</h2>
      <div className="demo-doors">
        {a.doors.map((d) => (
          <article key={d.name} className="demo-door">
            <strong>{d.name}</strong>
            <span>Lands on: {d.lands}</span>
            <small><Badge v={d.verified} /> {d.owner} · {d.note}</small>
          </article>
        ))}
      </div>

      {scenarios.length > 0 && (
        <>
          <h2>Scenarios for this user</h2>
          <div className="demo-stories">
            {scenarios.map((s) => {
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
      )}
      <Try links={a.try} />
    </>
  );
}
