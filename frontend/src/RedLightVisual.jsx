// Red light camera visual: traffic signal timeline + speed scale, matching the prototype's Measure.jsx pattern.
// Data comes from the flexible details map (decision 0009) via detailRows().

import SpeedScale from './SpeedScale.jsx';

export default function RedLightVisual({ rows, details }) {
  const timeSinceRed = Number(details?.timeSinceRed);
  const speedLimit = Number(details?.speedLimit);
  const speed = details?.speed != null ? Number(details.speed) : null;

  // Need at least timeSinceRed and speedLimit to render the visual
  if (!Number.isFinite(timeSinceRed) || !Number.isFinite(speedLimit)) return null;

  const amber = 4; // standard amber duration
  const total = 3 + amber + timeSinceRed + 1.5;
  const pct = (v) => `${(v / total) * 100}%`;

  return (
    <div className="rl-visual">
      <div
        className="rl-signal"
        role="img"
        aria-label={`Signal sequence. The light had been red for ${timeSinceRed} seconds when the vehicle crossed the stop line.`}
      >
        <span className="rl-g" style={{ width: pct(3) }}>Green</span>
        <span className="rl-a" style={{ width: pct(amber) }}>Amber</span>
        <span className="rl-r" style={{ width: pct(timeSinceRed + 1.5) }}>Red</span>
        <i className="rl-marker" style={{ left: pct(3 + amber + timeSinceRed) }}>
          <b>Vehicle crossed</b>
        </i>
      </div>
      <p className="rl-calc">
        The light had been red for <strong>{timeSinceRed} seconds</strong> when the vehicle crossed
        the stop line{speed != null ? `, travelling at ${speed} km/h` : ''}.
      </p>
      {speed != null && (
        <SpeedScale speed={speed} limit={speedLimit} readingLabel="Through the intersection" />
      )}
    </div>
  );
}
