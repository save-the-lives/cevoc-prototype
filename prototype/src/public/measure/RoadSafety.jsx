import Icon from './Icon.jsx';
import { safetyLines } from './safety.js';

// A short, calm note under the speed scale. It explains why the limit is where it is, in terms of this road and this
// vehicle, and then stops. Nothing to click or slide: this is information, not a game.
export default function RoadSafety({ speed, limit, vehicle, dateTime }) {
  const lines = safetyLines({ speed, limit, vehicle, dateTime });
  const foot = lines.find((l) => l.foot)?.foot;
  return (
    <details className="rs">
      <summary className="rs-h">Why the limit is {limit} here</summary>
      <ul>
        {lines.map((l) => <li key={l.text}><span className="rs-ico"><Icon name={l.icon} /></span><p>{l.text}</p></li>)}
      </ul>
      <p className="rs-goal">NSW’s road safety goal, <em>Towards Zero</em>, is no deaths or serious injuries on our roads. Speed is a factor in around <strong>[X]%</strong> of road deaths in NSW.</p>
      <p className="rs-foot">{foot ? `${foot} ` : ''}Prototype wording: figures to be confirmed with Transport for NSW’s Centre for Road Safety.</p>
    </details>
  );
}
