import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueueContext, loadJob } from './evidenceLoader.js';
import { downloadHref, stagesFor } from './media.js';
import { usePhone } from './phone.js';
import { createLoadQueue, jobsFor, saveDataOn, STATE } from './loadQueue.js';
import { ExpiredContext } from './expired.js';

async function downloadAllAsZip(photoDownloads, setZipping) {
  setZipping(true);
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const results = await Promise.allSettled(
      photoDownloads.map(async (href, i) => {
        const res = await fetch(href);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const ext = blob.type === 'image/png' ? 'png' : 'jpg';
        zip.file(`image-${i + 1}.${ext}`, blob);
      })
    );
    const added = results.filter((r) => r.status === 'fulfilled').length;
    if (added === 0) { alert('Could not download any images. The links may have expired.'); return; }
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url; a.download = 'evidence-images.zip';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Zip download failed:', e);
    alert('Download failed. The image links may have expired.');
  } finally {
    setZipping(false);
  }
}

const EvidenceVideo = lazy(() => import('./EvidenceVideo.jsx'));
const ZoomPan = lazy(() => import('./ZoomPan.jsx'));
const loadViewer = () => import('./ZoomPan.jsx');

const EAGER = 3;

function numbered(items) {
  let n = 0;
  return items.map((e) => e.kind === 'IMAGE' ? { ...e, photoNumber: ++n } : e);
}

function photoLabel(item) {
  if (item.photoNumber != null) return `Image ${item.photoNumber}`;
  return item.title;
}

/**
 * A single image in the main stage. Progressive loading: shows preview/medium first, swaps to full when ready.
 */
