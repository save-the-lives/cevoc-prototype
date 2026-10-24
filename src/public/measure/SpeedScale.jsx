import { useId, useState } from 'react';
import { BANDS } from './content.js';

const bandOf = (v, limit) => (v <= limit ? 0 : v - limit <= 10 ? 1 : v - limit <= 20 ? 2 : v - limit <= 30 ? 3 : 4);

// A speed scale drawn in proportion to the limit. The red marker is the limit; colour after it shows how far over.
// The scale always runs to about one and a half times the limit, so a 100 zone and a 50 zone look alike in shape.
// "Try another speed" lets people see how the bands work.
export default function SpeedScale({ speed, limit, readingLabel = 'Your reading', unit = 'km/h' }) {
  const id = useId();
  const max = Math.max(Math.ceil((limit * 1.5) / 10) * 10, Math.ceil((speed + 10) / 10) * 10);
  const [probe, setProbe] = useState(speed);
  const pct = (v) => `${(Math.min(v, max) / max) * 100}%`;
  const step = max > 100 ? 20 : 10;
  const ticks = []; for (let v = 0; v <= max; v += step) ticks.push(v);
  const edges = [0, limit, limit + 10, limit + 20, limit + 30, max];
  const segs = BANDS.map((b, i) => ({ ...b, from: edges[i], to: Math.min(edges[i + 1], max) })).filter((b) => b.from < max);
  const over = speed - limit;
  const bi = bandOf(speed, limit);
  const pi = bandOf(probe, limit);
  const probing = probe !== speed;
  const sentence = (v) => (v <= limit ? `${v} ${unit} is within the ${limit} limit` : `${v} ${unit} is ${v - limit} over the ${limit} limit`);

  return (
    <figure className="ss">
      <div className="ss-plot" role="img" aria-label={`${sentence(speed)}. ${BANDS[bi].label}. The scale runs from 0 to ${max}.`}>
        <div className="ss-marks">
          <span className="ss-reading" style={{ left: pct(speed) }}><b>{speed}</b><small>{readingLabel}</small></span>
          {probing && <span className="ss-probe" style={{ left: pct(probe) }}><b>{probe}</b><small>Try</small></span>}
        </div>
        <div className="ss-track">
          {segs.map((b) => <span key={b.id} className={`ss-band ${b.id === bi ? 'is-on' : ''}`} style={{ width: `${((b.to - b.from) / max) * 100}%`, background: b.tone }} />)}
          <i className="ss-limit" style={{ left: pct(limit) }}><b>Limit {limit}</b></i>
          <i className="ss-pin" style={{ left: pct(speed) }} />
          {probing && <i className="ss-pin is-probe" style={{ left: pct(probe) }} />}
        </div>
        <div className="ss-axis" aria-hidden="true">{ticks.map((v) => <span key={v} style={{ left: pct(v) }}>{v}</span>)}</div>
      </div>

      <ul className="ss-legend">
        {segs.map((b) => (
          <li key={b.id} className={b.id === bi ? 'is-on' : ''}>
            <i style={{ background: b.tone }} />
            <span className="ss-leg__t"><span>{b.label}</span><small>{b.id === 0 ? `0 to ${limit} km/h` : b.id === 4 ? `over ${limit + 30} km/h` : `${b.from + 1} to ${b.to} km/h`}</small></span>
            {b.id === bi && <em>this reading</em>}
          </li>
        ))}
      </ul>

      <figcaption className="ss-cap">
        <strong>{speed} {unit}</strong> in a {limit} {unit} zone{over > 0 ? `, ${over} over` : ''}. <span className="ss-band-name">{BANDS[bi].label}.</span>
      </figcaption>

      <div className="ss-try">
        <label htmlFor={id}>Try another speed</label>
        <input id={id} type="range" min={Math.max(limit - 20, 0)} max={max} step="1" value={probe} onChange={(e) => setProbe(Number(e.target.value))} aria-valuetext={`${sentence(probe)}. ${BANDS[pi].label}.`} />
        <output htmlFor={id}>{probing ? `${sentence(probe)}: ${BANDS[pi].label.toLowerCase()}.` : 'Slide to see how the bands work.'}</output>
        {probing && <button type="button" className="pub-link" onClick={() => setProbe(speed)}>Back to my reading</button>}
      </div>
    </figure>
  );
}
