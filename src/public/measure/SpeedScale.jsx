import RoadSafety from './RoadSafety.jsx';

// A speed scale drawn in proportion to the limit. The limit is a calm marker; the reading stands out in red when it
// is over, because that is the thing to look at. The scale always runs to about one and a half times the limit, so a
// 100 zone and a 50 zone look alike in shape. Beneath it, a short road-safety note for this road and vehicle.
export default function SpeedScale({ speed, limit, vehicle, dateTime, readingLabel = 'Your reading', unit = 'km/h' }) {
  const max = Math.max(Math.ceil((limit * 1.5) / 10) * 10, Math.ceil((speed + 10) / 10) * 10);
  const pct = (v) => `${(Math.min(v, max) / max) * 100}%`;
  const step = max > 100 ? 20 : 10;
  const ticks = []; for (let v = 0; v <= max; v += step) ticks.push(v);
  const over = speed - limit;
  const sentence = over > 0 ? `${speed} ${unit} is ${over} over the ${limit} limit` : `${speed} ${unit} is within the ${limit} limit`;

  return (
    <figure className="ss">
      <div className="ss-plot" role="img" aria-label={`${sentence}. The scale runs from 0 to ${max}.`}>
        <div className="ss-marks">
          <span className={`ss-reading ${over > 0 ? 'is-over' : ''}`} style={{ left: pct(speed) }}><b>{speed}</b><small>{readingLabel}</small></span>
        </div>
        <div className="ss-track">
          <span className="ss-zone is-ok" style={{ width: pct(limit) }} />
          <span className="ss-zone is-over" style={{ width: `${((max - limit) / max) * 100}%` }} />
          <i className="ss-limit" style={{ left: pct(limit) }}><b>Limit {limit}</b></i>
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
