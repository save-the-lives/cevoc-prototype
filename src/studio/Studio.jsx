import React, { useState } from 'react';
import { Link } from '../components/ui.jsx';
import { Skeleton } from '../components/Feedback.jsx';
import { useApp } from '../state.js';
import { PRINCIPLES, PERSONAS, JOURNEYS, FAILURE_MODES, DECISIONS } from './content.js';
import { DEFAULT_PROGRAM, PROGRAMS, programFor, overriddenKeys } from '../config/programs.js';
import { IDPS, ROLES, SAMPLES } from '../data/mockData.js';
import { IdpScreen } from '../pages/Officer.jsx';

const SECTIONS = [
  ['overview', 'Overview'],
  ['personas', 'Personas'],
  ['journeys', 'Journeys'],
  ['programs', 'Enforcement programs'],
  ['resilience', 'When things break'],
  ['sign-in', 'Sign-in'],
  ['decisions', 'Open questions'],
];

// Links from the studio into the prototype.
const Try = ({ to, children }) => (
  <Link to={to} className="studio-try">
    {children} <span aria-hidden="true">↗</span>
  </Link>
);

function Overview() {
  return (
    <>
      <h1>Behind the prototype</h1>
      <p className="studio-lede">
        The prototype shows what people would see. This studio explains who they are, the moment they’re in, how the design responds, and what’s still assumed.
        Use the switch at the top of the page to move between the two at any time.
      </p>
      <div className="studio-split">
        <div className="studio-box">
          <h2>Prototype</h2>
          <p>Government look and feel, mock data, clickable end to end. What a community member or officer would use.</p>
        </div>
        <div className="studio-box is-dark">
          <h2>Design studio</h2>
          <p>Deliberately different look. Personas, journeys, configuration, failure handling and open questions. Not part of any real service.</p>
        </div>
      </div>
      <h2>Principles</h2>
      <ol className="studio-principles">
        {PRINCIPLES.map(([t, d]) => (
          <li key={t}><strong>{t}</strong><span>{d}</span></li>
        ))}
      </ol>
      <h2>How it fits together</h2>
      <div className="studio-map" aria-label="System map">
        <div className="studio-map__col">
          <span className="studio-node is-person">Community member</span>
          <span className="studio-node is-person">Revenue NSW officer</span>
          <span className="studio-node is-person">Transport officer</span>
        </div>
        <div className="studio-map__col">
          <span className="studio-node">Public pages<br /><small>no sign-in</small></span>
          <span className="studio-node">Officer console<br /><small>organisation sign-in</small></span>
        </div>
        <div className="studio-map__col">
          <span className="studio-node is-core">Service layer<br /><small>access rules · program config · audit</small></span>
        </div>
        <div className="studio-map__col">
          <span className="studio-node is-source">Notices</span>
          <span className="studio-node is-source">Certificates</span>
          <span className="studio-node is-source">Images and video</span>
        </div>
      </div>
      <p className="studio-muted">Each source can fail on its own. The pages are built so one failure doesn’t take the others down.</p>
    </>
  );
}

