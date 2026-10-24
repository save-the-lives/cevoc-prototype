import { Tag } from '@nswds/ui';
import { useStore } from '../../lib/store.jsx';
import { useNow } from '../../lib/useNow.js';
import { LIFECYCLE, REQUEST_STATUS, escalation, human, inStateSince, lastActivityAt, dueMs, nextRequired, requestedAt } from '../../lib/workflow.js';
import { staff as findStaff } from '../../data.js';
import { fmtDate } from '../../lib/format.js';

const LOGTYPE = ['requested', 'acknowledged', 'investigating', 'advice'];
const time = (ms) => new Date(ms).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Revenue request -> Transport acknowledgement -> Technical investigation -> Advice returned -> Revenue resolution.
// Both agencies see the same lifecycle. Acknowledged is deliberately a separate step from answered.
export function Lifecycle({ req, decided, compact }) {
  const cur = req.status === 'AWAITING_TRANSPORT' ? 1 : req.status === 'ADVICE_RECEIVED' ? (decided ? 5 : 4) : req.status === 'CANCELLED' ? -1 : 2;
  const stamp = (i) => { const l = req.log?.find((x) => x.type === LOGTYPE[i]); return l ? time(l.at) : ''; };
  if (req.status === 'CANCELLED') return <p className="lc-cancel">Cancelled by Revenue NSW. The lifecycle stopped before advice was returned.</p>;
  return (
    <ol className={`lc ${compact ? 'is-compact' : ''}`} aria-label="Request lifecycle">
      {LIFECYCLE.map((label, i) => {
        const done = i < cur || (i === 4 && cur === 5);
        const now = i === cur;
        const note = i === 2 && req.status === 'ACKNOWLEDGED' ? 'not started' : i === 2 && req.status === 'MORE_INFORMATION_REQUIRED' ? 'paused: waiting for Revenue NSW' : i === 4 && done ? 'decided' : '';
        return (
          <li key={label} className={done ? 'is-done' : now ? 'is-now' : ''} aria-current={now ? 'step' : undefined}>
            <span className="lc-dot" aria-hidden="true">{done ? '✓' : i + 1}</span>
            <span className="lc-t"><strong>{label}</strong><small>{done ? (stamp(i) || 'done') : now ? (note || 'current') : 'to come'}{done && note ? ` · ${note}` : ''}</small></span>
            <span className="sr-only">{done ? ' (done)' : now ? ' (current step)' : ' (not yet)'}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Owner, status, time in state, last activity, next action, target and escalation, in one place.
export function RequestMeta({ req, decided, owner }) {
  const { state } = useStore();
  const now = useNow();
  const esc = escalation(req, now, state.targets.tech);
  const next = nextRequired(req, decided);
  const st = REQUEST_STATUS[req.status];
  const who = (id) => findStaff(id)?.name || 'not yet assigned';
  const ownerText = req.status === 'ADVICE_RECEIVED' || req.status === 'MORE_INFORMATION_REQUIRED' ? `Revenue NSW (${who(req.by)})` : req.status === 'CANCELLED' ? 'None' : `Transport (${who(req.assignee)})`;
  return (
    <dl className="rm">
      <div><dt>Current owner</dt><dd>{owner || ownerText}</dd></div>
      <div><dt>Status</dt><dd><Tag size="sm" color={st.tone}>{st.label}</Tag></dd></div>
      <div><dt>Time in this state</dt><dd>{human(now - inStateSince(req))}</dd></div>
      <div><dt>Last activity</dt><dd>{human(now - lastActivityAt(req))} ago</dd></div>
      <div><dt>Next required action</dt><dd><strong>{next.who}:</strong> {next.text}</dd></div>
      <div><dt>Target response</dt><dd>{fmtDate(new Date(dueMs(req, state.targets.tech)).toISOString().slice(0, 10))}</dd></div>
      <div><dt>Escalation</dt><dd><Tag size="sm" color={esc.tone}>{esc.label}</Tag></dd></div>
    </dl>
  );
}
export { requestedAt };
