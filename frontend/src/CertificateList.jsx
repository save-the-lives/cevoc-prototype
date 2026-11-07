import { certificateRows, certificateSummary } from './certs.js';

export default function CertificateList({ certificates, coverage, uncoveredTypes }) {
  const rows = certificateRows(certificates);
  const uncovered = Array.isArray(uncoveredTypes) ? uncoveredTypes : [];
  return (
    <section className="certs" aria-labelledby="certs-h">
      <h3 id="certs-h">Camera certificates</h3>
      <p className="hint">{certificateSummary(certificates, coverage)}</p>
      {rows.length > 0 && (
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
      )}
      {uncovered.length > 0 && (
        <ul className="cert-list">
          {uncovered.map((u, i) => (
            <li key={`uncov-${i}`} className="cert-card is-warn">
              <span className="cert-ic" aria-hidden="true">!</span>
              <div>
                <div className="cert-head">
                  <strong>{u.description}</strong>
                  <span className="cert-tag-warn">Not in force</span>
                </div>
                <p className="cert-context">{u.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="cert-see-all">
        <a href="https://cevoc.transport.nsw.gov.au/cevoc/pages/sdro/searchCertificates.jsf"
           target="_blank" rel="noopener noreferrer">
          See all certificates for this camera
        </a>
      </p>
    </section>
  );
}
