import React from 'react';
import { Link } from '../components/ui.jsx';
import { ENTRY_POINTS } from './AllEntries.jsx';

// Information architecture: today vs proposed, from the notice recipient's point of view.

const QA = [
  ['What happened?', 'Offence, date and time, place, vehicle, how long ago', 'Penalty notice; camera site record', 'Revenue NSW + Transport', 'Split across the notice, myPenalty and CEVOC'],
  ['Was it me?', 'Photos, plate close-up, video (future)', 'Image store; video (future)', 'Revenue NSW today (myPenalty)', 'myPenalty only'],
  ['Is the evidence enough?', 'Photos + measurement + legal checks in one plain answer', 'Notice, images, security indicators, certificates', 'Nobody today', 'Not answered anywhere'],
  ['Was the camera certified at the time?', 'Each required certificate checked against the offence date', 'Certificate records (s137, s138, s132, s257)', 'Transport today (CEVOC)', 'CEVOC, but the person must find the camera and date themselves'],
  ['What can I do?', 'Pay, plan, review, nominate, court, with the due date', 'Revenue NSW case and payment systems', 'Revenue NSW / Service NSW', 'MyServiceNSW and myPenalty'],
];

export default function IA() {
  return (
    <div className="ia">
      <div className="ia__inner">
        <p className="ia__tag">Information architecture · for testers and stakeholders</p>
        <h1>Organised around the person, not the agency</h1>
        <p className="ia__lede">
          Someone who’s been fined wants to know what happened, whether it was them, whether the evidence holds up, and whether the camera was certified.
          Today those answers are split between Revenue NSW and Transport, and one of them isn’t answered at all.
        </p>

        <div className="ia__compare">
          <div className="ia__col">
            <h2>Today</h2>
            <div className="ia__silo is-rnsw">
              <strong>Revenue NSW · myPenalty / MyFines</strong>
              <span>Notice details · photos · pay / review / nominate</span>
            </div>
            <div className="ia__gap">The person stitches these together themselves</div>
            <div className="ia__silo is-tf">
              <strong>Transport · CEVOC</strong>
              <span>Camera certificates only · search by camera and date</span>
            </div>
            <div className="ia__silo is-none">
              <strong>Nobody</strong>
              <span>“Is the evidence enough?”</span>
            </div>
          </div>
          <div className="ia__arrow" aria-hidden="true">→</div>
          <div className="ia__col">
            <h2>Proposed</h2>
            <div className="ia__story">
              <strong>Your fine, explained</strong>
              <ol>
                <li>What happened?</li>
                <li>Was it me?</li>
                <li>Is the evidence enough?</li>
                <li>Was the camera certified?</li>
                <li>What can I do? → back to Revenue NSW / Service NSW</li>
              </ol>
              <span>One page. Data from both agencies behind it. Agency boundaries invisible to the person.</span>
            </div>
            <Link to="/notice?n=3162457894&r=HVY321" className="ia__try">Try it with a fine ↗</Link>
          </div>
        </div>

        <h2>Questions, content and where the data lives</h2>
        <div className="ia__table-wrap">
          <table className="ia__table">
            <thead>
              <tr><th>The person asks</th><th>What we show</th><th>Data behind it</th><th>Owner today</th><th>Where they find it today</th></tr>
            </thead>
            <tbody>
              {QA.map((r) => (
                <tr key={r[0]}>{r.map((c, i) => <td key={i}>{i === 0 ? <strong>{c}</strong> : c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Every door leads to the same answer</h2>
        <div className="ia__doors">
          {ENTRY_POINTS.map((e) => (
            <Link key={e.id} to={e.to} className="ia__door">
              <strong>{e.name}</strong>
              <span>→ {e.lands}</span>
            </Link>
          ))}
        </div>

        <h2>What this means for CEVOC</h2>
        <ul className="ia__list">
          <li><strong>Moves into Revenue NSW territory</strong> by showing incident images and, later, video next to the certificates. Needs agreement on who owns the combined page and on image access rules.</li>
          <li><strong>Keeps the certificate role</strong>, now matched automatically to the fine’s camera and date instead of a manual search.</li>
          <li><strong>Hands actions back</strong>: pay, review, nominate and court stay with Revenue NSW and Service NSW.</li>
          <li><strong>Still serves people without a fine</strong> through camera search.</li>
        </ul>
        <p className="ia__muted">Ownership, image access and the combined page are open questions for Revenue NSW, Transport, Legal and Privacy.</p>
      </div>
    </div>
  );
}
