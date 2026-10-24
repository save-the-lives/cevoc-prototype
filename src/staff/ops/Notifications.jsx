import { Popover, PopoverContent, PopoverTrigger } from '@nswds/ui';
import { useStore } from '../../lib/store.jsx';
import { useNow } from '../../lib/useNow.js';
import { go } from '../../lib/router.js';
import { human } from '../../lib/workflow.js';

export const eventsFor = (state, agency) => state.events.filter((e) => e.to.includes(agency));

// Simulated notifications for this agency. Unread ones are counted; urgent ones are marked in words, not only colour.
export default function Notifications({ agency }) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const list = eventsFor(state, agency);
  const unread = list.filter((e) => e.at > state.seen[agency]).length;
  return (
    <Popover onOpenChange={(o) => { if (!o && unread) dispatch({ type: 'seen', agency }); }}>
      <PopoverTrigger render={<button type="button" className="st-bell" aria-label={`Notifications, ${unread} unread`}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" /></svg>
        {unread > 0 && <b aria-hidden="true">{unread}</b>}
      </button>} />
      <PopoverContent align="end" className="st-notes">
        <p className="st-cols__h">Notifications <small>(simulated)</small></p>
        {list.length ? <ul>{list.slice(0, 8).map((e) => (
          <li key={e.id} className={e.at > state.seen[agency] ? 'is-new' : ''}>
            <button type="button" onClick={() => e.link && go(e.link)}>
              {e.urgent && <span className="st-note-u">Action: </span>}{e.text}<small>{human(now - e.at)} ago</small>
            </button>
          </li>))}</ul> : <p className="st-muted">Nothing yet.</p>}
      </PopoverContent>
    </Popover>
  );
}
