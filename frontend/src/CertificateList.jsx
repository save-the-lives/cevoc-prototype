import { certificateRows, certificateSummary } from './certs.js';

export default function CertificateList({ certificates }) {
  const rows = certificateRows(certificates);
  return (
    <section className="certs" aria-labelledby="certs-h">
      <h3 id="certs-h">Camera certificates</h3>
      <p className="hint">{certificateSummary(certificates)}</p>
      <ul className="cert-list">
        {rows.map((c, i) => (
          <li key={i} className={`cert-row${c.covers ? ' covers' : ''}`}>
            <p className="cert-badge">
              <span className={`badge ${c.covers ? 'badge-ok' : 'badge-no'}`}>
                <span aria-hidden="true">{c.covers ? '✓ ' : '– '}</span>{c.label}
              </span>
            </p>
            <p className="cert-title">{c.description}</p>
            <dl className="cert-facts">
              <div><dt>Type</dt><dd>{c.type}</dd></div>
              <div><dt>Period</dt><dd>{c.periodText}</dd></div>
              <div><dt>Certified</dt><dd>{c.certifiedText}</dd></div>
              <div><dt>Expires</dt><dd>{c.expiryText}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
