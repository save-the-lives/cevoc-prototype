import { useContext, useEffect, useState } from 'react';
import { ExpiredContext } from './expired.js';
import { QueueContext, loadImage } from './evidenceLoader.js';
import { STATE } from './loadQueue.js';
import { linkExpired, stagesFor } from './media.js';

/**
 * One photo inside the full-screen viewer. Shows the small copy with a progress overlay at once, asks the load queue to fetch
 * the original ahead of everything else, and swaps it in when it lands. A failure offers Try again (or a re-run if the link expired).
 */
export default function GalleryPhoto({ item }) {
  const q = useContext(QueueContext);
  const rerun = useContext(ExpiredContext);
  const stages = stagesFor(item);
  const [status, setStatus] = useState(q?.queue.state(item.url) === STATE.READY ? 'ready' : 'loading'); // loading | ready | error
  const [expired, setExpired] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    const done = (ok) => {
      if (!live) return;
      setStatus(ok ? 'ready' : 'error');
      if (!ok) linkExpired(item.url).then((gone) => live && setExpired(gone));
    };
    if (q) {
      setStatus(q.queue.state(item.url) === STATE.READY ? 'ready' : 'loading');
      q.queue.prioritize(item.url).then(() => done(q.queue.state(item.url) === STATE.READY));
    } else {
      setStatus('loading');
      loadImage(item.url, 'high').then(() => done(true), () => done(false));
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.url, tries]);

  const src = status === 'ready' ? item.url : stages[0];
  return (
    <div className="gp">
      {status === 'ready' || stages.length > 1
        ? <img className="media-img" src={src} alt={item.alt || item.title} draggable="false" decoding="async" />
        : <div className="media-ph" />}
      {status === 'loading' && <div className="media-overlay" role="status"><span><span className="spin" aria-hidden="true" />Loading photo...</span></div>}
      {status === 'error' && (
        <div className="media-overlay gp-err" role="alert">
          <div>
            {expired ? 'These photos expired.' : 'This photo could not be shown.'}{' '}
            {expired && rerun
              ? <button type="button" className="btn" onClick={rerun}>Run the check again</button>
              : <button type="button" className="btn" onClick={() => setTries((t) => t + 1)}>Try again</button>}
          </div>
        </div>
      )}
    </div>
  );
}
