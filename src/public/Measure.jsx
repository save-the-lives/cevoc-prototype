import { site as findSite } from '../data.js';

// Program-specific "how it was measured" panel. Same slot on every page, different content per camera program.
export default function Measure({ n, program }) {
  const s = findSite(n.site);

  if (program === 'AVERAGE_SPEED') {
    const mins = Math.round((n.segment.distanceKm / n.speed) * 60);
    return (
      <div className="ms">
        <div className="ms-seg">
          <div className="ms-pt"><span>Point A</span><strong>{n.segment.timeA}</strong></div>
          <div className="ms-line"><span>{n.segment.distanceKm} km surveyed distance</span></div>
          <div className="ms-pt"><span>Point B</span><strong>{n.segment.timeB}</strong></div>
        </div>
        <p className="ms-calc">
          {n.segment.distanceKm} km in {mins} minutes = <strong>{n.speed} km/h average</strong>. The limit for heavy vehicles on this length is {s.heavyLimit || s.limit} km/h.
        </p>
      </div>
    );
  }

  if (program === 'RED_LIGHT_SPEED') {
    const amber = 4;
    const total = 3 + amber + n.redFor + 1.5;
    const pct = (v) => `${(v / total) * 100}%`;
    return (
      <div className="ms">
        <div className="ms-signal" role="img" aria-label={`Signal sequence. The light had been red for ${n.redFor} seconds when the vehicle crossed the stop line.`}>
          <span className="g" style={{ width: pct(3) }}>Green</span>
          <span className="a" style={{ width: pct(amber) }}>Amber {amber}s</span>
          <span className="r" style={{ width: pct(n.redFor + 1.5) }}>Red</span>
          <i style={{ left: pct(3 + amber + n.redFor) }}><b>Vehicle crossed</b></i>
        </div>
        <p className="ms-calc">The light had been red for <strong>{n.redFor} seconds</strong> when the vehicle crossed the stop line, travelling at {n.speed} km/h.</p>
      </div>
    );
  }

  if (program === 'MOBILE_PHONE') {
    return (
      <div className="ms">
        <ol className="ms-steps">
          <li><strong>Camera</strong> photographed the driver’s area</li>
          <li><strong>Software</strong> flagged a possible phone</li>
          <li><strong>A trained person</strong> looked at the image and confirmed it</li>
          <li><strong>Passengers</strong> were blurred before anyone outside the review team saw it</li>
        </ol>
      </div>
    );
  }

  // Fixed and mobile speed: speed against the limit.
  const over = n.speed - s.limit;
  return (
    <div className="ms">
      <div className="ms-speed" role="img" aria-label={`${n.speed} km/h in a ${s.limit} km/h zone`}>
        <div className="ms-speed__bar">
          <span className="lim" style={{ width: `${(s.limit / (n.speed + 15)) * 100}%` }}>Limit {s.limit}</span>
          <span className="over" style={{ width: `${(over / (n.speed + 15)) * 100}%` }} />
        </div>
      </div>
      <p className="ms-calc"><strong>{n.speed} km/h</strong> in a {s.limit} km/h zone, {over} km/h over.</p>
      {program === 'MOBILE_SPEED' && <p className="ms-note">Mobile cameras are signposted and checked by the operator before every session.</p>}
    </div>
  );
}
