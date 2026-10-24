import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Tag } from '@nswds/ui';
import { Dialog, Link } from '../../shared/ui.jsx';
import { useStore } from '../../lib/store.jsx';
import { TECH_CATEGORIES, staff as findStaff, site as findSite } from '../../data.js';
import { REQUEST_STATUS, RECOMMENDATION, activeRequest, categoryLabel, isLive, relatedAdvice, requestsFor } from '../../lib/workflow.js';
import { Lifecycle, RequestMeta } from '../tech/Lifecycle.jsx';
import { fmtDate } from '../../lib/format.js';

const nextId = (tech) => `TR-${Math.max(3000, ...tech.map((r) => Number(r.id.slice(3)) || 0)) + 1}`;

// Earlier answered advice for the same camera. Offered to read and judge: it never closes anything by itself.
export function RelatedAdvice({ site, caseId, onUse }) {
  const { state } = useStore();
  const list = relatedAdvice(state.tech, site, caseId);
  if (!list.length) return null;
  return (
    <details className="adv-rel">
      <summary><strong>Potentially related technical advice available</strong> <span>{list.length} answered request{list.length > 1 ? 's' : ''} for this camera. Check it before asking again.</span></summary>
      {list.map((r) => (
        <div key={r.id} className="adv-rel__item">
          <p><Tag size="sm" color="grey">{categoryLabel(r.category)}</Tag> <Link to={`/staff/request/${r.id}`}>{r.id}</Link> · answered {fmtDate(r.response.at)} by {findStaff(r.response.by)?.name}</p>
          <p><strong>Question:</strong> {r.summary}</p>
          <p><strong>Advice:</strong> {r.response.advice}</p>
          <p><strong>Applies when:</strong> {r.response.scope}</p>
          {onUse && <Button size="sm" variant="outline" onClick={() => onUse(`Per Transport technical advice ${r.id}: ${r.response.advice}`)}>Use it as the reason, then edit</Button>}
          <p className="st-muted">Only use this if the circumstances of this case match. You make the decision.</p>
        </div>
      ))}
    </details>
  );
}

function RequestForm({ k, n, ev, user, onClose }) {
  const { state, dispatch } = useStore();
  const s = findSite(n.site);
  const [cat, setCat] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = cat && text.trim().length >= 20;
  const risks = ev.items.filter((i) => !i.current).map((i) => `${i.req.label}${i.why ? ` (${i.why})` : ''}`);
  const submit = (e) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    const id = nextId(state.tech);
    dispatch({ type: 'techRequest', req: { id, caseId: k.id, notice: n.number, site: n.site, category: cat, by: user.id, assignee: null, at: new Date().toISOString().slice(0, 10), summary: text.trim().split(/[.?!]\s/)[0].slice(0, 110), question: text.trim(), status: 'AWAITING_TRANSPORT', thread: [], log: [{ at: Date.now(), type: 'requested', by: user.id }] } });
    toast.success(`Technical request ${id} sent to Transport. You still own ${k.id}.`);
    onClose();
  };
  return (
    <Dialog title="Request technical advice" onClose={onClose} wide>
      <form className="adv-form" onSubmit={submit}>
        <p className="st-muted">This does not decide the case. {k.id} stays with you while Transport answers, and you make the final decision.</p>
        <label className="adv-f"><span>What kind of technical question is it?</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)} required>
            <option value="">Choose…</option>
            {TECH_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <RelatedAdvice site={n.site} caseId={k.id} />
        <label className="adv-f"><span>What exactly do you need Transport to tell you?</span>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask one specific question, e.g. “Was the inspection certificate valid at 17:20 on 2 September?”" />
          <small>{text.trim().length < 20 ? 'At least 20 characters.' : 'Good. Transport will see this word for word.'}</small>
        </label>
        <div className="adv-ctx">
          <strong>Sent with the request</strong>
          <ul>
            <li>Penalty notice ({n.number}) · {s.code} {s.name}</li>
            <li>Customer says: “{k.grounds}”</li>
            <li>{n.media.length} evidence item{n.media.length === 1 ? '' : 's'}</li>
            <li>{ev.current ? 'Certification checks clear' : `${ev.notCurrent} certification risk${ev.notCurrent > 1 ? 's' : ''}${risks.length ? `: ${risks.join('; ')}` : ''}`}</li>
          </ul>
        </div>
        <div className="dlg-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!ok || busy}>Send to Transport</Button></div>
      </form>
    </Dialog>
  );
}

