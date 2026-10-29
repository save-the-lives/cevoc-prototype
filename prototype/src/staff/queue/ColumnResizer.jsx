import { useRef } from 'react';
import { MIN_WIDTH } from './columns.jsx';

// A drag handle on the right edge of a column header. Drag to resize, double-click to reset,
// or focus it and use the left and right arrow keys.
export default function ColumnResizer({ label, width, onLive, onCommit, onReset }) {
  const start = useRef(null);
  return (
    <span className="st-resize" role="separator" aria-orientation="vertical" aria-label={`Resize ${label} column`} tabIndex={0}
      aria-valuenow={width} aria-valuemin={MIN_WIDTH}
      onClick={(e) => e.stopPropagation()} onDoubleClick={onReset}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, w: width }; }}
      onPointerMove={(e) => { if (start.current) onLive(Math.max(MIN_WIDTH, start.current.w + e.clientX - start.current.x)); }}
      onPointerUp={(e) => { if (!start.current) return; const w = Math.max(MIN_WIDTH, start.current.w + e.clientX - start.current.x); start.current = null; onCommit(w); }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); onCommit(Math.max(MIN_WIDTH, width + (e.key === 'ArrowRight' ? 12 : -12))); }
      }} />
  );
}
