import { Avatar, AvatarFallback, Tag } from '@nswds/ui';
import { staff as findStaff } from '../../data.js';
import { PRIORITY } from './sla.js';

const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2);

// The queue while a case is open: a slim list you can move through with j and k.
export default function CaseRail({ rows, cursor, onSelect }) {
  return (
    <nav className="st-rail" aria-label="Cases in this queue">
      <ul>
        {rows.map((r, i) => (
          <li key={r.c.id}>
            <button type="button" className={`st-rail__item ${i === cursor ? 'is-on' : ''} ${r.decision ? 'is-done' : ''}`} aria-current={i === cursor ? 'true' : undefined} onClick={() => onSelect(i)}>
              <span className={`st-rail__pri is-${r.c.priority}`} title={`${PRIORITY[r.c.priority].label} priority`} aria-label={`${PRIORITY[r.c.priority].label} priority`} />
              <span className="st-rail__main">
                <strong>{r.decision ? '✓ ' : ''}{r.c.id}</strong>
                <span>{r.n.holder}</span>
                <small>{r.program}</small>
              </span>
              <span className="st-rail__side">
                <Tag size="sm" color={r.sla.tone}>{r.sla.label}</Tag>
                {!r.ev.current && <em className="st-rail__risk" title={`${r.ev.notCurrent} certification risk`}>! {r.ev.notCurrent}</em>}
                {r.assignee && <Avatar><AvatarFallback>{initials(findStaff(r.assignee).name)}</AvatarFallback></Avatar>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
