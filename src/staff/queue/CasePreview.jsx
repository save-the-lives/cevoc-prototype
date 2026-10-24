import { Button, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, Tag } from '@nswds/ui';
import { go } from '../../lib/router.js';
import { fmtDate } from '../../lib/format.js';
import { staff as findStaff } from '../../data.js';

// Quick view flyout: enough to triage a case without leaving the queue.
export default function CasePreview({ row, onClose, canAssign, onAssignMe }) {
  const open = !!row;
  const { c, n, ev, program, sla, assignee } = row || {};
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="st-sheet">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle>{c.id} · {c.type === 'court' ? 'Court election' : 'Review'}</SheetTitle>
              <SheetDescription>{n.holder} · notice {n.number}</SheetDescription>
            </SheetHeader>
            <div className="st-sheet__body">
              <div className="st-sheet__tags">
                <Tag size="sm" color={sla.tone === 'grey' ? 'grey' : sla.tone}>{sla.label}</Tag>
                <Tag size="sm" color={ev.current ? 'success' : 'warning'}>{ev.current ? 'Certification current' : `${ev.notCurrent} not current`}</Tag>
              </div>
              <blockquote className="st-quote">“{c.grounds}”<cite>{n.holder} · {c.channel}</cite></blockquote>
              {n.media[0]?.type === 'image' && <img className="st-sheet__img" src={n.media[0].src} alt={n.media[0].caption} />}
              <dl className="st-kv">
                <div><dt>Program</dt><dd>{program}</dd></div>
                <div><dt>Offence</dt><dd>{n.offence}</dd></div>
                <div><dt>Lodged</dt><dd>{fmtDate(c.lodged)}</dd></div>
                <div><dt>Response due</dt><dd>{fmtDate(sla.due)}</dd></div>
                <div><dt>Assigned to</dt><dd>{assignee ? findStaff(assignee)?.name : 'Unassigned'}</dd></div>
              </dl>
              <h3 className="st-sheet__h">Certificates on the day</h3>
              <ul className="st-sheet__certs">
                {ev.items.map((i) => (
                  <li key={i.req.label} className={i.current ? '' : 'is-bad'}>
                    <span aria-hidden="true">{i.current ? '✓' : '!'}</span>
                    <span><strong>{i.req.label}</strong><small>{i.cert ? `${i.cert.id} · ${i.age === 0 ? 'same day' : `${i.age} days before`}` : i.why}</small></span>
                  </li>
                ))}
              </ul>
            </div>
            <SheetFooter>
              {canAssign && assignee !== undefined && <Button variant="outline" onClick={() => onAssignMe(row)}>Assign to me</Button>}
              <Button onClick={() => { onClose(); go(`/staff/case/${c.id}`); }}>Open case</Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
