import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { fmtDate, fmtTime } from '../../lib/format.js';
import { useStore } from '../../lib/store.jsx';
import { site as findSite, staff as findStaff } from '../../data.js';
import EvidenceViewer from './EvidenceViewer.jsx';
import CertPanel from './CertPanel.jsx';
import QuickDecision from './QuickDecision.jsx';

// The double flyout: evidence on the left, certification on the right, decision underneath.
// Most cases can be decided from here. Opening the full case is optional.
export default function CaseWorkbench({ row, index, total, user, onPrev, onNext, onClose, onDecided }) {
  const { dispatch } = useStore();
  const { c, n, ev, program, sla, assignee } = row;
  const s = findSite(n.site);
  const [tab, setTab] = useState('evidence');
  useEffect(() => { setTab('evidence'); }, [c.id]);
  const risks = ev.notCurrent;

  return (
    <section className="st-bench" aria-label={`Review of case ${c.id}`}>
      <p className="sr-only" aria-live="polite">Reviewing {c.id}, case {index + 1} of {total}{risks ? `, ${risks} certification risk` : ''}</p>
      <header className="st-bench__head">
        <div className="st-bench__title">
          <h2>{c.id} <small>{c.type === 'court' ? 'Court election' : 'Review'}</small></h2>
          <p>{n.holder} · notice {n.number} · {assignee ? `with ${findStaff(assignee)?.name}` : 'unassigned'}</p>
        </div>
        <Tag size="sm" color={sla.tone}>Waiting {sla.label}</Tag>
        <div className="st-bench__nav">
          <span className="st-bench__pos">{index + 1} of {total}</span>
          <button type="button" onClick={onPrev} disabled={index === 0} aria-label="Previous case (k)" title="Previous case (k)">↑</button>
          <button type="button" onClick={onNext} disabled={index === total - 1} aria-label="Next case (j)" title="Next case (j)">↓</button>
          <button type="button" onClick={onClose} aria-label="Back to the full list (Esc)" title="Back to the list (Esc)">✕</button>
        </div>
      </header>

      <div className="st-bench__tabs" role="tablist" aria-label="Review sections">
        <button type="button" role="tab" aria-selected={tab === 'evidence'} onClick={() => setTab('evidence')}>Evidence</button>
        <button type="button" role="tab" aria-selected={tab === 'cert'} onClick={() => setTab('cert')}>Certification{risks ? <b>{risks}</b> : null}</button>
      </div>

      <div className="st-bench__panes">
        <section className="st-bench__pane" data-active={tab === 'evidence'} data-keys="own" tabIndex={0} aria-label="Evidence">
          <h3 className="st-bench__h">Evidence</h3>
          {risks > 0 && (
            <button type="button" className="st-bench__risk" onClick={() => setTab('cert')}>
              <span aria-hidden="true">!</span> {risks} certification {risks === 1 ? 'risk' : 'risks'} on the camera. <u>See certification</u>
            </button>
          )}
          <EvidenceViewer items={n.media} program={s.program} />
          <blockquote className="st-quote">“{c.grounds}”<cite>Lodged via {c.channel} on {fmtDate(c.lodged)}</cite></blockquote>
          <dl className="st-facts">
            <div><dt>Offence</dt><dd>{n.offence}</dd></div>
            <div><dt>When</dt><dd>{fmtDate(n.dateTime)}, {fmtTime(n.dateTime)}</dd></div>
            <div><dt>Where</dt><dd>{s.name}</dd></div>
            <div><dt>Vehicle</dt><dd>{n.rego} · {n.vehicle}</dd></div>
            <div><dt>Camera</dt><dd>{program}</dd></div>
            <div><dt>Reply by</dt><dd>{fmtDate(sla.due)}<small>{sla.hint}</small></dd></div>
          </dl>
        </section>
        <section className="st-bench__pane" data-active={tab === 'cert'} data-keys="own" tabIndex={0} aria-label="Camera certification">
          <h3 className="st-bench__h">Camera certification</h3>
          <CertPanel n={n} />
        </section>
      </div>

      <QuickDecision k={c} user={user} riskCount={risks} onDecided={onDecided}
        onAdvice={() => { dispatch({ type: 'note', who: user.id, what: `Technical advice added to ${c.id}`, ref: c.id }); toast.success('Technical advice added'); }} />
      <p className="st-bench__foot">Need the audit trail or full camera metadata? <Link to={`/staff/case/${c.id}`}>Open the full case ↗</Link> <span className="st-muted">(optional)</span></p>
    </section>
  );
}
