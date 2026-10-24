import { Link } from '../../shared/ui.jsx';
import { fmtDate } from '../../lib/format.js';
import { site as findSite, PROGRAMS } from '../../data.js';
import { scorecard } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';

// The camera's certification on the day of the offence: what the law needs, what was on record,
// and how close each one was. Risks first, with what each means for the fine.
function CertCard({ i }) {
  const { req, cert, age, current, why, withdrawn } = i;
  const limit = req.days;
  const pct = limit && cert ? Math.min(100, Math.round((age / limit) * 100)) : 0;
  return (
    <li className={`cp-card ${current ? 'is-ok' : 'is-bad'}`}>
      <span className="cp-card__icon" aria-hidden="true">{current ? '✓' : '!'}</span>
      <div className="cp-card__body">
        <strong>{req.label}</strong>
        <small>Needed {req.window}</small>
        {cert ? (
          <p><Link to={`/staff/cert/${cert.id}`}>{cert.id}</Link> · {fmtDate(cert.date)}<br /><span className="st-muted">{cert.officer}</span></p>
        ) : <p className="cp-none">{why}</p>}
        {limit && cert && (
          <div className="cp-gauge" role="img" aria-label={`${age} days before the offence, limit ${limit}`}>
            <i style={{ width: `${pct}%` }} className={age > limit ? 'is-over' : pct > 75 ? 'is-near' : ''} />
            <span>{age} of {limit} days</span>
          </div>
        )}
        {!limit && cert && <p className="st-muted">{age === 0 ? 'Same day as the offence' : `${age} days before the offence`}</p>}
        {!current && cert && <p className="cp-why">{why}</p>}
        {!current && <p className="cp-why">Upholding may not survive a challenge.</p>}
        {withdrawn && <p className="cp-why">A later certificate ({withdrawn.id}) was withdrawn and doesn’t count.</p>}
      </div>
    </li>
  );
}

export default function CertPanel({ n }) {
  const { statusOf } = useStore();
  const sc = scorecard(n, statusOf);
  const s = findSite(n.site);
  const items = [...sc.ev.items].sort((a, b) => Number(a.current) - Number(b.current));
  const risks = items.filter((i) => !i.current).length;
  const integrity = sc.checks.filter((c) => c.group === 'Evidence');
  return (
    <div className="cp">
      <header className={`cp-head ${risks ? 'is-risk' : 'is-ok'}`}>
        <span className="cp-head__icon" aria-hidden="true">{risks ? '!' : '✓'}</span>
        <div>
          <strong>{risks ? `${risks} certification ${risks === 1 ? 'risk' : 'risks'}` : 'Certification in order'}</strong>
          <span>{items.length - risks} of {items.length} required certificates current on {fmtDate(n.dateTime)}</span>
        </div>
      </header>
      <ul className="cp-list">{items.map((i) => <CertCard key={i.req.label} i={i} />)}</ul>

      <details className="cp-more">
        <summary>Evidence integrity <em>{integrity.filter((c) => c.ok).length} of {integrity.length} passed</em></summary>
        <ul>{integrity.map((c) => <li key={c.label} className={c.ok ? '' : 'is-bad'}><span aria-hidden="true">{c.ok ? '✓' : '!'}</span><strong>{c.label}</strong><small>{c.detail}</small></li>)}</ul>
      </details>
      <details className="cp-more">
        <summary>Camera <em>{s.code}</em></summary>
        <dl className="st-kv">
          <div><dt>Site</dt><dd><Link to={`/staff/camera/${s.code}`}>{s.name}</Link></dd></div>
          <div><dt>Program</dt><dd>{PROGRAMS[s.program].label}</dd></div>
          <div><dt>Direction</dt><dd>{s.direction}</dd></div>
          <div><dt>Limit</dt><dd>{s.limit} km/h{s.heavyLimit ? ` (heavy ${s.heavyLimit})` : ''}</dd></div>
          <div><dt>Device</dt><dd>{s.serial}</dd></div>
        </dl>
      </details>
    </div>
  );
}
