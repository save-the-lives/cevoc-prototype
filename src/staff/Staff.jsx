import React, { useState } from 'react';
import { Link } from '../components/ui.jsx';
import { asset } from '../services/assets.js';
import { useApp } from '../state.js';
import { NOTES } from '../explain/notes.js';

// Two separate front doors:
//  - Public site: notice recipients. No sign-in, no officer links, never shows officer data.
//  - Staff portal (/officer...): Revenue NSW and Transport officers. Organisation sign-in (SSO),
//    its own header, its own links. In the target state this would be a separate host name.

function Logo() {
  const [failed, setFailed] = useState(false);
  if (!failed)
    return <img className="cevoc-logo" src={asset('brand/nsw-government-logo.svg')} alt="NSW Government" onError={() => setFailed(true)} />;
  return (
    <span className="cevoc-logo-text" aria-label="NSW Government">
      <span>NSW</span>
      <span>GOVERNMENT</span>
    </span>
  );
}

// Public header: no officer sign-in, no staff chip.
export function PublicHeader() {
  return (
    <>
      <a className="nsw-skip" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>
        Skip to content
      </a>
      <div className="nsw-masthead">
        <div className="nsw-container">A NSW Government website</div>
      </div>
      <div className="cevoc-prototype-bar" role="note">
        <div className="nsw-container">
          <strong>Prototype</strong> · All data and images are fictitious. <Link to="/about">About this prototype</Link>
          <span className="pub-staffnote">
            Testers: officers use a <Link to="/officer">separate staff portal ↗</Link>
          </span>
        </div>
      </div>
      <header className="nsw-header">
        <div className="nsw-container nsw-header__inner">
          <Link to="/" className="nsw-header__brand">
            <Logo />
            <span className="nsw-header__name">
              <strong>Camera enforcement information</strong>
              <span>Transport for NSW</span>
            </span>
          </Link>
          <nav className="nsw-header__nav" aria-label="Main">
            <Link to="/notice">Your fine</Link>
            <Link to="/cameras">Cameras and certificates</Link>
          </nav>
        </div>
      </header>
    </>
  );
}

// Keeps staff inside the staff portal: links to shared pages are rewritten to staff routes.
function staffTarget(href) {
  if (href === '/') return '/officer/home';
  if (/^\/(cameras|certificates)(\/|$)/.test(href)) return `/officer${href}`;
  return null;
}

export function StaffFrame({ children }) {
  const app = useApp();
  const keepInside = (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href^="#/"]') : null;
    if (!a) return;
    const to = staffTarget(a.getAttribute('href').slice(1));
    if (to) {
      e.preventDefault();
      window.location.hash = to;
    }
  };
  return (
    <div className="staff" onClickCapture={keepInside}>
      <div className="staff-bar">
        <div className="staff-bar__inner">
          <span className="staff-bar__brand">CEVOC <strong>Staff</strong></span>
          <span className="staff-bar__tag">Internal portal for Revenue NSW and Transport for NSW officers · separate from the public site</span>
          <span className="staff-bar__who">{app && app.officer ? app.officer.email : 'Not signed in'}</span>
        </div>
      </div>
      <main id="main-content" tabIndex={-1} className="staff-main">{children}</main>
      <footer className="staff-foot">CEVOC staff portal (prototype) · Access is role-based and logged · Mock identities only</footer>
    </div>
  );
}

export const STAFF_NOTES = [
  {
    id: 'staff-bar', selector: '.staff-bar', title: 'Separate staff portal',
    why: 'Notice recipients and officers have different jobs. A recipient wants to understand one fine and decide what to do. An officer works a queue, checks restricted evidence and records defensible decisions. So they get different front doors, different sign-in, and different navigation. Nothing on the public site links to officer sign-in.',
    who: 'Alex (Revenue NSW), Sam and Jo (Transport); protects every notice recipient', principle: 'Same data, different lenses',
    sad: 'CAP-02, CAP-03; network and identity boundary', status: 'Target: separate host name and session. Here: separate route and frame.',
  },
  {
    id: 'staff-session', selector: '.staff-main', title: 'Officer session stays in the staff portal',
    why: 'An officer’s sign-in doesn’t carry over to public pages, and public pages never show restricted fields, even in the same browser. Links to cameras and certificates open the staff version.',
    who: 'Officers; Privacy and Cyber', principle: 'Same data, different lenses', status: 'Prototype behaviour to confirm with Cyber',
  },
  {
    id: 'pub-staffnote', selector: '.pub-staffnote', title: 'No officer sign-in on the public site',
    why: 'This link is for testers only. On the real public site there is no officer sign-in at all, so recipients aren’t confused and the staff login isn’t advertised.',
    who: 'Testers', principle: 'Honest about scope', status: 'Prototype-only',
  },
];
for (const note of STAFF_NOTES) if (!NOTES.some((x) => x.id === note.id)) NOTES.push(note);
