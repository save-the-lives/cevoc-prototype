import { useEffect, useState } from 'react';
import { Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { fmtDate, fmtTime } from '../../lib/format.js';
import { useStore } from '../../lib/store.jsx';
import { site as findSite, staff as findStaff } from '../../data.js';
import EvidenceViewer from './EvidenceViewer.jsx';
import CertPanel from './CertPanel.jsx';
import QuickDecision from './QuickDecision.jsx';
import { CASE_STATE, activeRequest, validationOf } from '../../lib/workflow.js';
import { planFaults } from '../../lib/faults.js';
import { useSim } from '../../lib/useSim.js';

// The double flyout: evidence on the left, certification on the right, decision underneath.
// Most cases can be decided from here. Opening the full case is optional.
export default function CaseWorkbench({ row, agency, index, total, user, onPrev, onNext, onClose, onDecided }) {
  const { state: store, faultSettings } = useStore();
  const { c, n, ev, program, sla, assignee, state: st } = row;
  const sim = useSim(planFaults(n, faultSettings).certs, 600, [n.number]);
  const validation = validationOf(ev, sim.status);
  const req = activeRequest(store.tech, c.id);
  const revenue = agency === 'rnsw';
  const s = findSite(n.site);
  const [tab, setTab] = useState('evidence');
  useEffect(() => { setTab('evidence'); }, [c.id]);
  const risks = ev.notCurrent;
  // One line each: what the customer says, what the checks found, and what to do next. No pre-judged outcome.
  const step = st === 'DECIDED' ? 'Decision recorded.' : st === 'AWAITING_TRANSPORT' ? `Waiting for Transport (${req?.id}). You keep the case.` : st === 'MORE_INFORMATION_REQUIRED' ? 'Transport asked you a question. Reply in the panel below.'
    : st === 'ADVICE_RECEIVED' ? 'Read Transport’s advice, then decide.' : risks ? 'Resolve the certification risk: judge it from the evidence, or ask Transport a specific question.' : 'Evidence and certification are clear. Confirm the plate, then decide.';

  return (
    <section className="st-bench" aria-label={`Review of case ${c.id}`}>
      <p className="sr-only" aria-live="polite">Reviewing {c.id}, case {index + 1} of {total}{risks ? `, ${risks} certification risk` : ''}</p>
      <header className="st-bench__head">
        <div className="st-bench__title">
          <h2>{c.id} <small>{c.type === 'court' ? 'Court election' : 'Review'}</small></h2>
          <p>{n.holder} · penalty notice ({n.number}) · {assignee ? `with ${findStaff(assignee)?.name}` : 'unassigned'}</p>
        </div>
        <Tag size="sm" color={sla.tone}>Waiting {sla.label}</Tag>
        <div className="st-bench__nav">
          <span className="st-bench__pos">{index + 1} of {total}</span>
          <button type="button" onClick={onPrev} disabled={index === 0} aria-label="Previous case (k)" title="Previous case (k)">↑</button>
          <button type="button" onClick={onNext} disabled={index === total - 1} aria-label="Next case (j)" title="Next case (j)">↓</button>
          <button type="button" onClick={onClose} aria-label="Back to the full list (Esc)" title="Back to the list (Esc)">✕</button>
        </div>
      </header>

      <div className="st-bench__sum" role="group" aria-label="Case summary">
        <div><span>Customer’s issue</span><strong>{c.category}</strong><em>“{c.grounds.length > 90 ? `${c.grounds.slice(0, 88)}…` : c.grounds}”</em></div>
        <div><span>Verification</span><strong><Tag size="sm" color={validation.tone}>{validation.label}</Tag></strong><em>{validation.short}</em></div>
        <div><span>Status</span><strong><Tag size="sm" color={CASE_STATE[st].tone}>{CASE_STATE[st].label}</Tag></strong><em>Next: {step}</em></div>
      </div>

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
          {revenue && risks === 0
            ? <details className="st-bench__more"><summary>Supporting evidence ({n.media.length} items)</summary><EvidenceViewer items={n.media} program={s.program} /></details>
            : <EvidenceViewer items={n.media} program={s.program} />}
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

      <QuickDecision k={c} n={n} ev={ev} user={user} riskCount={risks} onDecided={onDecided} />
      <p className="st-bench__foot">Need the audit trail or full camera metadata? <Link to={`/staff/case/${c.id}`}>Open the full case ↗</Link> <span className="st-muted">(optional)</span> <Link to={`/source/revenue?case=${c.id}`}>Back in the Revenue NSW case system ↗</Link> <span className="st-muted">(simulated)</span></p>
    </section>
  );
}
