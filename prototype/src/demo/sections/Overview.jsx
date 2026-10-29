import { Link } from '../../shared/ui.jsx';
import { ARCHETYPES } from '../content.js';

export default function Overview() {
  return (
    <>
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
      <h2>Start from who the person is</h2>
      <p className="demo-muted">Each user kind has its own page: how they get here, their journey, and a way to try it.</p>
      <div className="demo-kinds">
        {ARCHETYPES.map((a) => (
          <Link key={a.id} to={`/demo/${a.id}`} className="demo-kind">
            <strong>{a.name}</strong>
            <span>{a.who}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
