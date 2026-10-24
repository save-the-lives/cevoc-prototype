import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Tag } from '@nswds/ui';
import { Dialog, Link } from '../../shared/ui.jsx';
import { go } from '../../lib/router.js';
import { fmtDate } from '../../lib/format.js';
import { useStore } from '../../lib/store.jsx';
import { CERTS, kase as findCase, notice as findNotice, site as findSite, staff as findStaff, PROGRAMS } from '../../data.js';
import { REQUEST_STATUS, RECOMMENDATION, categoryLabel, impactLevel } from '../../lib/workflow.js';
import EvidenceViewer from '../queue/EvidenceViewer.jsx';
import CertPanel from '../queue/CertPanel.jsx';
import { dueOf } from './TechInbox.jsx';

// Technical workbench. Left: the question and the evidence. Centre: this camera's technical records.
// Right: findings and the response that goes back to Revenue NSW. Transport advises; it cannot decide the customer's case.
export default function TechRequest({ id, user, slots }) {
  const { state, dispatch } = useStore();
  const r = state.tech.find((x) => x.id === id);
  const [rec, setRec] = useState('');
  const [advice, setAdvice] = useState('');
  const [scope, setScope] = useState('');
  const [attach, setAttach] = useState([]);
  const [clar, setClar] = useState('');
  const [link, setLink] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!r) return <p>Technical request {id} not found. <Link to="/staff/requests">Back to technical requests</Link></p>;
  const n = findNotice(r.notice);
  if (!n) return <p>The notice for {id} is not on record. <Link to="/staff/requests">Back to technical requests</Link></p>;
  const s = findSite(r.site);
  const k = findCase(r.caseId);
  const impact = impactLevel(r, state.tech);
  const mayAnswer = user.perms.includes('inspect:request');
  const open = r.status === 'AWAITING_TRANSPORT';
  const siblings = state.tech.filter((x) => x.site === r.site && x.id !== r.id);
  const certs = CERTS.filter((c) => c.site === r.site);
  const ready = rec && advice.trim().length >= 20 && scope.trim().length >= 10;
  const { Metadata, plan } = slots;

  const send = () => {
    if (busy) return;
    setBusy(true);
    dispatch({ type: 'techRespond', id: r.id, response: { by: user.id, at: new Date().toISOString().slice(0, 10), recommendation: rec, advice: advice.trim(), scope: scope.trim(), attachments: attach } });
    toast.success(`Advice returned to Revenue NSW for ${r.caseId}`);
    setConfirm(false); setBusy(false);
  };

  return (
    <div className="tr">
      <div className="st-rec-head"><span className="st-type">Technical request</span><h1>{r.id}</h1>
        <Tag size="sm" color={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Tag>
        <Tag size="sm" color={impact === 'Systemic' ? 'danger' : impact === 'Multiple' ? 'warning' : 'grey'}>{impact}</Tag>
        <span className="st-muted">{categoryLabel(r.category)} · {s.code} · due {fmtDate(dueOf(r))}</span></div>
      <p className="st-muted tr-owner"><span className="owner-tag">Revenue NSW</span> decides the customer’s case {r.caseId}. Your advice goes back to them; you cannot uphold or withdraw the fine here.</p>
      <div className="tr-panes">
        <section className="tr-pane" aria-label="Problem and evidence">
          <h2>Problem</h2>
          <blockquote className="st-quote">“{r.question}”<cite>{findStaff(r.by)?.name}, Revenue NSW · case {r.caseId} · {fmtDate(r.at)}</cite></blockquote>
          {k && <p className="st-muted">The customer’s concern: “{k.grounds}”</p>}
          {r.thread.map((t, i) => <p key={i} className="tr-thread"><strong>{findStaff(t.by)?.name}</strong> {t.internal ? '(internal note)' : ''}: {t.text}</p>)}
          <h3>Infringement evidence</h3>
          <EvidenceViewer items={n.media} program={s.program} />
          <dl className="st-facts"><div><dt>Notice</dt><dd><Link to={`/staff/notice/${n.number}`}>{n.number}</Link></dd></div><div><dt>Camera</dt><dd>{PROGRAMS[s.program].label}, {s.name}</dd></div></dl>
        </section>
        <section className="tr-pane" aria-label="Technical records">
          <h2>Camera records</h2>
          <CertPanel n={n} />
          {n.segment && <div className="st-card"><h3>Calculation</h3><p>{n.segment.distanceKm} km between points, {n.segment.timeA} to {n.segment.timeB}. Reported average {n.speed} km/h.</p></div>}
          {n.redFor && <div className="st-card"><h3>Calculation</h3><p>Light had been red for {n.redFor} s when the vehicle crossed at {n.speed} km/h.</p></div>}
          {Metadata && <Metadata n={n} fault={plan?.meta} />}
          <h3>Related at this camera</h3>
          {siblings.length ? <ul className="st-list">{siblings.map((x) => <li key={x.id}><Link to={`/staff/request/${x.id}`}>{x.id}</Link> · {categoryLabel(x.category)} · {REQUEST_STATUS[x.status].label}</li>)}</ul> : <p className="st-muted">No other requests for {s.code}.</p>}
        </section>
        <section className="tr-pane" aria-label="Findings and response">
          <h2>Response to Revenue NSW</h2>
          {r.response ? (
            <div className="adv adv--advice_received">
              <p><strong>{RECOMMENDATION[r.response.recommendation]}</strong></p>
              <p>{r.response.advice}</p>
              <p className="st-muted">Applies when: {r.response.scope}</p>
              {r.response.attachments?.length > 0 && <p className="st-muted">Attached: {r.response.attachments.join(', ')}</p>}
              <p className="st-muted">{findStaff(r.response.by)?.name} · {fmtDate(r.response.at)} · returned to case {r.caseId}</p>
            </div>
          ) : r.status === 'CANCELLED' ? <p className="st-muted">Revenue NSW cancelled this request.</p>
          : r.status === 'MORE_INFORMATION_REQUIRED' ? <p className="st-muted">Waiting for Revenue NSW to reply to your question.</p>
          : !mayAnswer ? <p className="st-muted">Transport camera operations answers technical requests.</p>
          : (
            <form className="adv-form" onSubmit={(e) => { e.preventDefault(); if (ready) setConfirm(true); }}>
              {!r.assignee && <Button type="button" size="sm" variant="outline" onClick={() => dispatch({ type: 'techAssign', id: r.id, to: user.id, by: user.id })}>Pick up this request</Button>}
              <fieldset className="adv-f"><legend>Recommendation</legend>
                {Object.entries(RECOMMENDATION).map(([v, l]) => <label key={v} className="st-radio"><input type="radio" name="rec" checked={rec === v} onChange={() => setRec(v)} /> {l}</label>)}
              </fieldset>
              <label className="adv-f"><span>Findings, in plain language for Revenue NSW</span><textarea rows={5} value={advice} onChange={(e) => setAdvice(e.target.value)} /></label>
              <label className="adv-f"><span>When does this advice apply?</span><input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="So Revenue NSW can reuse it only where it fits" /></label>
              <fieldset className="adv-f"><legend>Attach records</legend>
                {certs.map((c) => <label key={c.id} className="st-radio"><input type="checkbox" checked={attach.includes(c.id)} onChange={() => setAttach((a) => (a.includes(c.id) ? a.filter((x) => x !== c.id) : [...a, c.id]))} /> {c.id}</label>)}
              </fieldset>
              <Button type="submit" disabled={!ready}>Provide advice</Button>
              <label className="adv-f"><span>Or ask Revenue NSW for more information</span><input value={clar} onChange={(e) => setClar(e.target.value)} /></label>
              <div className="st-row">
                <Button type="button" variant="outline" size="sm" disabled={clar.trim().length < 5} onClick={() => { dispatch({ type: 'techClarify', id: r.id, by: user.id, text: clar.trim() }); setClar(''); toast.success('Question sent to Revenue NSW'); }}>Request clarification</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { dispatch({ type: 'techNote', id: r.id, by: user.id, text: 'Escalated internally to the camera program manager (simulated)' }); toast.info('Escalated internally (simulated)'); }}>Escalate internally</Button>
              </div>
              {siblings.length > 0 && <div className="st-row"><select aria-label="Related request" value={link} onChange={(e) => setLink(e.target.value)}><option value="">Link related issue…</option>{siblings.map((x) => <option key={x.id} value={x.id}>{x.id} · {categoryLabel(x.category)}</option>)}</select>
                <Button type="button" variant="outline" size="sm" disabled={!link} onClick={() => { dispatch({ type: 'techNote', id: r.id, by: user.id, text: `Linked related issue ${link}` }); setLink(''); toast.success('Linked'); }}>Link</Button></div>}
            </form>
          )}
        </section>
      </div>
      {confirm && (
        <Dialog title="Send advice to Revenue NSW?" onClose={() => setConfirm(false)}>
          <p>{RECOMMENDATION[rec]}.</p><p>This goes to {findStaff(r.by)?.name} for case {r.caseId}. Revenue NSW then makes the decision for the customer.</p>
          <div className="dlg-actions"><Button variant="outline" onClick={() => setConfirm(false)}>Not yet</Button><Button disabled={busy} onClick={send}>Send advice</Button></div>
        </Dialog>
      )}
      <p className="st-hint"><Link to="/staff/requests">← Technical requests</Link>{k && <> · <button type="button" className="st-link" onClick={() => go(`/staff/case/${k.id}`)}>Open Revenue case {k.id} (read only)</button></>}</p>
    </div>
  );
}
