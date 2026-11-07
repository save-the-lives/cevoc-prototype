import { Component, Suspense, lazy, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ExpiredContext } from './expired.js';
import { QueueContext } from './evidenceLoader.js';
import { STATE } from './loadQueue.js';
import { downloadHref, linkExpired, stagesFor, timedOutLabel } from './media.js';
import GalleryPhoto from './GalleryPhoto.jsx';
import { makeDoubleTap, usePhone } from './phone.js';

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
  const phone = usePhone();
  const [startFull, setStartFull] = useState(false); // phones open straight into the full-screen dialog
  const expandRef = useRef(null);
  const refocus = useRef(false);
  const doubleTap = useMemo(() => makeDoubleTap(), []);
  const downAt = useRef(null);
  const openFull = () => { setStartFull(true); setOpen(true); };
  const exitFull = () => { refocus.current = true; setOpen(false); setStartFull(false); };
  useEffect(() => { if (!open && refocus.current) { refocus.current = false; expandRef.current?.focus(); } }, [open]);
  const { report } = useContext(ExpiredContext);
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
    ? { count: photos.length, index: Math.max(0, photos.findIndex((p) => p.url === item.url)), render: (i) => <GalleryPhoto key={photos[i].url} item={photos[i]} index={i} count={photos.length} /> }
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
      onError={() => { q?.thumbDone(item.url); setBroken(true); linkExpired(src).then((gone) => { if (gone) { setExpired(true); report(); } }); }} onLoad={() => { setBroken(false); q?.thumbDone(item.url); }} />
  );

  const timedOut = expired && !open;

  return (
    <div className="media-body">
      {timedOut
        ? <div className="media-expired" style={{ aspectRatio: '16 / 10' }}>{timedOutLabel(gallery?.index ?? 0, gallery?.count ?? 1)}</div>
        : open
        ? <ViewerBoundary attempt={viewerTry} onRetry={() => setViewerTry((n) => n + 1)}>
            <Suspense fallback={<div className="media-frame">{img}</div>}><Viewer label={`${item.title}, image`} gallery={gallery} startFull={startFull} onExit={startFull ? exitFull : undefined}>{img}</Viewer></Suspense>
          </ViewerBoundary>
        : <div className="media-wrap">
            <div className="media-frame" style={{ aspectRatio: '16 / 10' }}
              {...(phone ? {
                onPointerDown: (e) => { loadViewer(); downAt.current = { x: e.clientX, y: e.clientY }; },
                onPointerUp: (e) => {
                  const d = downAt.current;
                  if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 10 && doubleTap(e.clientX, e.clientY, e.timeStamp)) openFull();
                },
              } : {})}>{img}</div>
            {phone ? (
              <button type="button" className="expand-open" ref={expandRef} onClick={openFull} onFocus={loadViewer}
                aria-label={`Open photo ${(gallery?.index ?? 0) + 1} of ${gallery?.count ?? 1} full screen`}>
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ) : full === STATE.READY && !timedOut && (
              <button type="button" className="zoom-overlay" onClick={() => setOpen(true)} onPointerEnter={loadViewer} onFocus={loadViewer}
                aria-label={`Zoom in on photo ${(gallery?.index ?? 0) + 1}`}>
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M15 15l5 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><path d="M10.5 8v5M8 10.5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            )}
          </div>}
      {/* "Full size ready" progress removed — internal state, not for users */}
      <p className="media-status" role="status">
        {open && status === 'loading' && <><span className="spin" aria-hidden="true" />Loading a sharper copy...</>}
        {!expired && (broken || (open && status === 'error')) && (
          <>
            {!broken && stages.length > 1 && level > 0 ? 'Showing a lower quality copy. ' : 'This image could not be loaded. '}
            <button type="button" className="linklike" onClick={() => { setBroken(false); setTries((t) => t + 1); }}>Try again</button>
          </>
        )}
      </p>
      {href && !timedOut && <a className="dl" href={href} download>Download original<span className="sr-only"> of {item.title}</span></a>}
    </div>
  );
}
