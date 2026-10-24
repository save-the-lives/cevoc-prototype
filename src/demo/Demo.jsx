import { Link } from '../shared/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { SCENARIOS, PROGRAMS, notice as findNotice, site as findSite } from '../data.js';
import { FORCEABLE } from '../lib/faults.js';

// DEMO HUB: the only place for scenarios, context/pain/job framing, controls and open questions.

const STAFF_STORIES = [
  {
    title: 'Revenue NSW review, evidence first',
    who: 'Alex, Revenue NSW review officer',
    context: 'Thomas has disputed a red-light fine. Alex arrives from the Revenue NSW case system, already signed in.',
    pain: 'Hunting through systems and emailing Transport for footage.',
    job: 'When a review lands, I want the evidence and its validity on one screen, so I can decide and explain it quickly.',
    links: [['Open the review', '/staff/case/RV-24017?from=app&as=alex']],
  },
  {
    title: 'Transport adds technical advice',
    who: 'Jo, Transport camera operations',
    context: 'Same screen as Revenue NSW. Jo can’t decide the case but can add technical advice.',
    pain: 'Being pulled into reviews that good evidence should have answered.',
    job: 'When I’m asked about a camera, I want to see the scorecard straight away, so I only step in when something is genuinely wrong.',
    links: [['Open the review as Jo', '/staff/case/RV-24017?from=app&as=jo']],
  },
  {
    title: 'Withdrawing a bad certificate',
    who: 'Jo requests, Morgan approves',
    context: 'A calibration fault is found at Granville after a certificate was issued.',
    pain: 'One wrong certificate can undermine every fine that relies on it.',
    job: 'When a certificate is wrong, I want to see exactly what it affects and have it checked by a second person, so nothing is withdrawn by accident.',
    links: [
      ['1. Jo requests the withdrawal', '/staff/cert/S138-PAR001-0830?from=app&as=jo'],
      ['2. Morgan approves it', '/staff/queue/approvals?from=app&as=morgan'],
      ['3. See Mia’s public page change', '/notice/3162457890'],
    ],
  },
];

const QUESTIONS = [
  ['Who owns the combined public page: Transport, Revenue NSW or Service NSW?', 'Revenue NSW, Transport'],
  ['Should the public see incident images and video here, or only in myPenalty?', 'Revenue NSW, Legal, Privacy'],
  ['Does CEVOC own certificate withdrawal, or only reflect a status set in the source system?', 'Transport, Legal'],
  ['How does a deep link from MyServiceNSW carry the notice securely?', 'Cyber, Service NSW'],
  ['Which identity platforms apply for Revenue NSW staff, and is federation acceptable?', 'Identity, Cyber'],
  ['Is notice number + date of offence enough to show images to the public?', 'Privacy, Revenue NSW'],
];

function Framing({ context, pain, job }) {
  return (
    <dl className="frame">
      <div><dt>Context</dt><dd>{context}</dd></div>
      <div><dt>Pain</dt><dd>{pain}</dd></div>
      <div><dt>Job to be done</dt><dd>{job}</dd></div>
    </dl>
  );
}

