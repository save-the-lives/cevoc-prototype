import { useEffect, useState } from 'react';
import ZoomPan from './ZoomPan.jsx';
import { useInView } from './useInView.js';
import { downloadHref } from './media.js';

/** Light preview first, then the full-resolution file swaps in once it has loaded. */
export default function EvidenceImage({ item }) {
  const [ref, seen] = useInView();
  const hasPreview = !!item.previewUrl && item.previewUrl !== item.url;
  const [full, setFull] = useState(hasPreview ? 'idle' : 'loading'); // idle | loading | ready | error
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!seen) return undefined;
    setFull('loading');
    const img = new Image();
    let live = true;
    img.onload = () => { (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => live && setFull('ready')); };
    img.onerror = () => live && setFull('error');
    img.src = item.url;
    return () => { live = false; img.onload = null; img.onerror = null; };
  }, [seen, item.url, tries]);

  const src = full === 'ready' || !hasPreview ? item.url : item.previewUrl;
  const href = downloadHref(item);
  const alt = item.alt || item.title;

  return (
    <div ref={ref} className="media-body">
      <ZoomPan label={`${item.title}, image`}>
        {seen || hasPreview
          ? <img className="media-img" src={full === 'error' && hasPreview ? item.previewUrl : src} alt={alt} draggable="false" decoding="async" />
          : <div className="media-ph" aria-hidden="true" />}
      </ZoomPan>
      <p className="media-status" role="status">
        {full === 'loading' && 'Loading full resolution...'}
        {full === 'error' && (
          <>
            {hasPreview ? 'Showing a lower quality copy. ' : 'This image could not be loaded. '}
            <button type="button" className="linklike" onClick={() => setTries((t) => t + 1)}>Try again</button>
          </>
        )}
      </p>
      {href && <a className="dl" href={href} download>Download original<span className="sr-only"> of {item.title}</span></a>}
    </div>
  );
}
