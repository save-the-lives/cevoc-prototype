import React, { useState } from 'react';
import { Dialog, Button, StatusTag } from './ui.jsx';
import { useAssets, resolveImage } from '../services/assets.js';

export default function Gallery({ images, idPrefix }) {
  const manifest = useAssets();
  const [open, setOpen] = useState(null);
  const visible = images.filter((i) => i.status === 'published');

  const show = (img) => setOpen(visible.findIndex((v) => v.id === img.id));
  const current = open != null ? visible[open] : null;

  return (
    <>
      <ul className="cevoc-gallery">
        {images.map((img) =>
          img.status === 'published' ? (
            <li key={img.id}>
              <button type="button" className="cevoc-gallery__thumb" onClick={() => show(img)} aria-label={`View larger: ${img.caption}`}>
                <img src={resolveImage(manifest, img.slot, img.fallback)} alt={img.caption} loading="lazy" />
              </button>
              <p className="cevoc-gallery__caption">{img.caption}</p>
            </li>
          ) : (
            <li key={img.id}>
              <div className="cevoc-gallery__withdrawn">
                <StatusTag status="withdrawn" label="Not available" />
                <p>This image is not currently available through this service.</p>
              </div>
              <p className="cevoc-gallery__caption">{img.caption}</p>
            </li>
          )
        )}
      </ul>

      {current && (
        <Dialog wide title={current.caption} onClose={() => setOpen(null)}>
          <img className="cevoc-lightbox__img" src={resolveImage(manifest, current.slot, current.fallback)} alt={current.caption} />
          <div className="cevoc-lightbox__bar">
            <span>
              Image {open + 1} of {visible.length} · {current.id}
            </span>
            <div className="cevoc-actions">
              <Button variant="dark-outline" disabled={open === 0} onClick={() => setOpen(open - 1)}>
                ← Previous
              </Button>
              <Button variant="dark-outline" disabled={open === visible.length - 1} onClick={() => setOpen(open + 1)}>
                Next →
              </Button>
              <a className="nsw-button nsw-button--dark" href={resolveImage(manifest, current.slot, current.fallback)} download={`${idPrefix}-${current.id}`}>
                Download image
              </a>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
