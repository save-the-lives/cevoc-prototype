import { useStore } from '../../lib/store.jsx';
import { useNow } from '../../lib/useNow.js';
import { human } from '../../lib/workflow.js';

const STALE_AFTER_MS = 10 * 60000; // beyond ten minutes without an update, say so

// "Last updated" for a live view. This prototype simulates the feed: the label says so, and goes amber when the
// presenter pauses it or it has been quiet too long.
export default function LiveStatus() {
  const { state, dispatch } = useStore();
  useNow();
  const age = Date.now() - state.lastRefresh;
  const stale = state.feedPaused || age > STALE_AFTER_MS;
  const t = new Date(state.lastRefresh).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  return (
    <div className={`live ${stale ? 'is-stale' : ''}`} role="status">
      <span className="live-dot" aria-hidden="true" />
      <span>{stale ? <strong>Out of date.</strong> : 'Live view (simulated).'} Last updated {t}{age > 60000 ? `, ${human(age)} ago` : ''}.{state.feedPaused ? ' The feed is paused.' : stale ? ' Refresh to be sure.' : ''}</span>
      <button type="button" className="live-btn" onClick={() => dispatch({ type: 'refresh' })} aria-label="Refresh the view now">↻ Refresh</button>
    </div>
  );
}
