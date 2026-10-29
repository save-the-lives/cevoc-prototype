import { useEffect, useMemo, useState } from 'react';
import { KIND, classifyMedia } from '../../lib/media.js';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
const url = (p) => `${BASE}${p}`;

// The evidence at a glance. The prime facie image leads; identification, additional images and video
// sit below in labelled groups so it is always clear what carries weight. Left and right arrows step through.
export default function EvidenceViewer({ items, program }) {
  const list = useMemo(() => classifyMedia(items, program), [items, program]);
  const [i, setI] = useState(0);
  const n = list.length;
  const item = list[i];

  useEffect(() => { setI(0); }, [items]);
  useEffect(() => {
    if (n < 2) return undefined;
    const on = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target;
      if (t && (/^(input|textarea|select|video)$/i.test(t.tagName) || t.isContentEditable || t.closest?.('[role="menu"],[role="tablist"],[role="tab"],[role="listbox"],[role="radio"],[role="slider"],[role="separator"],[data-keys="own"]'))) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      setI((x) => (x + (e.key === 'ArrowRight' ? 1 : -1) + n) % n);
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [n]);

  if (!n) return <p className="st-muted">No images or video are held for this notice.</p>;
  const groups = Object.keys(KIND).map((k) => ({ k, rows: list.map((m, idx) => ({ m, idx })).filter((x) => x.m.kind === k) })).filter((g) => g.rows.length);

  return (
    <div className="evv">
      <div className={`evv-stage is-${item.kind}`}>
        <span className={`evv-badge is-${item.kind}`}>{KIND[item.kind].label}</span>
        {item.type === 'video'
          ? <video key={item.id} controls playsInline preload="metadata" poster={url(item.poster)} src={url(item.src)}>Your browser can’t play this video.</video>
          : <img key={item.id} src={url(item.src)} alt={item.caption} />}
        {n > 1 && (
          <>
            <button type="button" className="evv-nav is-prev" onClick={() => setI((x) => (x - 1 + n) % n)} aria-label="Previous (left arrow)">‹</button>
            <button type="button" className="evv-nav is-next" onClick={() => setI((x) => (x + 1) % n)} aria-label="Next (right arrow)">›</button>
          </>
        )}
      </div>
      <p className="evv-cap"><strong>{item.caption}</strong><span>{i + 1} of {n} · {KIND[item.kind].note} · <kbd>←</kbd> <kbd>→</kbd></span></p>
      {item.type === 'video' && item.description && <p className="evv-desc"><b>Text description:</b> {item.description}</p>}
      <div className="evv-groups">
        {groups.map((g) => (
          <div key={g.k} className={`evv-grp is-${g.k}`}>
            <span className="evv-grp__h">{KIND[g.k].label}</span>
            <div className="evv-grp__row">
              {g.rows.map(({ m, idx }) => (
                <button key={m.id} type="button" className={`evv-thumb ${idx === i ? 'is-on' : ''}`} aria-pressed={idx === i} aria-label={`${KIND[g.k].label}: ${m.caption}`} onClick={() => setI(idx)}>
                  <img src={url(m.type === 'video' ? m.poster : m.src)} alt="" />
                  {m.type === 'video' && <span className="evv-play" aria-hidden="true">▶</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