export default function Demo() {
  const { state, dispatch } = useStore();
  const forced = Object.entries(state.force).filter(([, v]) => v).length;
  return (
    <div className="demo">
      <div className="demo-in">
        <p className="demo-tag">CEVOC prototype · demo hub</p>
        <h1>Two experiences, kept apart</h1>
        <p className="demo-lede">One for the person who received the notice. One for the Transport and Revenue NSW staff behind it. This hub is the only place the demo scaffolding lives.</p>

        <div className="demo-zones">
          <Link to="/" className="demo-zone is-pub">
            <strong>Public site</strong>
            <span>Calm and plain. No login. Five questions in the order people ask them, then a single hand-off to Revenue NSW.</span>
            <em>Open ↗</em>
          </Link>
          <Link to="/staff" className="demo-zone is-staff">
            <strong>Staff workspace</strong>
            <span>Same screen for Transport and Revenue NSW. Evidence first, scorecard on top, role decides the actions.</span>
            <em>Open ↗</em>
          </Link>
        </div>

        <section className="demo-run">
          <div>
            <h2>Run mode</h2>
            <p className="demo-muted">Clean for first walkthroughs. Realistic adds the occasional slow file, failed load or missing video, mostly none or one at a time.</p>
          </div>
          <div className="demo-seg" role="radiogroup" aria-label="Run mode">
            {['clean', 'realistic'].map((m) => (
              <button key={m} type="button" role="radio" aria-checked={state.mode === m} className={state.mode === m ? 'on' : ''} onClick={() => dispatch({ type: 'mode', mode: m })}>
                {m === 'clean' ? 'Clean' : 'Realistic'}
              </button>
            ))}
          </div>
          {state.mode === 'realistic' && (
            <div className="demo-seed">
              <label>Seed <input value={state.seed} onChange={(e) => dispatch({ type: 'seed', seed: e.target.value })} /></label>
              <button type="button" onClick={() => dispatch({ type: 'reshuffle' })}>Reshuffle</button>
              <span className="demo-muted">Same seed = same failures, for rehearsals.</span>
            </div>
          )}
          <details className="demo-force" open={forced > 0}>
            <summary>Force a specific failure {forced ? `(${forced} on)` : ''}</summary>
            <div className="demo-force__grid">
              {FORCEABLE.map(([k, l]) => (
                <label key={k}><input type="checkbox" checked={!!state.force[k]} onChange={(e) => dispatch({ type: 'force', key: k, on: e.target.checked })} /> {l}</label>
              ))}
            </div>
          </details>
        </section>

        <h2>Public scenarios: one per camera program</h2>
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

        <h2>Staff scenarios</h2>
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

        <h2>Journey</h2>
        <div className="demo-arc">
          {[
            ['Letter arrives', 'Weeks later. Confused, maybe angry.', -2],
            ['Finds the notice', 'From MyServiceNSW, myPenalty, or two details.', -1],
            ['Sees what happened', 'Time, place, plate. “OK, that’s my car.”', 0],
            ['Checks it’s fair', 'Measurement and certificates in plain words.', 1],
            ['Decides', 'Options with Revenue NSW, no pressure.', 1],
          ].map(([t, d, mood], i) => (
            <div key={t} className={`demo-arc__step mood-${mood < 0 ? 'neg' : mood > 0 ? 'pos' : 'neu'}`}>
              <span>{i + 1}</span><strong>{t}</strong><small>{d}</small>
            </div>
          ))}
        </div>

        <h2>How people get here</h2>
        <div className="demo-flow">
          <div className="demo-box ext">MyServiceNSW · myPenalty · Service NSW app<small>Existing services</small></div>
          <span>→ deep link →</span>
          <div className="demo-box ours">CEVOC public page<small>Notice already identified</small></div>
          <span>→</span>
          <div className="demo-box ext">Revenue NSW<small>Pay · review · nominate · court</small></div>
        </div>
        <div className="demo-flow">
          <div className="demo-box ext">Revenue NSW and Transport case systems<small>Existing</small></div>
          <span>→ trusted SSO →</span>
          <div className="demo-box ours">CEVOC staff workspace<small>No second login</small></div>
        </div>

        <h2>Open questions</h2>
        <table className="demo-table">
          <thead><tr><th>Question</th><th>Who decides</th></tr></thead>
          <tbody>{QUESTIONS.map(([q, w]) => <tr key={q}><td>{q}</td><td>{w}</td></tr>)}</tbody>
        </table>

        <div className="demo-foot">
          <button type="button" onClick={() => dispatch({ type: 'reset' })}>Reset all demo data</button>
          <span className="demo-muted">{state.pending.length} pending · {Object.keys(state.certStatus).length} certificate changes · {Object.keys(state.decisions).length} decisions</span>
        </div>
        <p className="demo-muted">All people, notices, images, videos and certificates are fictitious. Sign-in, the Revenue NSW hand-off, notifications and letters are simulated. Certificate checks summarise Road Transport Act 2013 ss132, 137 and 138 for prototyping, not legal advice. Add <code>?clean=1</code> to any URL to hide the demo-hub link for screenshots.</p>
      </div>
    </div>
  );
}
