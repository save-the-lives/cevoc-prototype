import React, { useState } from 'react';
import { Link, Button } from './ui.jsx';
import { useApp } from '../state.js';
import { asset } from '../services/assets.js';
import { SAMPLES } from '../data/mockData.js';

function Logo() {
  // Drop an approved NSW Government logo at public/assets/brand/nsw-government-logo.svg to replace the text lockup.
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

export function Header() {
  const { officer, signOut } = useApp();
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
          <strong>Prototype</strong> · All data and images are fictitious. No Transport or Revenue NSW systems are connected. <Link to="/about">About this prototype</Link>
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
            <Link to="/notice">View your offence</Link>
            <Link to="/cameras">Cameras and certificates</Link>
            {officer ? (
              <span className="cevoc-officer-chip">
                <Link to="/officer/home">{officer.org} officer</Link>
                <button type="button" className="cevoc-linkbutton" onClick={signOut}>Sign out</button>
              </span>
            ) : (
              <Link to="/officer">Officer sign in</Link>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="nsw-footer">
      <div className="nsw-container">
        <p className="nsw-footer__ack">
          We pay respect to the Traditional Custodians and First Peoples of NSW, and acknowledge their continued connection to their country and culture.
        </p>
        <ul className="nsw-footer__links">
          <li><Link to="/about">About this prototype</Link></li>
          <li><Link to="/about">Accessibility</Link></li>
          <li><Link to="/about">Privacy</Link></li>
          <li><Link to="/about">Copyright</Link></li>
        </ul>
        <p className="nsw-footer__copy">© State of New South Wales · CEVOC prototype · OFFICIAL · Demonstration only</p>
      </div>
    </footer>
  );
}

// Switch between the prototype (what users see) and the design studio (how and why).
export function ModeBar({ studio }) {
  return (
    <div className="cevoc-modebar" role="navigation" aria-label="Prototype or design studio">
      <span className="cevoc-modebar__label">Viewing:</span>
      <Link to="/" className={!studio ? 'is-on' : ''} aria-current={!studio ? 'page' : undefined}>Prototype <small>what people see</small></Link>
      <Link to="/studio/overview" className={studio ? 'is-on' : ''} aria-current={studio ? 'page' : undefined}>Design studio <small>who, why and how</small></Link>
    </div>
  );
}

export function DemoControls() {
  const { demo, setDemo, resetDemo } = useApp();
  return (
    <details className="cevoc-demo">
      <summary>Prototype controls</summary>
      <div className="cevoc-demo__body">
        <label>
          Response speed{' '}
          <select value={demo.latency} onChange={(e) => setDemo({ ...demo, latency: e.target.value })}>
            <option value="fast">Fast</option>
            <option value="normal">Normal</option>
            <option value="slow">Slow (2–3 s)</option>
            <option value="timeout">Timeout</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={demo.outage} onChange={(e) => setDemo({ ...demo, outage: e.target.checked })} />
          Simulate source-system outage
        </label>
        <label>
          <input type="checkbox" checked={demo.certOutage} onChange={(e) => setDemo({ ...demo, certOutage: e.target.checked })} />
          Certificate service down
        </label>
        <label>
          <input type="checkbox" checked={demo.imageOutage} onChange={(e) => setDemo({ ...demo, imageOutage: e.target.checked })} />
          Image service down
        </label>
        <label>
          <input type="checkbox" checked={demo.media} onChange={(e) => setDemo({ ...demo, media: e.target.checked })} />
          Show future video capability
        </label>
        <p className="cevoc-demo__h">Sample penalty notices</p>
        <ul>
          {SAMPLES.map((s) => (
            <li key={s.number}>
              <Link to={`/notice?n=${s.number}&r=${s.rego}`}>{s.number} / {s.rego}</Link>
              <br />
              <small>{s.label}</small>
            </li>
          ))}
        </ul>
        <div className="cevoc-actions">
          <Link className="nsw-button nsw-button--dark" to="/studio/resilience">Design studio</Link>
          <Button variant="dark-outline" onClick={resetDemo}>Reset demo</Button>
        </div>
      </div>
    </details>
  );
}
