import { useEffect, useMemo } from 'react';
import EvidenceItem from './EvidenceItem.jsx';
import { QueueContext, loadJob } from './evidenceLoader.js';
import { downloadHref } from './media.js';
import { usePhone } from './phone.js';
import { createLoadQueue, jobsFor, saveDataOn } from './loadQueue.js';

/** Photos shown before the fold: their thumbnails load eagerly and gate the start of the full-size queue. */
const EAGER = 3;

/**
 * The grid of photos, videos and certificate files, loaded on demand (its own chunk) so the notice details paint first.
 * It owns the loading order: thumbnails, then the first photo in full, then everything else in the background.
 */
/** Number photos sequentially (1, 2, 3) regardless of their original title. */
function numbered(items) {
  let n = 0;
  return items.map((e) => e.kind === 'IMAGE' ? { ...e, photoNumber: ++n } : e);
}

export default function EvidenceGrid({ items }) {
  const phone = usePhone();
  const enriched = useMemo(() => numbered(items), [items]);
  const key = items.map((e) => e.url).join('|');
  const ctx = useMemo(() => {
    const jobs = jobsFor(items);
    const queue = createLoadQueue({ jobs, load: loadJob, saveData: saveDataOn() });
    const photos = jobs.filter((j) => j.kind === 'image').slice(0, EAGER).map((j) => j.id);
    const waiting = new Set(photos);
    const thumbDone = (id) => {
      waiting.delete(id);
      if (waiting.size === 0) queue.thumbnailsSettled();
    };
    if (photos.length === 0) queue.thumbnailsSettled();
    return { queue, thumbDone, eager: photos, photos: items.filter((e) => e.kind === 'IMAGE') };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // A thumbnail that never settles (a stalled connection) must not hold the queue for ever.
  useEffect(() => {
    const t = setTimeout(() => ctx.queue.thumbnailsSettled(), 5000);
    return () => clearTimeout(t);
  }, [ctx]);

  const photoDownloads = items.filter((e) => e.kind === 'IMAGE').map((e) => downloadHref(e)).filter(Boolean);
  const hasVideo = items.some((e) => e.kind === 'VIDEO');
  const hasNonDownloadableVideo = items.some((e) => e.kind === 'VIDEO' && !downloadHref(e));

  return (
    <QueueContext.Provider value={ctx}>
      {phone && ctx.photos.length > 0 && <p className="hint">Double tap a photo to see it full screen.</p>}
      <ul className="grid">{enriched.map((e) => <EvidenceItem key={e.url} item={e} />)}</ul>
      {photoDownloads.length > 1 && (
        <div className="evidence-actions">
          <button type="button" className="btn" onClick={() => photoDownloads.forEach((href) => {
            const a = document.createElement('a'); a.href = href; a.download = ''; document.body.appendChild(a); a.click(); a.remove();
          })}>Download all photos</button>
        </div>
      )}
      {hasNonDownloadableVideo && <p className="hint">Video evidence cannot be downloaded.</p>}
    </QueueContext.Provider>
  );
}
