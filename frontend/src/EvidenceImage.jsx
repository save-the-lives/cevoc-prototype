import { Component, Suspense, lazy, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ExpiredContext } from './expired.js';
import { QueueContext } from './evidenceLoader.js';
import { STATE } from './loadQueue.js';
import { downloadHref, linkExpired, stagesFor } from './media.js';
import GalleryPhoto from './GalleryPhoto.jsx';

// The zoom and pan viewer is its own chunk: it is fetched when someone opens a photo (or points at the button).
const loadViewer = () => import('./ZoomPan.jsx');

/** Catches a viewer that failed to load (a stale page after a new release, a dropped connection) and says so. */
class ViewerBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(prev) { if (prev.attempt !== this.props.attempt && this.state.failed) this.setState({ failed: false }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="notice-box" role="alert">
        <p>The zoom viewer could not load. Your connection may have dropped, or this page is out of date.</p>
        <p>
          <button type="button" className="btn" onClick={this.props.onRetry}>Try again</button>{' '}
          <button type="button" className="linklike" onClick={() => window.location.reload()}>Reload the page</button>
        </p>
      </div>
    );
  }
}

/** A retry asks for the file again instead of reusing a failed or cached answer. */
function bust(url, tries) {
  return tries > 0 ? `${url}${url.includes('?') ? '&' : '?'}r=${tries}` : url;
}

function preload(url, keep) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    keep.push(img);
    img.onload = () => { (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(resolve); };
    img.onerror = () => reject(new Error('image'));
    img.src = url;
  });
}

/**
 * Closed: the thumbnail only (lazy, async-decoded, with its size set so nothing shifts). Opened: the zoom viewer, which
 * steps up through the medium copy to the original at full resolution, one size at a time.
 */
export default function EvidenceImage({ item }) {
  const stages = stagesFor(item);
  const key = stages.join('|');
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(0);
  const levelRef = useRef(0);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [tries, setTries] = useState(0);
  const [broken, setBroken] = useState(false); // the picture on the page could not be loaded
  const [expired, setExpired] = useState(false);
  const [viewerTry, setViewerTry] = useState(0);
  const rerun = useContext(ExpiredContext);
  const q = useContext(QueueContext);
  const [full, setFull] = useState(() => q?.queue.state(item.url) ?? STATE.IDLE);
  useEffect(() => {
    if (!q) return undefined;
    const sync = () => setFull(q.queue.state(item.url) ?? STATE.IDLE);
    sync();
    return q.queue.subscribe(sync);
  }, [q, item.url]);
  const eagerThumb = !q || q.eager.includes(item.url);
  const photos = q?.photos;
  const gallery = photos && photos.length > 1
    ? { count: photos.length, index: Math.max(0, photos.findIndex((p) => p.url === item.url)), render: (i) => <GalleryPhoto key={photos[i].url} item={photos[i]} /> }
    : undefined;
  const Viewer = useMemo(() => lazy(loadViewer), [viewerTry]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    if (q && stages.length > 1) q.queue.prioritize(item.url);
    if (full === STATE.READY && levelRef.current < stages.length - 1) { levelRef.current = stages.length - 1; setLevel(stages.length - 1); setStatus('ready'); return undefined; }
    let live = true;
    const kept = [];
    (async () => {
      setStatus(levelRef.current + 1 < stages.length ? 'loading' : 'ready');
      for (let i = levelRef.current + 1; i < stages.length; i += 1) {
        try { await preload(bust(stages[i], tries), kept); } catch { if (live) setStatus('error'); return; }
        if (!live) return;
        levelRef.current = i;
        setLevel(i);
      }
      if (live) setStatus('ready');
    })();
    return () => { live = false; kept.forEach((im) => { im.onload = null; im.onerror = null; }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tries, key]);

  const src = bust(stages[Math.min(level, stages.length - 1)], tries);
  const href = downloadHref(item);
  const alt = item.alt || item.title;
  const img = (
    <img className="media-img" src={src} alt={alt} width={item.width || undefined} height={item.height || undefined}
      loading={open || eagerThumb ? 'eager' : 'lazy'} fetchPriority={eagerThumb ? 'high' : 'auto'} decoding="async" draggable="false"
      onError={() => { q?.thumbDone(item.url); setBroken(true); linkExpired(src).then((gone) => { if (gone) setExpired(true); }); }} onLoad={() => { setBroken(false); q?.thumbDone(item.url); }} />
  );

  return (
    <div className="media-body">
      {open
        ? <ViewerBoundary attempt={viewerTry} onRetry={() => setViewerTry((n) => n + 1)}>
            <Suspense fallback={<div className="media-frame">{img}</div>}><Viewer label={`${item.title}, image`} gallery={gallery}>{img}</Viewer></Suspense>
          </ViewerBoundary>
        : <div className="media-frame" style={{ aspectRatio: '16 / 10' }}>{img}</div>}
      {!open && (
        <button type="button" className="btn zoom-open" onClick={() => setOpen(true)} onPointerEnter={loadViewer} onFocus={loadViewer}>
          Zoom in<span className="sr-only"> on {item.title}</span>
        </button>
      )}
      {q && stages.length > 1 && !open && (
        <p className="media-progress" aria-live="polite">
          {full === STATE.READY ? 'Full size ready' : full === STATE.LOADING ? <><span className="spin" aria-hidden="true" />Loading full size…</> : full === STATE.ERROR ? 'Full size not loaded yet' : 'Full size waiting'}
        </p>
      )}
      <p className="media-status" role="status">
        {open && status === 'loading' && <><span className="spin" aria-hidden="true" />Loading a sharper copy...</>}
        {expired && (
          <>
            These photos expired. {rerun ? <button type="button" className="btn" onClick={rerun}>Run the check again</button> : 'Run the check again.'}
          </>
        )}
        {!expired && (broken || (open && status === 'error')) && (
          <>
            {!broken && stages.length > 1 && level > 0 ? 'Showing a lower quality copy. ' : 'This image could not be loaded. '}
            <button type="button" className="linklike" onClick={() => { setBroken(false); setTries((t) => t + 1); }}>Try again</button>
          </>
        )}
      </p>
      {href && <a className="dl" href={href} download>Download original<span className="sr-only"> of {item.title}</span></a>}
    </div>
  );
}
