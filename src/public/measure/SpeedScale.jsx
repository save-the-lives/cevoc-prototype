import { useLayoutEffect, useRef, useState } from 'react';
import RoadSafety from './RoadSafety.jsx';

const useWidth = (ref) => {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(() => setW(ref.current.getBoundingClientRect().width));
    ro.observe(ref.current); setW(ref.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref]);
  return w;
};

// A speed scale drawn in proportion to the limit. The limit is a calm marker; the reading stands out in red when it
// is over, because that is the thing to look at. The scale always runs to about one and a half times the limit, so a
// 100 zone and a 50 zone look alike in shape. Beneath it, a short road-safety note for this road and vehicle.
export default function SpeedScale({ speed, limit, vehicle, dateTime, readingLabel = 'Your reading', unit = 'km/h' }) {
  const max = Math.max(Math.ceil((limit * 1.5) / 10) * 10, Math.ceil((speed + 10) / 10) * 10);
  const pct = (v) => `${(Math.min(v, max) / max) * 100}%`;
  const step = max > 100 ? 20 : 10;
  const ticks = []; for (let v = 0; v <= max; v += step) ticks.push(v);
  const over = speed - limit;
  const trackRef = useRef(null);
  const w = useWidth(trackRef);
  // Labels sit inside the bar. The reading label goes beside its pin on whichever side has room and does not
  // run into the limit label; if neither side fits, the big number above and the caption below still say it.
  const small = w < 420;
  const limitPx = small ? 62 : 70; const readPx = small ? 84 : 98;
  const limitX = (limit / max) * w; const pinX = (Math.min(speed, max) / max) * w;
  const blocked = [limitX - 8 - limitPx, limitX + 4];
  const clash = (a, b) => a < blocked[1] && b > blocked[0];
  const rightOk = pinX + 8 + readPx <= w - 4 && !clash(pinX + 8, pinX + 8 + readPx);
  const leftOk = pinX - 8 - readPx >= 4 && !clash(pinX - 8 - readPx, pinX - 8);
  const side = !w ? null : rightOk ? 'right' : leftOk ? 'left' : null;
  const sentence = over > 0 ? `${speed} ${unit} is ${over} over the ${limit} limit` : `${speed} ${unit} is within the ${limit} limit`;

  return (
    <figure className="ss">
      <div className="ss-plot" role="img" aria-label={`${sentence}. The scale runs from 0 to ${max}.`}>
        <div className="ss-marks">
          <span className={`ss-reading ${over > 0 ? 'is-over' : ''}`} style={{ left: pct(speed) }}><b>{speed}</b></span>
        </div>
        <div className="ss-track" ref={trackRef}>
          <span className="ss-zone is-ok" style={{ width: pct(limit) }} />
          <span className="ss-zone is-over" style={{ width: `${((max - limit) / max) * 100}%` }} />
          <i className="ss-limit" style={{ left: pct(limit) }} />
          <span className="ss-in ss-in-limit" style={{ right: `calc(${100 - (limit / max) * 100}% + 8px)` }}>Limit {limit}</span>
          {side && <span className={`ss-in ss-in-read ${over > 0 ? 'is-over' : ''}`} style={side === 'right' ? { left: `calc(${(Math.min(speed, max) / max) * 100}% + 8px)` } : { right: `calc(${100 - (Math.min(speed, max) / max) * 100}% + 8px)` }}>{readingLabel}</span>}
          <i className={`ss-pin ${over > 0 ? 'is-over' : ''}`} style={{ left: pct(speed) }} />
        </div>
        <div className="ss-axis" aria-hidden="true">{ticks.map((v) => <span key={v} style={{ left: pct(v) }}>{v}</span>)}</div>
      </div>
      <figcaption className="ss-cap">
        <strong className={over > 0 ? 'is-over' : ''}>{speed} {unit}</strong> in a {limit} {unit} zone{over > 0 ? `, ${over} over` : ''}.
      </figcaption>
      <RoadSafety speed={speed} limit={limit} vehicle={vehicle} dateTime={dateTime} />
    </figure>
  );
}
