import { useState } from 'react';
import { CARDS } from './content.js';
import Icon from './Icon.jsx';

const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// Teaching cards, specific to the camera program that recorded the offence.
export default function GoodToKnow({ program }) {
  const cards = CARDS[program] || [];
  // open on larger screens, folded on a phone to save space
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 641px)').matches);
  if (!cards.length) return null;
  return (
    <details className="ms-know" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary><span className="ms-know__chev" aria-hidden="true" /><span>Good to know about this kind of camera</span><small>{cards.length} things</small></summary>
      <ul>
        {cards.map((c) => (
          <li key={c.title}>
            <span className="ms-know__ico"><Icon name={c.icon} /></span>
            <div>
              <strong>{c.title}</strong>
              <p>{c.text}</p>
              {c.link && <button type="button" className="pub-link" onClick={() => jump(c.link)}>{c.linkText} ↓</button>}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
