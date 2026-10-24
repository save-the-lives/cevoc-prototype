import { useState } from 'react';
import Icon from './Icon.jsx';

// A calm road-safety reminder under the speed scale. Where it can, it works from the person's own numbers
// (physics, not statistics), so it is a fact about their trip rather than a lecture. One is picked at random
// and "Another reminder" cycles through the rest. Anything that quotes a statistic is marked as a placeholder.
const stop = (kmh) => { const v = kmh / 3.6; return v * 1.5 + (v * v) / (2 * 0.7 * 9.81); }; // 1.5 s to react, dry road
const m = (x) => Math.round(x);

function notes({ speed, limit }) {
  const over = speed > limit;
  const list = [];
  if (over) {
    const a = stop(speed); const b = stop(limit); const cars = Math.max(1, Math.round((a - b) / 4.5));
    list.push({ id: 'stop', text: <>At <strong>{speed} km/h</strong> a car needs about <strong>{m(a)} m</strong> to stop. At {limit} km/h it needs about {m(b)} m. That extra {m(a - b)} m is roughly {cars} car {cars === 1 ? 'length' : 'lengths'}.</>, foot: 'Assumes 1.5 seconds to react and a dry road.' });
    const more = Math.round(((speed * speed) / (limit * limit) - 1) * 100);
    list.push({ id: 'energy', text: <>A crash at {speed} km/h carries about <strong>{more}% more energy</strong> than one at {limit} km/h. A small change in speed makes a bigger difference than it feels like.</>, foot: 'Crash energy rises with the square of speed.' });
  }
  list.push({ id: 'walk', text: 'People on foot are far more likely to survive being hit at lower speeds. Every km/h counts near schools, shops and crossings.' });
  list.push({ id: 'slogan', text: 'A few km/h can change a whole life. Slow down, arrive.' });
  list.push({ id: 'stat', text: <>Speed is a factor in around <strong>[X]%</strong> of road deaths in NSW each year.</>, foot: 'Prototype placeholder. Transport to supply the current figure.' });
  return list;
}

export default function SafetyNote({ speed, limit }) {
  const [start] = useState(() => Math.floor(Math.random() * 4));
  const [k, setK] = useState(start);
  const list = notes({ speed, limit });
  const note = list[k % list.length];
  return (
    <aside className="sn" aria-label="Road safety reminder">
      <span className="sn-ico"><Icon name="slow" /></span>
      <div>
        <p className="sn-h">Road safety</p>
        <p className="sn-t">{note.text}</p>
        {note.foot && <p className="sn-f">{note.foot}</p>}
        <button type="button" className="pub-link" onClick={() => setK((x) => x + 1)}>Another reminder ↻</button>
      </div>
    </aside>
  );
}
