import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Tag } from '@nswds/ui';
import { Dialog, Link } from '../../shared/ui.jsx';
import { go } from '../../lib/router.js';
import { fmtDate } from '../../lib/format.js';
import { useStore } from '../../lib/store.jsx';
import { CERTS, STAFF, kase as findCase, notice as findNotice, site as findSite, staff as findStaff, PROGRAMS } from '../../data.js';
import { DETERMINATION, DETERMINATION_TONE, RECOMMENDATION, categoryLabel, impactLevel, matterStatus, validationOf } from '../../lib/workflow.js';
import { evaluate } from '../../lib/rules.js';
import MatterStatus from './MatterStatus.jsx';
import { Lifecycle, RequestMeta } from './Lifecycle.jsx';
import Proposed from '../../shared/Proposed.jsx';
import { CASES } from '../../data.js';
import EvidenceViewer from '../queue/EvidenceViewer.jsx';
import CertPanel from '../queue/CertPanel.jsx';

// Referral workbench. Left: why it was referred and the evidence. Centre: this camera's certification and technical records.
// Right: the assessment and, for authorised Transport roles only, the determination. Original evidence is read-only here.
export default function TechRequest({ id, user, slots }) {
  const { state, dispatch, statusOf } = useStore();
  const r = state.tech.find((x) => x.id === id);
  const [rec, setRec] = useState('');
  const [advice, setAdvice] = useState('');
  const [scope, setScope] = useState('');
  const [attach, setAttach] = useState([]);
  const [outcome, setOutcome] = useState('');
  const [rationale, setRationale] = useState('');
  const [clar, setClar] = useState('');
  const [link, setLink] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!r) return <p>Referral {id} not found. <Link to="/staff/requests">Back to referrals</Link></p>;
  const n = findNotice(r.notice);
  if (!n) return <p>The penalty notice for {id} is not on record. <Link to="/staff/requests">Back to referrals</Link></p>;
  const s = findSite(r.site);
  const k = findCase(r.caseId);
  const impact = impactLevel(r, state.tech);
  const mayAssess = user.perms.includes('inspect:request');
  const mayDetermine = user.perms.includes('withdraw:determine');
  const court = r.category === 'court';
  const siblings = state.tech.filter((x) => x.site === r.site && x.id !== r.id);
  const certs = CERTS.filter((c) => c.site === r.site);
  const { Metadata, plan } = slots;
  const status = matterStatus({ n, ev: evaluate(n, statusOf), validation: validationOf(evaluate(n, statusOf)), req: r });
  const outcomes = court ? ['court-support', 'further-info'] : ['supportable', 'withdrawal', 'further-info'];
  const assessed = r.assessment;
  const needAssessment = !assessed && r.status === 'INVESTIGATING';
  const assessOk = !needAssessment || (rec && advice.trim().length >= 20 && scope.trim().length >= 10);
  const detOk = outcome && rationale.trim().length >= 20 && assessOk;
  const related = CASES.filter((c) => c.id !== r.caseId && !state.decisions[c.id] && findNotice(c.notice)?.site === r.site).map((c) => c.id);

  const doAssess = () => {
    if (busy) return; setBusy(true);
    dispatch({ type: 'techAssess', id: r.id, by: user.id, assessment: { recommendation: rec, advice: advice.trim(), scope: scope.trim(), attachments: attach } });
    toast.success('Assessment and recommendation recorded. A determination is still needed.');
    setConfirm(null); setBusy(false);
  };
  const doDetermine = () => {
    if (busy) return; setBusy(true);
    dispatch({ type: 'techDetermine', id: r.id, by: user.id, related, response: { ...(assessed ? {} : { recommendation: rec, advice: advice.trim(), scope: scope.trim() }), outcome, rationale: rationale.trim(), attachments: attach } });
    toast.success(`Determination issued: ${DETERMINATION[outcome]}. Revenue NSW has been told (simulated).`);
    setConfirm(null); setBusy(false);
  };

  return (
    <div className="tr">
      <div className="st-rec-head"><span className="st-type">Referral from Revenue NSW</span><h1>{r.id}</h1>
        {court && <Tag size="sm" color="primary">Court election</Tag>}
        <Tag size="sm" color={impact === 'Systemic' ? 'danger' : impact === 'Multiple' ? 'warning' : 'grey'}>{impact}</Tag>
        <span className="st-muted">{categoryLabel(r.category)} · {s.code}</span></div>
      <MatterStatus status={status} />
      <div className="tr-flow"><p className="st-muted">Referral lifecycle <Proposed note="Tracking acknowledgement, assessment and determination between agencies is a proposal." /></p><Lifecycle req={r} decided={!!state.decisions[r.caseId]} /><RequestMeta req={r} decided={!!state.decisions[r.caseId]} /></div>
      <p className="st-muted tr-owner"><span className="owner-tag">Transport</span> holds the authority to determine whether enforcement stands on technical or certification grounds. Revenue NSW is informed and carries out its own downstream steps. Original evidence is shown read-only and is never changed here.</p>
      <div className="tr-panes">
        <section className="tr-pane" aria-label="Reason and evidence">
          <h2>Reason for referral</h2>
          <blockquote className="st-quote">“{r.question}”<cite>{findStaff(r.by)?.name}, Revenue NSW · {court ? 'court election' : 'review'} {r.caseId} · {fmtDate(r.at)}</cite></blockquote>
          {k && <p className="st-muted">Reason for the review: “{k.grounds}”</p>}
          {r.thread.map((t, i) => <p key={i} className="tr-thread"><strong>{findStaff(t.by)?.name}</strong> {t.internal ? '(internal note)' : ''}: {t.text}</p>)}
          <h3>Source evidence <span className="ro-tag">read-only</span></h3>
          <EvidenceViewer items={n.media} program={s.program} />
          <dl className="st-facts"><div><dt>Penalty notice</dt><dd><Link to={`/staff/notice/${n.number}`}>({n.number})</Link></dd></div><div><dt>Camera</dt><dd>{PROGRAMS[s.program].label}, {s.name}</dd></div></dl>
        </section>
        <section className="tr-pane" aria-label="Certification and technical records">
          <h2>Certification and technical records</h2>
          <CertPanel n={n} />
          {n.segment && <div className="st-card"><h3>Calculation</h3><p>{n.segment.distanceKm} km between points, {n.segment.timeA} to {n.segment.timeB}. Reported average {n.speed} km/h.</p></div>}
          {n.redFor && <div className="st-card"><h3>Calculation</h3><p>Light had been red for {n.redFor} s when the vehicle crossed at {n.speed} km/h.</p></div>}
          {Metadata && <Metadata n={n} fault={plan?.meta} />}
          <h3>Related referrals at this camera</h3>
          {siblings.length ? <ul className="st-list">{siblings.map((x) => <li key={x.id}><Link to={`/staff/request/${x.id}`}>{x.id}</Link> · {categoryLabel(x.category)} · {x.status === 'ADVICE_RECEIVED' && x.response?.outcome ? DETERMINATION[x.response.outcome].split(' (')[0] : state.tech.find((y) => y.id === x.id) && x.status.toLowerCase().replace(/_/g, ' ')}</li>)}</ul> : <p className="st-muted">No other referrals for {s.code}.</p>}
        </section>
        <section className="tr-pane" aria-label="Assessment and determination">
          <h2>Assessment and determination</h2>
          {user.perms.includes('team:manage') && ['AWAITING_TRANSPORT', 'ACKNOWLEDGED', 'INVESTIGATING', 'AWAITING_DETERMINATION'].includes(r.status) && (
            <label className="adv-f"><span>Assign to (manager)</span>
              <select value={r.assignee || ''} onChange={(e) => e.target.value && dispatch({ type: 'techAssign', id: r.id, to: e.target.value, by: user.id })}>
                <option value="">{r.assignee ? findStaff(r.assignee).name : 'Choose…'}</option>
                {STAFF.filter((p) => p.agency === 'tfnsw' && p.perms.includes('inspect:request') && p.id !== r.assignee).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          {assessed && (
            <div className="adv">
              <p><strong>Assessment and recommendation</strong> <span className="st-muted">by {findStaff(assessed.by)?.name} · not a determination</span></p>
              <p>{RECOMMENDATION[assessed.recommendation]}</p><p>{assessed.advice}</p><p className="st-muted">Applies when: {assessed.scope}</p>
            </div>
          )}
          {r.status === 'ADVICE_RECEIVED' ? (
            <div className={`adv adv--${r.response.outcome === 'withdrawal' ? 'awaiting_transport' : 'advice_received'}`}>
              <p><Tag size="sm" color={DETERMINATION_TONE[r.response.outcome]}>Determination</Tag> <strong>{DETERMINATION[r.response.outcome]}</strong></p>
              {r.response.rationale && <p>{r.response.rationale}</p>}
              {!assessed && r.response.advice && <><p>{r.response.advice}</p><p className="st-muted">Applies when: {r.response.scope}</p></>}
              <p className="st-muted">{findStaff(r.response.by)?.name} · {fmtDate(r.response.at)} · Revenue NSW downstream steps: {r.actioned ? `complete (${fmtDate(r.actioned.at)})` : 'pending'}</p>
            </div>
          ) : r.status === 'CANCELLED' ? <p className="st-muted">Revenue NSW cancelled this referral.</p>
          : r.status === 'MORE_INFORMATION_REQUIRED' ? <p className="st-muted">Waiting for Revenue NSW to reply to the question.</p>
          : !mayAssess ? <p className="st-muted">Transport technical staff assess referrals. Revenue NSW sees the same status.</p>
          : r.status === 'AWAITING_TRANSPORT' ? (
            <div className="adv-form"><p>Acknowledging tells Revenue NSW you have the referral. It is <strong>not</strong> an assessment or an outcome.</p><Button type="button" onClick={() => { dispatch({ type: 'techAck', id: r.id, by: user.id }); toast.success(`${r.id} acknowledged`); }}>Acknowledge this referral</Button></div>
          ) : r.status === 'ACKNOWLEDGED' ? (
            <div className="adv-form"><p>Acknowledged by {findStaff(r.assignee)?.name}. Start the assessment when the technical work begins.</p><Button type="button" onClick={() => { dispatch({ type: 'techStart', id: r.id, by: user.id }); toast.success('Assessment started'); }}>Start assessment</Button></div>
          ) : (
            <form className="adv-form" onSubmit={(e) => { e.preventDefault(); if (mayDetermine ? detOk : assessOk) setConfirm(mayDetermine ? 'determine' : 'assess'); }}>
              {needAssessment && (
                <>
                  <fieldset className="adv-f"><legend>Assessment: recommendation</legend>
                    {Object.entries(RECOMMENDATION).map(([v, l]) => <label key={v} className="st-radio"><input type="radio" name="rec" checked={rec === v} onChange={() => setRec(v)} /> {l}</label>)}
                  </fieldset>
                  <label className="adv-f"><span>Findings, in plain language</span><textarea rows={4} value={advice} onChange={(e) => setAdvice(e.target.value)} /></label>
                  <label className="adv-f"><span>When does this assessment apply?</span><input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="So it is reused only where it fits" /></label>
                  <fieldset className="adv-f"><legend>Records referred to</legend>
                    {certs.map((c) => <label key={c.id} className="st-radio"><input type="checkbox" checked={attach.includes(c.id)} onChange={() => setAttach((a) => (a.includes(c.id) ? a.filter((x) => x !== c.id) : [...a, c.id]))} /> {c.id}</label>)}
                  </fieldset>
                </>
              )}
              {mayDetermine ? (
                <fieldset className="adv-f adv-det"><legend>Determination <span className="proposed">authorised role</span></legend>
                  {outcomes.map((o) => <label key={o} className="st-radio"><input type="radio" name="out" checked={outcome === o} onChange={() => setOutcome(o)} /> {DETERMINATION[o]}</label>)}
                  <label className="adv-f"><span>Rationale (required, recorded with the decision)</span><textarea rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} /></label>
                  <Button type="submit" disabled={!detOk}>Issue determination</Button>
                  <small>Authority to withdraw enforcement is shown here for discussion. In this prototype it only notifies Revenue NSW (simulated) and changes no evidence.</small>
                </fieldset>
              ) : (
                <>
                  {needAssessment && <Button type="submit" disabled={!assessOk}>Record assessment and recommendation</Button>}
                  <p className="st-muted">A determination, including authorising withdrawal, needs an authorised Transport role (program manager or technical assurance manager). Your recommendation goes to them.</p>
                </>
              )}
              <label className="adv-f"><span>Or ask Revenue NSW for more information</span><input value={clar} onChange={(e) => setClar(e.target.value)} /></label>
              <div className="st-row">
                <Button type="button" variant="outline" size="sm" disabled={clar.trim().length < 5} onClick={() => { dispatch({ type: 'techClarify', id: r.id, by: user.id, text: clar.trim() }); setClar(''); toast.success('Question sent to Revenue NSW'); }}>Request clarification</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { dispatch({ type: 'techEscalate', id: r.id, by: user.id }); toast.info('Escalated internally (simulated)'); }}>Escalate internally</Button>
              </div>
              {siblings.length > 0 && <div className="st-row"><select aria-label="Related referral" value={link} onChange={(e) => setLink(e.target.value)}><option value="">Link related issue…</option>{siblings.map((x) => <option key={x.id} value={x.id}>{x.id} · {categoryLabel(x.category)}</option>)}</select>
                <Button type="button" variant="outline" size="sm" disabled={!link} onClick={() => { dispatch({ type: 'techNote', id: r.id, by: user.id, text: `Linked related issue ${link}` }); setLink(''); toast.success('Linked'); }}>Link</Button></div>}
            </form>
          )}
        </section>
      </div>
      {confirm === 'assess' && (
        <Dialog title="Record this assessment?" onClose={() => setConfirm(null)}>
          <p>{RECOMMENDATION[rec]}.</p><p>This is a recommendation, not a determination. An authorised Transport role still has to decide, and Revenue NSW will be told it is under assessment.</p>
          <div className="dlg-actions"><Button variant="outline" onClick={() => setConfirm(null)}>Not yet</Button><Button disabled={busy} onClick={doAssess}>Record assessment</Button></div>
        </Dialog>
      )}
      {confirm === 'determine' && (
        <Dialog title="Issue this determination?" onClose={() => setConfirm(null)}>
          <p><strong>{DETERMINATION[outcome]}.</strong></p><p>{rationale}</p>
          <p>Revenue NSW will be told so it can carry out its downstream steps (simulated). The original evidence is not changed. Do not treat this as final in the real world: the formal record is kept in the agency’s own system.</p>
          <div className="dlg-actions"><Button variant="outline" onClick={() => setConfirm(null)}>Not yet</Button><Button disabled={busy} onClick={doDetermine}>Issue determination</Button></div>
        </Dialog>
      )}
      <p className="st-hint"><Link to="/staff/requests">← Referrals</Link>{k && <> · <button type="button" className="st-link" onClick={() => go(`/staff/case/${k.id}`)}>Open Revenue matter {k.id} (read only, customer details withheld)</button></>}</p>
    </div>
  );
}