function Meter({ label, value }) {
  return (
    <div className="studio-meter">
      <span>{label}</span>
      <span className="studio-meter__bar" aria-label={`${label} ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= value ? 'on' : ''} />)}
      </span>
    </div>
  );
}

function Personas() {
  const [group, setGroup] = useState('All');
  const [open, setOpen] = useState(PERSONAS[0].id);
  const groups = ['All', 'Community', 'Revenue NSW', 'Transport'];
  const list = PERSONAS.filter((p) => group === 'All' || p.group === group);
  const p = PERSONAS.find((x) => x.id === open) || list[0];
  return (
    <>
      <h1>Personas</h1>
      <p className="studio-lede">Who arrives, in what state, and what they need in that moment. These are hypotheses to test, not research findings.</p>
      <div className="studio-chips" role="group" aria-label="Filter personas">
        {groups.map((g) => (
          <button key={g} type="button" className={g === group ? 'is-on' : ''} aria-pressed={g === group} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>
      <div className="studio-personas">
        <ul className="studio-plist">
          {list.map((x) => (
            <li key={x.id}>
              <button type="button" className={`studio-pcard ${x.id === p.id ? 'is-on' : ''}`} onClick={() => setOpen(x.id)} aria-pressed={x.id === p.id}>
                <span className="studio-avatar" aria-hidden="true">{x.name[0]}</span>
                <span><strong>{x.name}</strong> <small>{x.group}</small><br />{x.title}</span>
              </button>
            </li>
          ))}
        </ul>
        {p && (
          <article className="studio-pdetail">
            <p className="studio-tag">{p.group}</p>
            <h2>{p.name}: {p.title}</h2>
            <blockquote>{p.quote}</blockquote>
            <p><strong>The moment:</strong> {p.moment}</p>
            <div className="studio-meters">
              <Meter label="Stress" value={p.feelings.stress} />
              <Meter label="Trust" value={p.feelings.trust} />
              <Meter label="Urgency" value={p.feelings.urgency} />
              <Meter label="Digital confidence" value={p.feelings.confidence} />
            </div>
            <p className="studio-jtbd"><strong>Job to be done:</strong> {p.jtbd}</p>
            <div className="studio-three">
              <div><h3>Needs</h3><ul>{p.needs.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><h3>Breaks trust</h3><ul>{p.breaks.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><h3>Design response</h3><ul>{p.design.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>
            <p className="studio-muted"><strong>How we got here:</strong> {p.evidence}</p>
            <Try to={p.tryIt[1]}>Try as {p.name}: {p.tryIt[0]}</Try>
          </article>
        )}
      </div>
    </>
  );
}

function Curve({ stages }) {
  const w = 160;
  const h = 150;
  const y = (f) => 20 + ((2 - f) / 4) * (h - 40);
  const pts = stages.map((s, i) => [w / 2 + i * w, y(s.feeling)]);
  const d = pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x},${yy}`).join(' ');
  return (
    <svg className="studio-curve" viewBox={`0 0 ${stages.length * w} ${h}`} role="img" aria-label="Emotion across the journey">
      <line x1="0" x2={stages.length * w} y1={y(0)} y2={y(0)} className="axis" />
      <text x="6" y="16" className="lbl">Better</text>
      <text x="6" y={h - 6} className="lbl">Worse</text>
      <path d={d} className="line" />
      {pts.map(([x, yy], i) => (
        <circle key={i} cx={x} cy={yy} r="8" className={stages[i].feeling < 0 ? 'neg' : stages[i].feeling > 0 ? 'pos' : 'neu'} />
      ))}
    </svg>
  );
}

function Journeys() {
  const [key, setKey] = useState('community');
  const j = JOURNEYS[key];
  return (
    <>
      <h1>Journeys</h1>
      <p className="studio-lede">Same structure for every journey: what they do, think and feel at each stage, where it hurts, and what the design does about it.</p>
      <div className="studio-chips" role="tablist">
        {Object.entries(JOURNEYS).map(([k, v]) => (
          <button key={k} type="button" role="tab" aria-selected={k === key} className={k === key ? 'is-on' : ''} onClick={() => setKey(k)}>
            {v.title.split(':')[0]}
          </button>
        ))}
      </div>
      <h2>{j.title}</h2>
      <p className="studio-muted">Personas: {j.who}</p>
      <div className="studio-journey" style={{ '--n': j.stages.length }}>
        <Curve stages={j.stages} />
        <div className="studio-stages">
          {j.stages.map((s, i) => (
            <div key={s.name} className="studio-stage">
              <span className="studio-stage__n">{i + 1}</span>
              <h3>{s.name}</h3>
              <dl>
                <dt>Doing</dt><dd>{s.doing}</dd>
                <dt>Thinking</dt><dd>{s.thinking}</dd>
                <dt>Pain</dt><dd>{s.pain}</dd>
                <dt>Design</dt><dd className="is-design">{s.design}</dd>
              </dl>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const SAMPLE_FOR = {
  FIXED_SPEED: SAMPLES[0],
  RED_LIGHT_SPEED: SAMPLES[1],
  MOBILE_SPEED: SAMPLES[2],
  AVERAGE_SPEED: SAMPLES[3],
  POINT_TO_POINT_PILOT_X: SAMPLES[4],
};

function Programs() {
  const codes = [...Object.keys(PROGRAMS), 'POINT_TO_POINT_PILOT_X'];
  const [code, setCode] = useState('AVERAGE_SPEED');
  const merged = programFor(code);
  const changed = overriddenKeys(code);
  const sample = SAMPLE_FOR[code];
  return (
    <>
      <h1>Enforcement programs</h1>
      <p className="studio-lede">
        One layout, many programs. Each program only overrides what’s different from the default. A program nobody has configured yet still works: it gets the default and is flagged.
      </p>
      <div className="studio-rule">
        <strong>Rule:</strong> default applies → program overrides what it must → unknown program = default + flag
      </div>
      <div className="studio-programs">
        <ul className="studio-plist">
          {codes.map((c) => (
            <li key={c}>
              <button type="button" className={`studio-pcard ${c === code ? 'is-on' : ''}`} onClick={() => setCode(c)} aria-pressed={c === code}>
                <span><strong>{programFor(c).known ? programFor(c).label : 'Unconfigured program'}</strong><br /><code>{c}</code></span>
              </button>
            </li>
          ))}
        </ul>
        <div>
          <h2>{merged.known ? merged.label : 'Unconfigured program → default'}</h2>
          <p>{merged.explainer}</p>
          <table className="studio-table">
            <thead><tr><th>Setting</th><th>This program</th><th>Source</th></tr></thead>
            <tbody>
              {['label', 'measurement', 'evidence', 'actions', 'reviewChecklist'].map((k) => (
                <tr key={k}>
                  <td><code>{k}</code></td>
                  <td>{Array.isArray(merged[k]) ? merged[k].join(', ') : typeof merged[k] === 'object' ? Object.entries(merged[k]).map(([a, b]) => `${a}: ${b ? 'yes' : 'no'}`).join(', ') : String(merged[k])}</td>
                  <td>{changed.includes(k) ? <span className="studio-pill is-over">Override</span> : <span className="studio-pill">Default</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>What changes on screen</h3>
          <ul>
            {merged.measurement === 'average' && <li>Average-speed breakdown with both points, times and distance.</li>}
            {merged.measurement === 'signal' && <li>“What the camera recorded” shows how long the signal had been red.</li>}
            {merged.measurement === 'spot' && <li>Recorded speed shown against the speed limit.</li>}
            {merged.evidence.video && <li>Video section available (still subject to approval).</li>}
            <li>“How this camera works” uses this program’s wording.</li>
            <li>Review officers get this program’s checklist.</li>
            {!merged.known && <li>Prototype note flags the missing configuration; adjudication applies default checks.</li>}
          </ul>
          {sample && <Try to={`/notice?n=${sample.number}&r=${sample.rego}`}>See it with notice {sample.number}</Try>}
          <details className="studio-details">
            <summary>Merged configuration (JSON)</summary>
            <pre>{JSON.stringify(merged, null, 2)}</pre>
          </details>
          <details className="studio-details">
            <summary>Default configuration (JSON)</summary>
            <pre>{JSON.stringify(DEFAULT_PROGRAM, null, 2)}</pre>
          </details>
        </div>
      </div>
      <p className="studio-muted">Illustrative only. The program list, wording and rules must be validated with program owners.</p>
    </>
  );
}

function Resilience() {
  const { demo, setDemo } = useApp();
  return (
    <>
      <h1>When things break</h1>
      <p className="studio-lede">APIs fail, systems slow down, data has gaps. The rule: keep what works on screen, explain what doesn’t, never spin forever.</p>
      <div className="studio-controls">
        <h2>Live controls</h2>
        <p className="studio-muted">These change the prototype straight away. Open a scenario to see the effect.</p>
        <fieldset>
          <legend>Response speed</legend>
          {['fast', 'normal', 'slow', 'timeout'].map((l) => (
            <label key={l}><input type="radio" name="lat" checked={demo.latency === l} onChange={() => setDemo({ ...demo, latency: l })} /> {l}</label>
          ))}
        </fieldset>
        <label><input type="checkbox" checked={demo.outage} onChange={(e) => setDemo({ ...demo, outage: e.target.checked })} /> Source system outage</label>
        <label><input type="checkbox" checked={demo.certOutage} onChange={(e) => setDemo({ ...demo, certOutage: e.target.checked })} /> Certificate service down</label>
        <label><input type="checkbox" checked={demo.imageOutage} onChange={(e) => setDemo({ ...demo, imageOutage: e.target.checked })} /> Image service down (applies on next lookup)</label>
        <label><input type="checkbox" checked={demo.media} onChange={(e) => setDemo({ ...demo, media: e.target.checked })} /> Show future video</label>
      </div>
      <h2>Loading pattern</h2>
      <div className="studio-split">
        <div className="studio-box is-light"><Skeleton media lines={3} label="Example skeleton" /></div>
        <div>
          <p>Skeletons keep the layout still so nothing jumps. After 2 seconds a short note says it’s taking longer. After the timeout we stop and offer Try again.</p>
          <p>Each part of a page loads on its own, so a slow certificate check doesn’t hold up the offence details.</p>
        </div>
      </div>
      <h2>Failure modes</h2>
      <table className="studio-table">
        <thead><tr><th>Scenario</th><th>What the person sees</th><th>How to trigger</th><th /></tr></thead>
        <tbody>
          {FAILURE_MODES.map(([s, see, how, to]) => (
            <tr key={s}><td><strong>{s}</strong></td><td>{see}</td><td>{how}</td><td><Try to={to}>Open</Try></td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function SignIn() {
  return (
    <>
      <h1>Sign-in</h1>
      <p className="studio-lede">
        Officers never get a CEVOC password. They enter their work email, CEVOC works out which organisation they belong to, and sends them to that organisation’s own sign-in page.
      </p>
      <ol className="studio-flow">
        <li><strong>Work email</strong><span>name@transport.nsw.gov.au or name@revenue.nsw.gov.au</span></li>
        <li><strong>Home realm discovery</strong><span>Email domain decides which organisation signs them in</span></li>
        <li><strong>Organisation sign-in</strong><span>Their usual page, branding, password and MFA</span></li>
        <li><strong>Identity + role claims</strong><span>Sent back to CEVOC</span></li>
        <li><strong>Role decides access</strong><span>Signed in ≠ authorised</span></li>
      </ol>
      <div className="studio-split">
        {Object.values(IDPS).map((idp) => (
          <div key={idp.id}>
            <h2>{idp.org}</h2>
            <IdpScreen preview idp={idp} email={`name@${idp.domain}`} />
          </div>
        ))}
      </div>
      <h2>Mock accounts and roles</h2>
      <table className="studio-table">
        <thead><tr><th>Account</th><th>Organisation</th><th>Role</th><th>Can</th><th /></tr></thead>
        <tbody>
          {ROLES.map((r) => (
            <tr key={r.id}>
              <td><code>{r.email}</code></td><td>{r.org}</td><td>{r.name}</td>
              <td>{r.permissions.length ? r.permissions.join(', ') : 'nothing (signed in, not authorised)'}</td>
              <td><Try to={`/officer?email=${r.email}`}>Sign in</Try></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="studio-muted">
        Assumptions to confirm: {IDPS.transport.platform}. {IDPS.revenue.platform} Screens are generic mocks, not copies of any real sign-in page.
      </p>
    </>
  );
}

function Decisions() {
  return (
    <>
      <h1>Open questions</h1>
      <p className="studio-lede">What the prototype assumes, and who needs to decide.</p>
      <table className="studio-table">
        <thead><tr><th>Question</th><th>Who decides</th><th>What the prototype assumes</th></tr></thead>
        <tbody>
          {DECISIONS.map(([q, who, a]) => (
            <tr key={q}><td>{q}</td><td>{who}</td><td>{a}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const PAGES = { overview: Overview, personas: Personas, journeys: Journeys, programs: Programs, resilience: Resilience, 'sign-in': SignIn, decisions: Decisions };

export default function Studio({ section }) {
  const key = PAGES[section] ? section : 'overview';
  const Page = PAGES[key];
  return (
    <div className="studio">
      <aside className="studio-nav" aria-label="Design studio">
        <p className="studio-brand">CEVOC <span>Design studio</span></p>
        <nav>
          {SECTIONS.map(([k, label]) => (
            <Link key={k} to={`/studio/${k}`} className={k === key ? 'is-on' : ''} aria-current={k === key ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
      </aside>
      <main id="main-content" tabIndex={-1} className="studio-main">
        <Page />
      </main>
    </div>
  );
}
