import { Button, Kbd, Tag } from '@nswds/ui';
import { go } from '../../lib/router.js';
import { fmtDate } from '../../lib/format.js';
import { staff as findStaff } from '../../data.js';

// Quick view docked beside the queue. It never dims the list, and j/k step through the cases while it is open.
export default function CasePreview({ row, index, total, onPrev, onNext, onClose, canAssign, onAssignMe }) {
  const { c, n, ev, program, sla, assignee } = row;
  return (
    <aside className="st-dock" aria-label={`Quick view of case ${c.id}`}>
      <header className="st-dock__head">
        <div>
          <h2>{c.id} · {c.type === 'court' ? 'Court election' : 'Review'}</h2>
          <p>{n.holder} · notice {n.number}</p>
        </div>
        <div className="st-dock__nav">
          <button type="button" onClick={onPrev} disabled={index === 0} aria-label="Previous case (k)" title="Previous case (k)">↑</button>
          <button type="button" onClick={onNext} disabled={index === total - 1} aria-label="Next case (j)" title="Next case (j)">↓</button>
          <button type="button" onClick={onClose} aria-label="Close quick view (Esc)" title="Close (Esc)">✕</button>
        </div>
      </header>
      <div className="st-dock__pos">Case {index + 1} of {total} · <Kbd>j</Kbd> next · <Kbd>k</Kbd> previous · <Kbd>Esc</Kbd> close</div>
      <div className="st-dock__body">
        <div className="st-dock__tags">
          <Tag size="sm" color={sla.tone}>Waiting {sla.label}</Tag>
          <Tag size="sm" color={ev.current ? 'success' : 'warning'}>{ev.current ? 'Certification current' : `${ev.notCurrent} not current`}</Tag>
        </div>
        <blockquote className="st-quote">“{c.grounds}”<cite>{n.holder} · {c.channel}</cite></blockquote>
        {n.media[0]?.type === 'image' && <img className="st-dock__img" src={n.media[0].src} alt={n.media[0].caption} />}
        <dl className="st-kv">
          <div><dt>Program</dt><dd>{program}</dd></div>
          <div><dt>Offence</dt><dd>{n.offence}</dd></div>
          <div><dt>Asked on</dt><dd>{fmtDate(c.lodged)} ({sla.waited === 0 ? 'today' : `${sla.label} ago`})</dd></div>
          <div><dt>Target reply</dt><dd>{fmtDate(sla.due)}<small className="st-sub">{sla.hint}</small></dd></div>
          <div><dt>Assigned to</dt><dd>{assignee ? findStaff(assignee)?.name : 'Unassigned'}</dd></div>
        </dl>
        <h3 className="st-dock__h">Certificates on the day</h3>
        <ul className="st-dock__certs">
          {ev.items.map((i) => (
            <li key={i.req.label} className={i.current ? '' : 'is-bad'}>
              <span aria-hidden="true">{i.current ? '✓' : '!'}</span>
              <span><strong>{i.req.label}</strong><small>{i.cert ? `${i.cert.id} · ${i.age === 0 ? 'same day' : `${i.age} days before`}` : i.why}</small></span>
            </li>
          ))}
        </ul>
      </div>
      <footer className="st-dock__foot">
        {canAssign && <Button size="sm" variant="outline" onClick={() => onAssignMe(row)}>Assign to me</Button>}
        <Button size="sm" onClick={() => go(`/staff/case/${c.id}`)}>Open case</Button>
      </footer>
    </aside>
  );
}
