import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dialog, Spinner } from './ui.jsx';
import { useSimMany } from '../lib/useSim.js';

// Evidence gallery: big stage, thumbnails, keyboard + swipe, download each / all.
// Every item loads on its own; one slow or failed file never blocks the rest.

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
const url = (p) => `${BASE}${p}`;

function triggerDownload(item, name) {
  const a = document.createElement('a');
  a.href = url(item.src);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function Stage({ item, status, onRetry, big }) {
  if (!item) return null;
  if (status === 'missing')
    return (
      <div className="mg-state">
        <strong>This {item.type === 'video' ? 'video' : 'image'} isn’t available</strong>
        <span>The rest of the evidence is unaffected.</span>
      </div>
    );
  if (status === 'error')
    return (
      <div className="mg-state is-err" role="alert">
        <strong>This {item.type} didn’t load</strong>
        <span>It’s a connection problem on our side, not with the notice.</span>
        <button type="button" className="mg-btn" onClick={() => onRetry(item.id)}>Try again</button>
      </div>
    );
  if (status !== 'ready')
    return (
      <div className="mg-state is-loading" aria-busy="true">
        <Spinner />
        <span>{status === 'slow' ? 'Taking longer than usual. You can keep reading below.' : `Loading ${item.type}…`}</span>
      </div>
    );
  return item.type === 'video' ? (
    <video key={item.id} className="mg-media" controls playsInline preload="metadata" poster={url(item.poster)} src={url(item.src)}>
      Your browser can’t play this video.
    </video>
  ) : (
    <img key={item.id} className={`mg-media ${big ? 'is-big' : ''}`} src={url(item.src)} alt={item.caption} />
  );
}

export default function MediaGallery({ items, plan = {}, prefix = 'evidence', variant = 'public', onDownloaded }) {
  const { status, retry } = useSimMany(items, plan);
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const [dl, setDl] = useState({}); // id -> preparing | error | done
  const [all, setAll] = useState(null); // null | {n,total} | 'done' | 'error'
  const failedOnce = useRef(false);
  const touch = useRef(null);
  const rootRef = useRef(null);
  const barRef = useRef(null);
  const thumbRef = useRef(null);
  const moved = useRef(false);
  const [fit, setFit] = useState(null);
  const item = items[i];
  const n = items.length;
  const go = useCallback((d) => { moved.current = true; setI((x) => (x + d + n) % n); }, [n]);

  useEffect(() => { if (i >= n) setI(0); }, [n, i]);

  // Size the stage so the whole image (or video) plus its caption and thumbnails fits in the window
  // without scrolling, wherever the gallery sits on the page.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const chrome = (barRef.current?.offsetHeight || 56) + (thumbRef.current?.offsetHeight || 64) + 28;
      const vh = window.innerHeight;
      const avail = top < vh - 340 ? vh - top - chrome : vh - chrome - 110;
      const natural = (el.clientWidth * 2) / 3;
      setFit(Math.round(Math.max(220, Math.min(avail, natural))));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => { window.removeEventListener('resize', measure); ro.disconnect(); };
  }, [n]);

  // After moving with the arrows, make sure the item is on screen.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [i]);

  // Arrow keys move through the evidence from anywhere on the page, unless you are typing,
  // using a video's own controls, or a dialog is open.
  useEffect(() => {
    if (n < 2) return undefined;
    const on = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target;
      if (t && (/^(input|textarea|select|video)$/i.test(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [n, go]);

  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };

  const fileName = (it) => `${prefix}-${it.id}-SAMPLE.${it.ext.toLowerCase()}`;
  const shouldFail = () => plan.download === 'error' && !failedOnce.current && (failedOnce.current = true);

  const downloadOne = (it) => {
    setDl((m) => ({ ...m, [it.id]: 'preparing' }));
    setTimeout(() => {
      if (shouldFail()) { setDl((m) => ({ ...m, [it.id]: 'error' })); return; }
      triggerDownload(it, fileName(it));
      setDl((m) => ({ ...m, [it.id]: 'done' }));
      onDownloaded?.(it);
    }, 700);
  };

  const downloadAll = async () => {
    const ready = items.filter((it) => status[it.id] === 'ready');
    if (shouldFail()) { setAll('error'); return; }
    for (let k = 0; k < ready.length; k++) {
      setAll({ n: k + 1, total: ready.length });
      await new Promise((r) => setTimeout(r, 500));
      triggerDownload(ready[k], fileName(ready[k]));
    }
    setAll('done');
    onDownloaded?.({ id: 'all', count: ready.length });
  };

  if (!n) return <p className="muted">No images or video are held for this notice.</p>;
  const readyCount = items.filter((it) => status[it.id] === 'ready').length;
  const unavailable = items.filter((it) => status[it.id] === 'missing').length;

  const stage = (big) => (
    <div className="mg-stage" style={!big && fit ? { height: fit, aspectRatio: 'auto' } : undefined} onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }}>
      <Stage item={item} status={status[item.id] || 'loading'} onRetry={retry} big={big} />
      {n > 1 && (
        <>
          <button type="button" className="mg-nav is-prev" onClick={() => go(-1)} aria-label="Previous">‹</button>
          <button type="button" className="mg-nav is-next" onClick={() => go(1)} aria-label="Next">›</button>
        </>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className={`mg mg--${variant}`} tabIndex={0} onKeyDown={onKey} aria-label="Evidence gallery. Use left and right arrow keys to move between items.">
      {stage(false)}
      <div className="mg-bar" ref={barRef}>
        <div className="mg-caption">
          <strong>{item.caption}</strong>
          <span>{i + 1} of {n} · {item.type === 'video' ? 'Video' : 'Image'} · {item.ext}, {item.size}</span>
        </div>
        <div className="mg-actions">
          {status[item.id] === 'ready' && item.type === 'image' && (
            <button type="button" className="mg-link" onClick={() => setFull(true)}>View larger</button>
          )}
          {status[item.id] === 'ready' && (
            dl[item.id] === 'error' ? (
              <button type="button" className="mg-btn is-err" onClick={() => downloadOne(item)}>Download failed · try again</button>
            ) : (
              <button type="button" className="mg-btn" onClick={() => downloadOne(item)} disabled={dl[item.id] === 'preparing'}>
                {dl[item.id] === 'preparing' ? 'Preparing…' : dl[item.id] === 'done' ? 'Downloaded ✓' : `Download ${item.type}`}
              </button>
            )
          )}
        </div>
      </div>

      <div className="mg-thumbs" role="tablist" ref={thumbRef}>
        {items.map((it, k) => {
          const st = status[it.id] || 'loading';
          return (
            <button key={it.id} type="button" role="tab" aria-selected={k === i} className={`mg-thumb ${k === i ? 'is-on' : ''} is-${st}`} onClick={() => setI(k)} aria-label={`${it.caption} (${st})`}>
              {st === 'ready' ? <img src={url(it.type === 'video' ? it.poster : it.src)} alt="" /> : <span className="mg-thumb__st">{st === 'missing' ? '—' : st === 'error' ? '!' : <Spinner />}</span>}
              {it.type === 'video' && <span className="mg-play" aria-hidden="true">▶</span>}
            </button>
          );
        })}
        {n > 1 && (
          <button type="button" className="mg-all" onClick={downloadAll} disabled={!readyCount || (all && typeof all === 'object')}>
            {all && typeof all === 'object' ? `Downloading ${all.n} of ${all.total}…`
              : all === 'error' ? 'Download all failed · try again'
              : all === 'done' ? 'All downloaded ✓'
              : `Download all (${readyCount})`}
          </button>
        )}
      </div>
      {unavailable > 0 && <p className="mg-note">{unavailable} file{unavailable > 1 ? 's are' : ' is'} not available and won’t be included in “Download all”.</p>}

      {full && (
        <Dialog wide title={item.caption} onClose={() => setFull(false)}>
          <div onKeyDown={onKey}>{stage(true)}</div>
          <p className="mg-full-cap">{i + 1} of {n} · use ← → to move</p>
        </Dialog>
      )}
    </div>
  );
}
