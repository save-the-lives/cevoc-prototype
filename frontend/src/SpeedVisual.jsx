import SpeedScale from './SpeedScale.jsx';

/**
 * Program-specific visual for speed camera notices.
 * Shows a speed scale (bar chart of speed vs limit) plus the detail rows below.
 * Falls back to null (generic grid) when the required data is missing.
 */
export default function SpeedVisual({ rows, details }) {
  const speed = details?.speedKmh;
  const limit = details?.speedLimit;
  if (typeof speed !== 'number' || typeof limit !== 'number') return null;

  const over = speed - limit;
  const otherRows = rows.filter((r) => r.key !== 'speedKmh' && r.key !== 'speedLimit' && r.key !== 'speedOverLimit');

  return (
    <div className="speed-visual">
      <SpeedScale speed={speed} limit={limit} readingLabel="Recorded speed" />
      {over > 0 && (
        <p className="speed-over">
          <strong>{over} km/h</strong> over the {limit} km/h limit
        </p>
      )}
      {otherRows.length > 0 && (
        <dl className="facts">
          {otherRows.map((r) => (
            <div key={r.key}>
              <dt>{r.label}</dt>
              <dd>{r.missing ? <span className="muted">Not returned for this notice</span> : <strong>{r.value}</strong>}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
