import { useEffect, useRef, useState } from 'react';

export const Link = ({ to, children, ...rest }) => <a href={`#${to}`} {...rest}>{children}</a>;

export function Dialog({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const keys = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const f = [...ref.current.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('keydown', keys); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="dlg-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dlg ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="dlg-head">
          <h2>{title}</h2>
          <button type="button" className="dlg-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Brand assets live in public/brand/. Text lockups show until the files are added.
const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
export function Brand({ file, alt, fallback, className = 'brand-logo' }) {
  const [ok, setOk] = useState(true);
  if (!ok) return fallback;
  return <img className={className} src={`${BASE}brand/${file}`} alt={alt} onError={() => setOk(false)} />;
}

export const NswLockup = () => (
  <Brand file="nsw-government.svg" alt="NSW Government" fallback={
    <span className="lockup-nsw" aria-label="NSW Government"><span className="lockup-waratah" aria-hidden="true">✿</span><span><b>NSW</b><small>GOVERNMENT</small></span></span>
  } />
);

export const AgencyLockup = ({ agency }) => agency === 'rnsw'
  ? <Brand file="revenue-nsw.svg" alt="Revenue NSW" fallback={<span className="lockup-agency is-rnsw">Revenue NSW</span>} />
  : <Brand file="transport.svg" alt="Transport for NSW" fallback={<span className="lockup-agency is-tfnsw">Transport for NSW</span>} />;

// The only demo affordance on the public and staff sites.
export function DemoDock() {
  const { hash } = window.location;
  if (hash.includes('clean=1')) return null;
  return <aside aria-label="Prototype controls"><a className="demo-dock" href="#/demo">◂ Demo hub</a></aside>;
}

export const Spinner = () => <span className="spin" aria-hidden="true" />;