// Where the case is with Transport, and what Revenue NSW can do next. Revenue keeps the case throughout.
export default function AdviceBlock({ k, n, ev, user, onUse }) {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState(false);
  const [reply, setReply] = useState('');
  const decided = !!state.decisions[k.id];
  const mayAsk = user.perms.includes('case:decide') && !decided;
  const req = activeRequest(state.tech, k.id);
  const all = requestsFor(state.tech, k.id);
  const who = (id) => (id ? findStaff(id)?.name : 'Not yet assigned');

  if (!req) {
    if (!mayAsk && decided) return null;
    return (
      <div className="adv">
        <RelatedAdvice site={n.site} caseId={k.id} onUse={mayAsk ? onUse : undefined} />
        {mayAsk && <div className="adv-ask"><Button size="sm" variant="outline" onClick={() => setForm(true)}>Request technical advice…</Button><span className="st-muted">Only if you can’t resolve it from the evidence.</span></div>}
        {form && <RequestForm k={k} n={n} ev={ev} user={user} onClose={() => setForm(false)} />}
      </div>
    );
  }
  const st = REQUEST_STATUS[req.status];
  return (
    <div className={`adv adv--${req.status.toLowerCase()}`} role="region" aria-label="Technical advice">
      <p className="adv-head"><strong>{req.status === 'ADVICE_RECEIVED' ? 'Transport has advised. Your decision is needed' : req.status === 'MORE_INFORMATION_REQUIRED' ? 'Transport needs more information' : req.status === 'AWAITING_TRANSPORT' ? 'Requested: Transport has not acknowledged yet' : req.status === 'ACKNOWLEDGED' ? 'Acknowledged by Transport: not yet answered' : 'Transport is investigating: not yet answered'}</strong> <Tag size="sm" color={st.tone}>{st.label}</Tag> <Link to={`/staff/request/${req.id}`}>{req.id}</Link></p>
      <p className="st-muted">{categoryLabel(req.category)} · asked by {who(req.by)} · {k.id} stays with Revenue NSW</p>
      <Lifecycle req={req} decided={decided} compact />
      <RequestMeta req={req} decided={decided} />
      <p className="adv-q">“{req.question}”</p>
      {req.status === 'ADVICE_RECEIVED' && (
        <div className="adv-ans">
          <p><strong>{RECOMMENDATION[req.response.recommendation]}</strong></p>
          <p>{req.response.advice}</p>
          <p className="st-muted">Applies when: {req.response.scope}</p>
          {mayAsk && onUse && <Button size="sm" variant="outline" onClick={() => onUse(`Per Transport technical advice ${req.id}: ${req.response.advice}`)}>Use it as the reason, then edit</Button>}
        </div>
      )}
      {req.status === 'MORE_INFORMATION_REQUIRED' && (
        <form className="adv-reply" onSubmit={(e) => { e.preventDefault(); if (reply.trim().length < 5) return; dispatch({ type: 'techReply', id: req.id, by: user.id, text: reply.trim() }); setReply(''); toast.success('Reply sent to Transport'); }}>
          <p><strong>Transport asks:</strong> {req.thread[req.thread.length - 1]?.text}</p>
          {mayAsk ? <><label className="adv-f"><span>Your reply</span><input value={reply} onChange={(e) => setReply(e.target.value)} /></label><Button size="sm" type="submit" disabled={reply.trim().length < 5}>Send reply</Button></> : <p className="st-muted">Revenue NSW replies.</p>}
        </form>
      )}
      {mayAsk && isLive(req.status) && <Button size="sm" variant="ghost" onClick={() => { dispatch({ type: 'techCancel', id: req.id, by: user.id }); toast.info(`${req.id} cancelled`); }}>Cancel request</Button>}
      {all.length > 1 && <p className="st-muted">{all.length} requests on this case.</p>}
    </div>
  );
}
