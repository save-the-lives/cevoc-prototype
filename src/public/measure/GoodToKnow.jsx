import { useState } from 'react';
import { CARDS } from './content.js';
import Icon from './Icon.jsx';

const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// Teaching cards, specific to the camera program that recorded the offence.
export default function GoodToKnow({ program }) {
  const cards = CARDS[program] || [];
  // folded by default: the page answers the main questions first, and this is there when someone wants it
  const [open, setOpen] = useState(false);
  if (!cards.length) return null;
  return (
    <details className="ms-know" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary><span className="ms-know__chev" aria-hidden="true" /><span>How does this road safety camera work?</span></summary>
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
