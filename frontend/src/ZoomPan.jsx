import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IDENTITY, clampView, panBy, pinchStep, stepScale, wheelFactor, zoomAt,
} from './zoom.js';

const TAP_MOVE_PX = 5;
const KEY_PAN_PX = 60;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_ZOOM = 2.5;

/**
 * Zoom and pan for any child (image or video).
 *  touch: pinch to zoom, drag to pan, double-tap toggles zoom
 *  mouse: wheel zoom, drag to pan, double-click resets
 *  keyboard (viewport focused): + - arrows 0, plus visible buttons
 * `controlsAtRest` marks content with its own native controls (video): a single
 * pointer at 1x is left alone so those controls keep working.
 * `renderTools(view)` adds extra buttons to the toolbar (outside the transform).
 */
export default function ZoomPan({ label, children, controlsAtRest = false, renderTools, onFullscreenFallback }) {
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
    gesture.current.type = e.pointerType;
    if (pointers.current.size === 0) gesture.current.moved = false;
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

  // Fullscreen
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const canFs = typeof document !== 'undefined' && (document.fullscreenEnabled || !!onFullscreenFallback);
  const toggleFs = () => {
    if (document.fullscreenElement === rootRef.current) { document.exitFullscreen?.(); return; }
    if (document.fullscreenEnabled && rootRef.current.requestFullscreen) {
      rootRef.current.requestFullscreen().catch(() => onFullscreenFallback?.());
    } else onFullscreenFallback?.();
  };

  const zoomed = view.scale > 1;
  const pct = `${Math.round(view.scale * 100)}%`;
  const touchAction = zoomed || pointers.current.size > 1 ? 'none' : 'pan-y';

  return (
    <div className={`zp${isFs ? ' zp-fs' : ''}`} ref={rootRef}>
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
          {children}
        </div>
      </div>
      <div className="zp-tools" role="toolbar" aria-label={`${label} controls`}>
        <button type="button" onClick={() => zoomStep(-1)} disabled={view.scale <= 1} aria-label="Zoom out">&minus;</button>
        <output className="zp-level" aria-live="polite" aria-label="Zoom level">{pct}</output>
        <button type="button" onClick={() => zoomStep(1)} disabled={view.scale >= 6} aria-label="Zoom in">+</button>
        <button type="button" onClick={reset} disabled={!zoomed} aria-label="Reset zoom">Reset</button>
        {canFs && (
          <button type="button" onClick={toggleFs} aria-pressed={isFs} aria-label={isFs ? 'Exit full screen' : 'Full screen'}>
            {isFs ? 'Exit full screen' : 'Full screen'}
          </button>
        )}
        {renderTools?.(view)}
      </div>
    </div>
  );
}
