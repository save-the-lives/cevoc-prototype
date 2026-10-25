import { Link } from '../shared/ui.jsx';
import { ARCHETYPES } from './content.js';
import Overview from './sections/Overview.jsx';
import Archetype from './sections/Archetype.jsx';
import Controls from './sections/Controls.jsx';
import Capabilities from './sections/Capabilities.jsx';
import { PublicScenarios, StaffScenarios } from './sections/Scenarios.jsx';
import { InfoArchitecture, Journey, Questions } from './sections/Reference.jsx';

// DEMO HUB: the only place for scenarios, framing, controls and open questions.
// A left menu groups it by who the person is, so nothing is buried at the bottom of one long page.

const SECTIONS = {
  overview: { label: 'Overview', render: () => <Overview /> },
  'public-scenarios': { label: 'Public scenarios', render: () => <PublicScenarios /> },
  'staff-scenarios': { label: 'Staff scenarios', render: () => <StaffScenarios /> },
  journey: { label: 'The journey', render: () => <Journey /> },
  ia: { label: 'Information architecture', render: () => <InfoArchitecture /> },
  questions: { label: 'Open questions', render: () => <Questions /> },
  capabilities: { label: 'Capability status', render: () => <Capabilities /> },
  controls: { label: 'Run mode and reset', render: () => <Controls /> },
  ...Object.fromEntries(ARCHETYPES.map((a) => [a.id, { label: a.name, render: () => <Archetype a={a} /> }])),
};

const MENU = [
  { items: ['overview'] },
  { title: 'User kinds', items: ARCHETYPES.map((a) => a.id) },
  { title: 'Scenarios', items: ['public-scenarios', 'staff-scenarios'] },
  { title: 'Reference', items: ['capabilities', 'journey', 'ia', 'questions'] },
  { title: 'Controls', items: ['controls'] },
];

export default function Demo({ section }) {
  const key = SECTIONS[section] ? section : 'overview';
  return (
    <div className="demo demo--menu">
      <nav className="demo-menu" aria-label="Demo hub">
        <Link to="/demo" className="demo-menu__brand">CEVOC <small>demo hub</small></Link>
        {MENU.map((g, i) => (
          <div key={g.title || i} className="demo-menu__group">
            {g.title && <p className="demo-menu__h">{g.title}</p>}
            {g.items.map((id) => (
              <Link key={id} to={id === 'overview' ? '/demo' : `/demo/${id}`} className={id === key ? 'on' : ''} aria-current={id === key ? 'page' : undefined}>{SECTIONS[id].label}</Link>
            ))}
          </div>
        ))}
        <div className="demo-menu__group demo-menu__go">
          <p className="demo-menu__h">Open the prototype</p>
          <Link to="/">Public site ↗</Link>
          <Link to="/staff">Staff workspace ↗</Link>
        </div>
      </nav>
      <main className="demo-main" id="main" key={key}>{SECTIONS[key].render()}</main>
    </div>
  );
}
