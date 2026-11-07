import { detailRows, pickProgram } from './programs.js';
import RedLightVisual from './RedLightVisual.jsx';

/**
 * The program-specific facts the notice returned (for a red light camera: seconds after red, lane, direction...), labelled from
 * the program configuration. A fact the notice did not return says "Not returned for this notice" (never hidden silently).
 * A notice with no configured program shows the default block's plain message.
 *
 * When a program has a visual component (e.g. red light signal timeline), it renders that instead of a plain dl grid,
 * falling back to the dl grid when the visual's required data is missing.
 */
export default function ProgramDetails({ result }) {
  if (!result?.notice) return null;
  const view = detailRows(result);
  if (view.state === 'default') {
    return (
      <section className="prog-details" aria-labelledby="prog-h">
        <h3 id="prog-h">More details</h3>
        <p className="notice-box" role="status">{view.message}</p>
      </section>
    );
  }

  const program = pickProgram(result);
  const visual = renderVisual(program, view, result);

  return (
    <section className="prog-details" aria-labelledby="prog-h">
      <h3 id="prog-h">{view.title} details</h3>
      {view.state === 'no-version' ? <p className="notice-box" role="status">{view.message}</p> : (
        visual || <GenericGrid rows={view.rows} />
      )}
    </section>
  );
}

/** Try to render a program-specific visual; returns null to fall back to the generic grid. */
function renderVisual(program, view, result) {
  if (!program || view.state !== 'rows') return null;
  if (program.id === 'RED_LIGHT_SPEED') {
    return <RedLightVisual rows={view.rows} details={result?.details} />;
  }
  return null;
}

function GenericGrid({ rows }) {
  return (
    <dl className="facts">
      {rows.map((r) => (
        <div key={r.key} className={r.first ? 'span' : undefined}>
          <dt>{r.label}</dt>
          <dd>{r.missing ? <span className="muted">Not returned for this notice</span> : <strong>{r.value}</strong>}</dd>
        </div>
      ))}
    </dl>
  );
}
