import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { downloadHref, stagesFor } from './media.js';

// The zoom and pan viewer is its own chunk: it is fetched when someone opens a photo (or points at the button).
const loadViewer = () => import('./ZoomPan.jsx');
const ZoomPan = lazy(loadViewer);

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

  useEffect(() => {
    if (!open) return undefined;
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
      loading={open ? 'eager' : 'lazy'} decoding="async" draggable="false"
      onError={() => setBroken(true)} onLoad={() => setBroken(false)} />
  );

  return (
    <div className="media-body">
      {open
        ? <Suspense fallback={<div className="media-frame">{img}</div>}><ZoomPan label={`${item.title}, image`}>{img}</ZoomPan></Suspense>
        : <div className="media-frame" style={{ aspectRatio: '16 / 10' }}>{img}</div>}
      {!open && (
        <button type="button" className="btn zoom-open" onClick={() => setOpen(true)} onPointerEnter={loadViewer} onFocus={loadViewer}>
          Zoom in<span className="sr-only"> on {item.title}</span>
        </button>
      )}
      <p className="media-status" role="status">
        {open && status === 'loading' && 'Loading a sharper copy...'}
        {(broken || (open && status === 'error')) && (
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
