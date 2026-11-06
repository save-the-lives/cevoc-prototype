import { certificateRows, certificateSummary } from './certs.js';

export default function CertificateList({ certificates, coverage }) {
  const rows = certificateRows(certificates);
  return (
    <section className="certs" aria-labelledby="certs-h">
      <h3 id="certs-h">Camera certificates</h3>
      <p className="hint">{certificateSummary(certificates, coverage)}</p>
      <ul className="cert-list">
        {rows.map((c, i) => (
          <li key={i} className={`cert-card${c.covers ? '' : ' is-warn'}`}>
            <span className="cert-ic" aria-hidden="true">{c.covers ? '✓' : '!'}</span>
            <div>
              <div className="cert-head">
                <strong>{c.description}</strong>
                {c.covers
                  ? <span className="sr-only">In force</span>
                  : <span className="cert-tag-warn">Not in force</span>}
              </div>
              <p className="cert-context">
                {c.type} · {c.periodText}
              </p>
              <p className="cert-dates">
                Certified {c.certifiedText}{c.expiryText !== 'Not given' ? ` · Expires ${c.expiryText}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
