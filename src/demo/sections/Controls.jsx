import { useStore } from '../../lib/store.jsx';
import { FORCEABLE } from '../../lib/faults.js';

export default function Controls() {
  const { state, dispatch } = useStore();
  const forced = Object.entries(state.force).filter(([, v]) => v).length;
  return (
    <>
      <h1>Run mode and reset</h1>
      <section className="demo-run">
        <div>
          <h2>Run mode</h2>
          <p className="demo-muted">Clean for first walkthroughs. Realistic adds the occasional slow file, failed load or missing video, mostly none or one at a time.</p>
        </div>
        <div className="demo-seg" role="radiogroup" aria-label="Run mode">
          {['clean', 'realistic'].map((m) => (
            <button key={m} type="button" role="radio" aria-checked={state.mode === m} className={state.mode === m ? 'on' : ''} onClick={() => dispatch({ type: 'mode', mode: m })}>
              {m === 'clean' ? 'Clean' : 'Realistic'}
            </button>
          ))}
        </div>
        {state.mode === 'realistic' && (
          <div className="demo-seed">
            <label>Seed <input value={state.seed} onChange={(e) => dispatch({ type: 'seed', seed: e.target.value })} /></label>
            <button type="button" onClick={() => dispatch({ type: 'reshuffle' })}>Reshuffle</button>
            <span className="demo-muted">Same seed = same failures, for rehearsals.</span>
          </div>
        )}
        <details className="demo-force" open={forced > 0}>
          <summary>Force a specific failure {forced ? `(${forced} on)` : ''}</summary>
          <div className="demo-force__grid">
            {FORCEABLE.map(([k, l]) => (
              <label key={k}><input type="checkbox" checked={!!state.force[k]} onChange={(e) => dispatch({ type: 'force', key: k, on: e.target.checked })} /> {l}</label>
            ))}
          </div>
        </details>
      </section>
      <section className="demo-run">
        <div>
          <h2>Hand-offs to other systems</h2>
          <p className="demo-muted">Buttons that would open Revenue NSW or Service NSW look like any other button, with a note on hover. Switch this on to mark every one at once, for walkthroughs.</p>
        </div>
        <label className="demo-switch"><input type="checkbox" checked={!!state.handoffs} onChange={(e) => dispatch({ type: 'handoffs', on: e.target.checked })} /> Highlight hand-offs</label>
      </section>
      <div className="demo-foot">
        <button type="button" onClick={() => dispatch({ type: 'reset' })}>Reset all demo data</button>
        <span className="demo-muted">{state.pending.length} pending · {Object.keys(state.certStatus).length} certificate changes · {Object.keys(state.decisions).length} decisions · {Object.keys(state.assign).length} assignments</span>
      </div>
      <p className="demo-muted">All people, notices, images, videos and certificates are fictitious. Sign-in, the Revenue NSW hand-off, notifications and letters are simulated. Certificate checks summarise Road Transport Act 2013 ss132, 137 and 138 for prototyping, not legal advice. Add <code>?clean=1</code> to any URL to hide the demo-hub link for screenshots.</p>
    </>
  );
}
