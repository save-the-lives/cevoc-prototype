import { useId, useState } from 'react';
import SafetyNote from './SafetyNote.jsx';

// A speed scale drawn in proportion to the limit. The limit is a calm marker; the reading stands out in red when
// it is over, because that is the thing to look at. The scale always runs to about one and a half times the limit,
// so a 100 zone and a 50 zone look alike in shape. "Try another speed" lets people explore, and the road-safety
// reminder underneath follows whatever speed is showing.
export default function SpeedScale({ speed, limit, readingLabel = 'Your reading', unit = 'km/h' }) {
  const id = useId();
  const max = Math.max(Math.ceil((limit * 1.5) / 10) * 10, Math.ceil((speed + 10) / 10) * 10);
  const [probe, setProbe] = useState(speed);
  const pct = (v) => `${(Math.min(v, max) / max) * 100}%`;
  const step = max > 100 ? 20 : 10;
  const ticks = []; for (let v = 0; v <= max; v += step) ticks.push(v);
  const over = speed - limit;
  const probing = probe !== speed;
  const sentence = (v) => (v <= limit ? `${v} ${unit} is within the ${limit} limit` : `${v} ${unit} is ${v - limit} over the ${limit} limit`);

  return (
    <figure className="ss">
      <div className="ss-plot" role="img" aria-label={`${sentence(speed)}. The scale runs from 0 to ${max}.`}>
        <div className="ss-marks">
          <span className={`ss-reading ${over > 0 ? 'is-over' : ''}`} style={{ left: pct(speed) }}><b>{speed}</b><small>{readingLabel}</small></span>
          {probing && <span className="ss-probe" style={{ left: pct(probe) }}><b>{probe}</b><small>Try</small></span>}
        </div>
        <div className="ss-track">
          <span className="ss-zone is-ok" style={{ width: pct(limit) }} />
          <span className="ss-zone is-over" style={{ width: `${((max - limit) / max) * 100}%` }} />
          <i className="ss-limit" style={{ left: pct(limit) }}><b>Limit {limit}</b></i>
          <i className={`ss-pin ${over > 0 ? 'is-over' : ''}`} style={{ left: pct(speed) }} />
          {probing && <i className="ss-pin is-probe" style={{ left: pct(probe) }} />}
        </div>
        <div className="ss-axis" aria-hidden="true">{ticks.map((v) => <span key={v} style={{ left: pct(v) }}>{v}</span>)}</div>
      </div>

      <figcaption className="ss-cap">
        <strong className={over > 0 ? 'is-over' : ''}>{speed} {unit}</strong> in a {limit} {unit} zone{over > 0 ? `, ${over} over` : ''}.
      </figcaption>

      <div className="ss-try">
        <label htmlFor={id}>Try another speed</label>
        <input id={id} type="range" min={Math.max(limit - 20, 0)} max={max} step="1" value={probe} onChange={(e) => setProbe(Number(e.target.value))} aria-valuetext={sentence(probe)} />
        <output htmlFor={id}>{probing ? `${sentence(probe)}.` : 'Slide to see how speed compares with the limit.'}</output>
        {probing && <button type="button" className="pub-link" onClick={() => setProbe(speed)}>Back to my reading</button>}
      </div>

      <SafetyNote speed={probe} limit={limit} />
    </figure>
  );
}
