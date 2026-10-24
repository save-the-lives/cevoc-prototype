import { Button } from '@nswds/ui';
import Handoff from './Handoff.jsx';

const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

// The matter at a glance, and it stays in view. Full size at the top of the page; once you scroll it folds to one line.
export default function StatusBar({ status, notice, stuck, barRef, onPay }) {
  return (
    <section ref={barRef} className={`stat is-${status.tone} ${stuck ? 'is-stuck' : ''}`} aria-label="Status of your matter">
      {stuck ? (
        <div className="stat-mini">
          <span className="stat-ico" aria-hidden="true">{status.tone === 'warn' ? '!' : 'i'}</span>
          <p>{status.mini}</p>
          <button type="button" className="stat-opt" onClick={() => jump('q5')}>Options <span aria-hidden="true">↓</span></button>
        </div>
      ) : (
        <div className="stat-full">
          <div className="stat-col stat-who">
            <h2 className="stat-h"><span className="stat-ico" aria-hidden="true">{status.tone === 'warn' ? '!' : 'i'}</span>{status.stage}</h2>
            <p className="stat-lead">{status.headline}</p>
            <ul className="stat-agencies" aria-label="Who is involved">
              {status.who.map((w) => <li key={w.name}><span className="stat-ag">{w.name}</span> {w.role}</li>)}
            </ul>
          </div>
          <div className="stat-col">
            <h2 className="stat-h">What happens next</h2>
            <p>{status.next}</p>
          </div>
          <div className="stat-col">
            <h2 className="stat-h">Your options</h2>
            <p>{status.rights}</p>
            <div className="stat-act">
              <Handoff what="Paying" notice={notice}><Button type="button" size="sm" onClick={onPay}>{status.payLabel}<span aria-hidden="true"> ↗</span></Button></Handoff>
              <button type="button" className="pub-link" onClick={() => jump('q5')}>All your options</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
