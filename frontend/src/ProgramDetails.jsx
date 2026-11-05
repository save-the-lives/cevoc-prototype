import { detailRows } from './programs.js';

/**
 * The program-specific facts the notice returned (for a red light camera: seconds after red, lane, direction...), labelled from
 * the program configuration. A fact the notice did not return says "Not returned for this notice" (never hidden silently).
 * Renders nothing for a notice that is not a camera notice or while the details are not known.
 */
export default function ProgramDetails({ result }) {
  if (!result?.notice) return null;
  const view = detailRows(result);
  if (view.state === 'default') return null; // not a program we show extra details for; the main facts above are enough
  return (
    <section className="prog-details" aria-labelledby="prog-h">
      <h3 id="prog-h">{view.title} details</h3>
      {view.state === 'no-version' ? <p className="notice-box" role="status">{view.message}</p> : (
        <dl className="facts">
          {view.rows.map((r) => (
            <div key={r.key} className={r.first ? 'span' : undefined}>
              <dt>{r.label}</dt>
              <dd>{r.missing ? <span className="muted">Not returned for this notice</span> : <strong>{r.value}</strong>}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
