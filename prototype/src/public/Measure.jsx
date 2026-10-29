import { site as findSite } from '../data.js';
import SpeedScale from './measure/SpeedScale.jsx';
import GoodToKnow from './measure/GoodToKnow.jsx';

// Program-specific "how it was measured" panel. Same slot on every page, different teaching content per camera program:
// a picture of the measurement first, then a few things worth knowing about that kind of camera.
export default function Measure({ n, program }) {
  const s = findSite(n.site);
  let visual;

  if (program === 'AVERAGE_SPEED') {
    const mins = Math.round((n.segment.distanceKm / n.speed) * 60);
    const limit = /heavy/i.test(n.vehicle) ? s.heavyLimit || s.limit : s.limit;
    visual = (
      <>
        <div className="ms-seg">
          <div className="ms-pt"><span>Point A</span><strong>{n.segment.timeA}</strong></div>
          <div className="ms-line"><span>{n.segment.distanceKm} km surveyed distance</span></div>
          <div className="ms-pt"><span>Point B</span><strong>{n.segment.timeB}</strong></div>
        </div>
        <p className="ms-formula" aria-label={`${n.segment.distanceKm} kilometres divided by ${mins} minutes is ${n.speed} kilometres an hour`}>
          <span>{n.segment.distanceKm} km</span><i>÷</i><span>{mins} min</span><i>=</i><strong>{n.speed} km/h</strong>
        </p>
        <p className="ms-calc">That is the average over the whole length. The limit on this length is {limit} km/h.</p>
        <SpeedScale speed={n.speed} limit={limit} vehicle={n.vehicle} dateTime={n.dateTime} readingLabel="Your average" />
      </>
    );
  } else if (program === 'RED_LIGHT_SPEED') {
    const amber = 4;
    const total = 3 + amber + n.redFor + 1.5;
    const pct = (v) => `${(v / total) * 100}%`;
    visual = (
      <>
        <div className="ms-signal" role="img" aria-label={`Signal sequence. The light had been red for ${n.redFor} seconds when the vehicle crossed the stop line.`}>
          <span className="g" style={{ width: pct(3) }}>Green</span>
          <span className="a" style={{ width: pct(amber) }}>Amber</span>
          <span className="r" style={{ width: pct(n.redFor + 1.5) }}>Red</span>
          <i style={{ left: pct(3 + amber + n.redFor) }}><b>Vehicle crossed</b></i>
        </div>
        <p className="ms-calc">The light had been red for <strong>{n.redFor} seconds</strong> when the vehicle crossed the stop line, travelling at {n.speed} km/h.</p>
        <SpeedScale speed={n.speed} limit={s.limit} vehicle={n.vehicle} dateTime={n.dateTime} readingLabel="Through the intersection" />
      </>
    );
  } else if (program === 'MOBILE_PHONE') {
    visual = (
      <ol className="ms-steps ms-flow">
        <li><span>1</span><strong>Camera</strong> photographed the driver’s area</li>
        <li><span>2</span><strong>Software</strong> flagged a possible phone</li>
        <li><span>3</span><strong>A trained person</strong> looked at the image and confirmed it</li>
        <li><span>4</span><strong>Passengers</strong> were blurred before anyone outside the review team saw it</li>
      </ol>
    );
  } else {
    visual = <SpeedScale speed={n.speed} limit={s.limit} vehicle={n.vehicle} dateTime={n.dateTime} />;
  }

  return (
    <div className="ms">
      {visual}
      <GoodToKnow program={program} />
    </div>
  );
}