function StageImage({ item, queueState, onZoom }) {
  const stages = stagesFor(item);
  const [level, setLevel] = useState(0);
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  // Reset loaded state when switching images, then check if already complete (cached)
  useEffect(() => {
    setLoaded(false);
    const frame = requestAnimationFrame(() => {
      if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [item.url]);

  useEffect(() => {
    if (queueState === STATE.READY) {
      setLevel(stages.length - 1);
      return;
    }
    let live = true;
    const kept = [];
    (async () => {
      for (let i = 1; i < stages.length; i++) {
        try {
          await new Promise((resolve, reject) => {
            const img = new Image();
            kept.push(img);
            img.onload = () => { (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(resolve); };
            img.onerror = () => reject(new Error('image'));
            img.src = stages[i];
          });
        } catch { break; }
        if (!live) return;
        setLevel(i);
      }
    })();
    return () => { live = false; kept.forEach((im) => { im.onload = null; im.onerror = null; }); };
  }, [item.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const src = stages[Math.min(level, stages.length - 1)];
  const alt = item.alt || item.title;

  if (broken) {
    return (
      <div className="mg-state is-err" role="alert">
        <strong>This image didn&rsquo;t load</strong>
        <button type="button" className="mg-btn" onClick={() => setBroken(false)}>Try again</button>
      </div>
    );
  }

  return (
    <button type="button" className="mg-zoom" onClick={onZoom} aria-label={`View larger: ${alt}`}>
      <img ref={imgRef} className={`mg-media${loaded ? ' is-loaded' : ''}`} src={src} alt={alt} draggable="false" decoding="async"
        onError={() => setBroken(true)} onLoad={() => { setBroken(false); setLoaded(true); }} />
    </button>
  );
}

/**
 * Render a single slide in the full-screen gallery.
 * Images render as zoomable <img>; video renders the EvidenceVideo player.
 */
function GallerySlide({ item }) {
  if (item.kind === 'VIDEO') {
    return (
      <Suspense fallback={<div className="mg-state is-loading" aria-busy="true">Loading video&hellip;</div>}>
        <EvidenceVideo item={item} />
      </Suspense>
    );
  }
  const alt = item.alt || item.title;
  return <img src={item.url} alt={alt} draggable="false" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}

/**
 * Gallery-style evidence viewer. Large stage, thumbnail strip, downloads, keyboard, swipe, inline zoom, full-size popup.
 * Certificate items pass through as cards below the gallery.
 */
export default function EvidenceGrid({ items }) {
  const phone = usePhone();
  const enriched = useMemo(() => numbered(items), [items]);
  const media = useMemo(() => enriched.filter((e) => e.kind === 'IMAGE' || e.kind === 'VIDEO'), [enriched]);
  const certs = useMemo(() => enriched.filter((e) => e.kind === 'CERTIFICATE'), [enriched]);

  const key = items.map((e) => e.url).join('|');
  const ctx = useMemo(() => {
    const jobs = jobsFor(items);
    const queue = createLoadQueue({ jobs, load: loadJob, saveData: saveDataOn() });
    const photos = jobs.filter((j) => j.kind === 'image').slice(0, EAGER).map((j) => j.id);
    const waiting = new Set(photos);
    const thumbDone = (id) => {
      waiting.delete(id);
      if (waiting.size === 0) queue.thumbnailsSettled();
    };
    if (photos.length === 0) queue.thumbnailsSettled();
    return { queue, thumbDone, eager: photos, photos: items.filter((e) => e.kind === 'IMAGE') };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => ctx.queue.thumbnailsSettled(), 5000);
    return () => clearTimeout(t);
  }, [ctx]);

  const [selected, setSelected] = useState(0);
  const [full, setFull] = useState(false);
  const rootRef = useRef(null);
  const touchRef = useRef(null);
  const n = media.length;

  const go = useCallback((d) => setSelected((x) => (x + d + n) % n), [n]);

  // Arrow keys
  useEffect(() => {
    if (n < 2) return undefined;
    const on = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Enter') return;
      const t = e.target;
      if (t && (/^(input|textarea|select|video)$/i.test(t.tagName) || t.isContentEditable)) return;
      if (!full && document.querySelector('[role="dialog"]')) return;
      if (e.key === 'Enter') {
        if (t?.closest?.('.mg')) { e.preventDefault(); setFull(true); }
        return;
      }
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [n, go, full]);

  // Enter on focused gallery opens full size
  const onRootKey = (e) => {
    if (e.key === 'Enter' && !e.target.closest('button, a')) { e.preventDefault(); setFull(true); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };

  // Touch swipe
  const onTouchStart = (e) => { touchRef.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - (touchRef.current ?? 0);
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  // Inline zoom via scroll wheel on stage
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  // Reset zoom when switching images
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [selected]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setZoom((z) => {
      const next = Math.max(1, Math.min(5, z * (e.deltaY < 0 ? 1.15 : 0.87)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // Drag to pan when zoomed
  const onPointerDown = (e) => {
    if (zoom <= 1 || e.button !== 0) return;
    dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
  };
  const onPointerUp = () => { dragRef.current = null; };

  // Pinch zoom for touch
  const pinchRef = useRef(null);
  const onPinchStart = (e) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchRef.current = { d, z: zoom };
      e.preventDefault();
    }
  };
  const onPinchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const next = Math.max(1, Math.min(5, pinchRef.current.z * (d / pinchRef.current.d)));
      setZoom(next);
      if (next <= 1) setPan({ x: 0, y: 0 });
      e.preventDefault();
    }
  };
  const onPinchEnd = () => { pinchRef.current = null; };

  // Queue state subscription
  const [queueStates, setQueueStates] = useState({});
  useEffect(() => {
    if (!ctx.queue) return undefined;
    const sync = () => {
      const s = {};
      media.forEach((it) => { s[it.url] = ctx.queue.state(it.url); });
      setQueueStates(s);
    };
    sync();
    return ctx.queue.subscribe(sync);
  }, [ctx, media]);

  const [zipping, setZipping] = useState(false);
  const item = media[selected];
  const photoDownloads = media.filter((e) => e.kind === 'IMAGE').map((e) => downloadHref(e)).filter(Boolean);
  const hasNonDownloadableVideo = media.some((e) => e.kind === 'VIDEO' && !downloadHref(e));
  const currentHref = item ? downloadHref(item) : null;

  if (!n && certs.length === 0) return <p className="muted">No images or video are held for this notice.</p>;

  return (
    <QueueContext.Provider value={ctx}>
      {n > 0 && (
        <div ref={rootRef} className="mg" tabIndex={0} onKeyDown={onRootKey}
          aria-label="Evidence gallery. Use left and right arrow keys to move between items.">
          {/* Stage */}
          <div className="mg-stage" ref={stageRef}
            onTouchStart={(e) => { onPinchStart(e); onTouchStart(e); }}
            onTouchMove={onPinchMove}
            onTouchEnd={(e) => { onPinchEnd(); onTouchEnd(e); }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ cursor: zoom > 1 ? 'grab' : undefined, touchAction: zoom > 1 ? 'none' : 'pan-y' }}
          >
            {item && item.kind === 'VIDEO' ? (
              <Suspense fallback={<div className="mg-state is-loading" aria-busy="true">Loading video&hellip;</div>}>
                <EvidenceVideo item={item} bare autoPlay />
              </Suspense>
            ) : item ? (
              <div className="mg-zoom-wrap" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center' }}>
                <StageImage item={item} queueState={queueStates[item.url]} onZoom={() => setFull(true)} />
              </div>
            ) : null}
            {n > 1 && (
              <>
                <button type="button" className="mg-nav is-prev" onClick={() => go(-1)}
                  aria-label={`Previous, ${((selected - 1 + n) % n) + 1} of ${n}`}>&lsaquo;</button>
                <button type="button" className="mg-nav is-next" onClick={() => go(1)}
                  aria-label={`Next, ${((selected + 1) % n) + 1} of ${n}`}>&rsaquo;</button>
              </>
            )}
          </div>

          {/* Caption and download buttons */}
          <div className="mg-bar">
            <div className="mg-caption">
              <span>{selected + 1} of {n}</span>
            </div>
            <div className="mg-actions">
              {item && item.kind !== 'VIDEO' && currentHref && (
                <a className="mg-btn" href={currentHref} download>Download this image</a>
              )}
              {item && item.kind !== 'VIDEO' && photoDownloads.length > 1 && (
                <button type="button" className="mg-btn" disabled={zipping}
                  onClick={() => downloadAllAsZip(photoDownloads, setZipping)}>
                  {zipping ? 'Preparing zip…' : 'Download all images'}
                </button>
              )}
            </div>
          </div>
          {item && item.kind === 'VIDEO' && <p className="mg-note">Video evidence cannot be downloaded.</p>}

          {/* Thumbnail strip */}
          {n > 1 && (
            <div className="mg-thumbs" role="group" aria-label="Choose an image or video">
              {media.map((it, k) => {
                const thumbSrc = it.kind === 'VIDEO' ? it.posterUrl : (it.previewUrl || it.url);
                const isActive = k === selected;
                return (
                  <button key={it.url} type="button"
                    aria-pressed={isActive}
                    className={`mg-thumb${isActive ? ' is-on' : ''}`}
                    onClick={() => setSelected(k)}
                    onDoubleClick={() => { setSelected(k); setFull(true); }}
                    aria-label={`${it.kind === 'IMAGE' ? photoLabel(it) : it.title} (${k + 1} of ${n})`}>
                    {thumbSrc ? <img src={thumbSrc} alt="" loading={k < EAGER ? 'eager' : 'lazy'} decoding="async"
                      onLoad={() => ctx.thumbDone(it.url)}
                      onError={() => ctx.thumbDone(it.url)} />
                      : <span className="mg-thumb__st">&mdash;</span>}
                    {it.kind === 'VIDEO' && <span className="mg-play" aria-hidden="true">&#9654;</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Full-screen gallery: swipe left/right through all evidence (images + video) */}
          {full && n > 0 && (
            <Suspense fallback={null}><ZoomPan
              label="Evidence gallery"
              startFull
              onExit={() => setFull(false)}
              controlsAtRest={media[selected]?.kind === 'VIDEO'}
              gallery={{
                count: n,
                index: selected,
                render: (i) => <GallerySlide item={media[i]} />,
              }}
            />
            </Suspense>
          )}
        </div>
      )}

      {/* Certificates stay as cards */}
      {certs.length > 0 && (
        <ul className="grid">
          {certs.map((c) => (
            <li key={c.url} className="card cert">
              <h4>{c.title}</h4>
              <p>PDF document</p>
              <a className="btn" href={c.url} target="_blank" rel="noopener noreferrer">
                Open certificate<span className="sr-only"> (PDF, opens in a new tab)</span>
              </a>{' '}
              <a className="dl" href={c.downloadUrl || c.url} download>Download original</a>
            </li>
          ))}
        </ul>
      )}
    </QueueContext.Provider>
  );
}
