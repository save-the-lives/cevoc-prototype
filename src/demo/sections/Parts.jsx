import { Link } from '../../shared/ui.jsx';
import { VERIFIED } from '../content.js';

export function Framing({ context, pain, job }) {
  return (
    <dl className="frame">
      {context && <div><dt>Context</dt><dd>{context}</dd></div>}
      <div><dt>Pain</dt><dd>{pain}</dd></div>
      <div><dt>Job to be done</dt><dd>{job}</dd></div>
    </dl>
  );
}

// A journey drawn as a row of boxes: dashed = existing service, orange = CEVOC, green = hand-off.
export function PathPicture({ steps }) {
  return (
    <ol className="demo-path" aria-label="Journey path">
      {steps.map(([label, kind], i) => (
        <li key={label} className={`demo-path__step is-${kind}`}>
          <span className="demo-path__n">{i + 1}</span>
          <strong>{label}</strong>
          <small>{{ ext: 'Existing service', ours: 'CEVOC', out: 'Hand-off', person: 'The person' }[kind]}</small>
        </li>
      ))}
    </ol>
  );
}

export const Badge = ({ v }) => <span className={`ver ver--${VERIFIED[v][0]}`}>{VERIFIED[v][1]}</span>;

export const Try = ({ links }) => (
  <div className="demo-try">{links.map(([t, to]) => <Link key={to} to={to} className="demo-go">{t} ↗</Link>)}</div>
);
