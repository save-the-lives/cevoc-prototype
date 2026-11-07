// Simplified speed scale: a horizontal bar showing speed vs limit.
// Adapted from prototype/src/public/measure/SpeedScale.jsx, without ResizeObserver label collision logic.

export default function SpeedScale({ speed, limit, readingLabel = 'Your reading', unit = 'km/h' }) {
  const max = Math.max(Math.ceil((limit * 1.5) / 10) * 10, Math.ceil((speed + 10) / 10) * 10);
  const pct = (v) => `${(Math.min(v, max) / max) * 100}%`;
  const step = max > 100 ? 20 : 10;
  const ticks = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  const over = speed - limit;
  const sentence = over > 0
    ? `${speed} ${unit} is ${over} over the ${limit} limit`
    : `${speed} ${unit} is within the ${limit} limit`;

  return (
    <figure className="ss" aria-label={sentence}>
      <div className="ss-plot" role="img" aria-label={`${sentence}. The scale runs from 0 to ${max}.`}>
        <div className="ss-marks">
          <span className={`ss-reading${over > 0 ? ' is-over' : ''}`} style={{ left: pct(speed) }}>
            <b>{speed}</b>
            <small>{readingLabel}</small>
          </span>
        </div>
        <div className="ss-track">
          <span className="ss-zone is-ok" style={{ width: pct(limit) }} />
          <span className="ss-zone is-over" style={{ width: `${((max - limit) / max) * 100}%` }} />
          <i className="ss-limit" style={{ left: pct(limit) }}>
            <b>Limit {limit}</b>
          </i>
          <i className={`ss-pin${over > 0 ? ' is-over' : ''}`} style={{ left: pct(speed) }} />
        </div>
        <div className="ss-axis" aria-hidden="true">
          {ticks.map((v) => <span key={v} style={{ left: pct(v) }}>{v}</span>)}
        </div>
      </div>
    </figure>
  );
}
