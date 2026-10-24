import { Button } from '@nswds/ui';
import { Dialog } from '../shared/ui.jsx';
import { certLines, downloadCert } from '../lib/certDoc.js';
import { fmtDate } from '../lib/format.js';
import { site as findSite } from '../data.js';

// A certificate opened in place, so people never have to leave the page to read one.
export default function CertificateView({ cert, onClose }) {
  const site = findSite(cert.site);
  const lines = certLines(cert, site);
  return (
    <Dialog title="Certificate" onClose={onClose}>
      <article className="certview">
        <p className="proto-line">{lines[0][0]}</p>
        <h3>{lines[1][0]}</h3>
        <dl>
          <div><dt>Certificate number</dt><dd>{cert.id}</dd></div>
          <div><dt>Camera</dt><dd>{site.code} · {site.name}</dd></div>
          <div><dt>Date</dt><dd>{fmtDate(cert.date)}{cert.time ? ` at ${cert.time}` : ''}</dd></div>
          <div><dt>Made by</dt><dd>{cert.officer}</dd></div>
          <div><dt>Status</dt><dd>{cert.status === 'withdrawn' ? 'Withdrawn' : 'On record'}</dd></div>
        </dl>
        <p className="muted">{lines[lines.length - 1][0]}</p>
      </article>
      <div className="dlg-actions">
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        <Button type="button" onClick={() => downloadCert(cert, site)}>Download PDF ↓</Button>
      </div>
    </Dialog>
  );
}
