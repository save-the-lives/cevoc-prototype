import { Link } from '../../shared/ui.jsx';
import { ARCHETYPES, IMPLICATIONS, JOURNEY, QA, QUESTIONS } from '../content.js';

export function Journey() {
  return (
    <>
      <h1>The journey</h1>
      <p className="demo-lede">The emotional arc of someone who has just been fined, and where the prototype meets them.</p>
      <div className="demo-arc">
        {JOURNEY.map(([t, d, mood], i) => (
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
    </>
  );
}

export function InfoArchitecture() {
  return (
    <>
      <h1>Organised around the person, not the agency</h1>
      <p className="demo-lede">Someone who’s been fined wants to know what happened, whether it was them, whether the evidence holds up, and whether the camera was certified. Today those answers are split between Revenue NSW and Transport, and one of them isn’t answered at all.</p>
      <div className="demo-ia">
        <div>
          <h2>Today</h2>
          <div className="demo-silo is-rnsw"><strong>Revenue NSW · myPenalty / MyFines</strong><span>Notice details · photos · pay / review / nominate</span></div>
          <p className="demo-gap">The person stitches these together themselves</p>
          <div className="demo-silo is-tf"><strong>Transport · CEVOC</strong><span>Camera certificates only · search by camera and date</span></div>
          <div className="demo-silo is-none"><strong>Nobody</strong><span>“Is the evidence enough?”</span></div>
        </div>
        <span className="demo-ia__arrow" aria-hidden="true">→</span>
        <div>
          <h2>Proposed</h2>
          <div className="demo-silo is-new">
            <strong>Your fine, explained</strong>
            <ol><li>What happened?</li><li>Was it me?</li><li>Is the evidence enough?</li><li>Was the camera certified?</li><li>What can I do? → back to Revenue NSW / Service NSW</li></ol>
            <span>One page. Data from both agencies behind it. Agency boundaries invisible to the person.</span>
          </div>
          <Link to="/notice/3162457894" className="demo-go">Try it with a fine ↗</Link>
        </div>
      </div>
      <h2>Questions, content and where the data lives</h2>
      <div className="demo-scroll">
        <table className="demo-table">
          <thead><tr><th>The person asks</th><th>What we show</th><th>Data behind it</th><th>Owner today</th><th>Where they find it today</th></tr></thead>
          <tbody>{QA.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{i === 0 ? <strong>{c}</strong> : c}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <h2>Every door leads to the same answer</h2>
      <div className="demo-doors">
        {ARCHETYPES.flatMap((a) => a.doors.map((d) => ({ ...d, kind: a }))).map((d) => (
          <Link key={d.name} to={`/demo/${d.kind.id}`} className="demo-door"><strong>{d.name}</strong><span>→ {d.lands}</span></Link>
        ))}
      </div>
      <h2>What this means for CEVOC</h2>
      <ul className="demo-list">{IMPLICATIONS.map(([b, t]) => <li key={b}><strong>{b}</strong> {t}</li>)}</ul>
    </>
  );
}

export function Questions() {
  return (
    <>
      <h1>Open questions</h1>
      <p className="demo-lede">Decisions the prototype can’t make for you.</p>
      <div className="demo-scroll">
        <table className="demo-table">
          <thead><tr><th>Question</th><th>Who decides</th></tr></thead>
          <tbody>{QUESTIONS.map(([q, w]) => <tr key={q}><td>{q}</td><td>{w}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
