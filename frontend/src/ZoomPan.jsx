import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IDENTITY, clampView, panBy, pinchStep, stepScale, wheelFactor, zoomAt,
} from './zoom.js';

const TAP_MOVE_PX = 5;
const KEY_PAN_PX = 60;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_ZOOM = 2.5;
const SWIPE_PX = 50;

/**
 * Zoom and pan for any child (image or video).
 *  touch: pinch to zoom, drag to pan, double-tap toggles zoom
 *  mouse: wheel zoom, drag to pan, double-click resets
 *  keyboard (viewport focused): + - arrows 0, plus visible buttons
 * `controlsAtRest` marks content with its own native controls (video): a single
 * pointer at 1x is left alone so those controls keep working.
 * `gallery` ({ count, index, render(i) }) turns the full-screen view into a photo gallery: swipe (only at 1x), arrow keys
 * or the Previous/Next buttons move between photos; zoomed in, a drag pans instead.
 * `renderTools(view)` adds extra buttons to the toolbar (outside the transform).
 */
export default function ZoomPan({ label, children, controlsAtRest = false, renderTools, onFullscreenFallback, gallery }) {
  const rootRef = useRef(null);
  const viewportRef = useRef(null);
  const [view, setViewState] = useState(IDENTITY);
  const viewRef = useRef(IDENTITY);
  const sizeRef = useRef({ w: 1, h: 1 });
  const pointers = useRef(new Map()); // id -> {x, y} relative to viewport centre
  const gesture = useRef({ moved: false, lastTap: 0 });
  const [dragging, setDragging] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [overlay, setOverlay] = useState(false); // full-viewport fallback where the element Fullscreen API does not exist (iOS Safari)
  const returnFocus = useRef(null);
  const [pos, setPos] = useState(gallery?.index ?? 0); // photo shown in full screen

  const commit = useCallback((next, { smooth = false } = {}) => {
    const c = clampView(next, sizeRef.current.w, sizeRef.current.h);
    viewRef.current = c;
    setAnimate(smooth);
    setViewState(c);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    const measure = () => {
      const r = el.getBoundingClientRect();
      sizeRef.current = { w: r.width || 1, h: r.height || 1 };
      commit(viewRef.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [commit]);

  const rel = (e) => {
    const r = viewportRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  const zoomTo = useCallback((scale, focal = { x: 0, y: 0 }, smooth = true) => {
    commit(zoomAt(viewRef.current, scale, focal.x, focal.y, sizeRef.current.w, sizeRef.current.h), { smooth });
  }, [commit]);
  const zoomStep = (dir) => zoomTo(stepScale(viewRef.current.scale, dir));
  const reset = () => commit(IDENTITY, { smooth: true });

  // Wheel needs a non-passive listener so we can stop the page scrolling while zooming.
  useEffect(() => {
    const el = viewportRef.current;
    const onWheel = (e) => {
      const cur = viewRef.current;
      const factor = wheelFactor(e.deltaY, e.deltaMode, e.ctrlKey);
      // Plain scroll-down at 1x is left to the page so the viewer never traps scrolling.
      if (!e.ctrlKey && cur.scale === 1 && factor < 1) return;
      e.preventDefault();
      zoomTo(cur.scale * factor, rel(e), false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest?.('button, a')) return; // overlay buttons (Try again) keep their own clicks
    gesture.current.type = e.pointerType;
    if (pointers.current.size === 0) {
      gesture.current.moved = false;
      gesture.current.start = { x: e.clientX, y: e.clientY, scale: viewRef.current.scale, multi: false };
    } else if (gesture.current.start) gesture.current.start.multi = true;
    const onVideoAtRest = controlsAtRest && viewRef.current.scale === 1 && pointers.current.size === 0;
    if (onVideoAtRest && e.pointerType !== 'touch') return; // leave native controls alone
    if (onVideoAtRest) {
      // A touch on a video at 1x may become a pinch, but a single finger must still reach native controls.
      pointers.current.set(e.pointerId, rel(e));
      return;
    }
    pointers.current.set(e.pointerId, rel(e));
    try { viewportRef.current.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const prevPt = pointers.current.get(e.pointerId);
    if (!prevPt) return;
    const pt = rel(e);
    const cur = viewRef.current;
    const { w, h } = sizeRef.current;
    if (pointers.current.size >= 2) {
      const ids = [...pointers.current.keys()];
      const prev = { a: pointers.current.get(ids[0]), b: pointers.current.get(ids[1]) };
      const nowPts = { ...prev };
      if (e.pointerId === ids[0]) nowPts.a = pt; else if (e.pointerId === ids[1]) nowPts.b = pt;
      pointers.current.set(e.pointerId, pt);
      gesture.current.moved = true;
      if (!viewportRef.current.hasPointerCapture?.(e.pointerId)) {
        try { viewportRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        setDragging(true);
      }
      commit(pinchStep(cur, prev, nowPts, w, h));
      return;
    }
    const dx = pt.x - prevPt.x;
    const dy = pt.y - prevPt.y;
    pointers.current.set(e.pointerId, pt);
    if (cur.scale === 1 || !viewportRef.current.hasPointerCapture?.(e.pointerId)) return;
    if (Math.abs(dx) + Math.abs(dy) > 0) gesture.current.moved = true;
    commit(panBy(cur, dx, dy, w, h));
  };

  const endPointer = (e) => {
    const had = pointers.current.delete(e.pointerId);
    if (!had) return;
    if (pointers.current.size === 0) setDragging(false);
    const st = gesture.current.start;
    if (nav && e.type === 'pointerup' && e.pointerType !== 'mouse' && st && !st.multi && st.scale === 1 && viewRef.current.scale === 1) {
      const dx = e.clientX - st.x;
      if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > 1.5 * Math.abs(e.clientY - st.y)) {
        gesture.current.moved = true; // not a tap
        go(dx < 0 ? 1 : -1);
        return;
      }
    }
    if (e.type === 'pointerup' && e.pointerType === 'touch' && !controlsAtRest && !gesture.current.moved) {
      const now = e.timeStamp;
      if (now - gesture.current.lastTap < DOUBLE_TAP_MS) {
        gesture.current.lastTap = 0;
        if (viewRef.current.scale > 1) reset(); else zoomTo(DOUBLE_TAP_ZOOM, rel(e));
      } else {
        gesture.current.lastTap = now;
      }
    }
  };

  // A drag that ends over a video/link must not also count as a click.
  const onClickCapture = (e) => {
    if (gesture.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      gesture.current.moved = false;
    }
  };

  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === '+' || k === '=') zoomStep(1);
    else if (k === '-' || k === '_') zoomStep(-1);
    else if (k === '0') reset();
    else if (viewRef.current.scale > 1 && k.startsWith('Arrow')) {
      const d = { ArrowLeft: [KEY_PAN_PX, 0], ArrowRight: [-KEY_PAN_PX, 0], ArrowUp: [0, KEY_PAN_PX], ArrowDown: [0, -KEY_PAN_PX] }[k];
      commit(panBy(viewRef.current, d[0], d[1], sizeRef.current.w, sizeRef.current.h), { smooth: true });
    } else return;
    e.preventDefault();
  };

  // Gallery: only in full screen, and only with more than one photo.
  const inFs = isFs || overlay;
  const nav = inFs && !!gallery && gallery.count > 1;
  const go = (d) => {
    const n = pos + d;
    if (!nav || n < 0 || n >= gallery.count) return;
    setPos(n);
    commit(IDENTITY);
  };
  // Arrow keys move between photos at 1x (zoomed in, the viewport pans and calls preventDefault first); Tab stays inside the dialog.
  const onRootKeyDown = (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (nav && viewRef.current.scale === 1 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !/^(INPUT|SELECT|VIDEO)$/.test(e.target.tagName)) {
      go(e.key === 'ArrowRight' ? 1 : -1);
      e.preventDefault();
    } else if (overlay && e.key === 'Tab') {
      const f = [...rootRef.current.querySelectorAll('button:not([disabled]), [tabindex="0"], input, select')];
      const at = f.indexOf(document.activeElement);
      if (f.length && (at < 0 || (e.shiftKey ? at === 0 : at === f.length - 1))) { f[e.shiftKey ? f.length - 1 : 0].focus(); e.preventDefault(); }
    }
  };

  // Fullscreen
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const canFs = typeof document !== 'undefined';
  const closeOverlay = useCallback(() => { setOverlay(false); returnFocus.current?.focus?.(); }, []);
  const toggleFs = () => {
    if (document.fullscreenElement === rootRef.current) { document.exitFullscreen?.(); return; }
    if (overlay) { closeOverlay(); return; }
    enter();
    if (document.fullscreenEnabled && rootRef.current?.requestFullscreen) {
      rootRef.current.requestFullscreen().catch(() => (onFullscreenFallback ? onFullscreenFallback() : openOverlay()));
    } else if (onFullscreenFallback) onFullscreenFallback();
    else openOverlay();
  };
  function openOverlay() { returnFocus.current = document.activeElement; setOverlay(true); }
  const enter = () => setPos(gallery?.index ?? 0);

  // The overlay locks page scrolling behind it, closes on Escape and puts focus on its Close button.
  useEffect(() => {
    if (!overlay) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') closeOverlay(); };
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector('.zp-close')?.focus();
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [overlay, closeOverlay]);

  const zoomed = view.scale > 1;
  const pct = `${Math.round(view.scale * 100)}%`;
  const touchAction = zoomed || pointers.current.size > 1 ? 'none' : 'pan-y';

  return (
    <div className={`zp${isFs || overlay ? ' zp-fs' : ''}${overlay ? ' zp-overlay' : ''}`} ref={rootRef}
      onKeyDown={onRootKeyDown}
      role={overlay ? 'dialog' : undefined} aria-modal={overlay || undefined} aria-label={overlay ? label : undefined}>
      <div
        className={`zp-viewport${dragging ? ' is-dragging' : ''}${zoomed ? ' is-zoomed' : ''}`}
        ref={viewportRef}
        role="group"
        aria-roledescription="zoomable viewer"
        aria-label={`${label}. Use plus and minus to zoom, arrow keys to move, 0 to reset.`}
        tabIndex={0}
        style={{ touchAction }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onLostPointerCapture={(e) => { if (e.target === e.currentTarget) endPointer(e); }}
        onClickCapture={onClickCapture}
        onDoubleClick={(e) => { if (gesture.current.type === 'touch') return; if (!controlsAtRest || zoomed) { e.preventDefault(); reset(); } }}
        onKeyDown={onKeyDown}
      >
        <div
          className={`zp-content${animate ? ' animate' : ''}`}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {nav ? gallery.render(pos) : children}
        </div>
      </div>
      <div className="zp-tools" role="toolbar" aria-label={`${label} controls`}>
        {nav && (
          <>
            <button type="button" onClick={() => go(-1)} aria-disabled={pos === 0} aria-label="Previous photo">&lsaquo;</button>
            <output className="zp-pos" aria-live="polite" aria-label="Photo position">{pos + 1} / {gallery.count}</output>
            <button type="button" onClick={() => go(1)} aria-disabled={pos === gallery.count - 1} aria-label="Next photo">&rsaquo;</button>
          </>
        )}
        <button type="button" onClick={() => zoomStep(-1)} disabled={view.scale <= 1} aria-label="Zoom out">&minus;</button>
        <output className="zp-level" aria-live="polite" aria-label="Zoom level">{pct}</output>
        <button type="button" onClick={() => zoomStep(1)} disabled={view.scale >= 6} aria-label="Zoom in">+</button>
        <button type="button" onClick={reset} disabled={!zoomed} aria-label="Reset zoom">Reset</button>
        {canFs && (
          <button type="button" onClick={toggleFs} aria-pressed={isFs || overlay} aria-label={isFs || overlay ? 'Exit full screen' : 'Full screen'}>
            {isFs || overlay ? 'Exit full screen' : 'Full screen'}
          </button>
        )}
        {overlay && <button type="button" className="zp-close" onClick={closeOverlay}>Close</button>}
        {renderTools?.(view)}
      </div>
    </div>
  );
}
