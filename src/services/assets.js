import { createContext, useContext, useEffect, useState } from 'react';

const BASE = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
export const asset = (p) => `${BASE}assets/${p.replace(/^\//, '')}`;

const EMPTY = { images: [], videos: [] };
export const AssetContext = createContext(EMPTY);
export const useAssets = () => useContext(AssetContext);

// Loads public/assets/manifest.json (written by `npm run assets:fetch` / `assets:scan`).
export function useManifestLoader() {
  const [manifest, setManifest] = useState(EMPTY);
  useEffect(() => {
    fetch(asset('manifest.json'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((m) => setManifest({ images: m.images || [], videos: m.videos || [] }))
      .catch(() => setManifest(EMPTY));
  }, []);
  return manifest;
}

export function resolveImage(manifest, slot, fallback) {
  const imgs = manifest.images || [];
  if (imgs.length && slot != null) return asset(imgs[slot % imgs.length].file);
  return asset(`placeholders/${fallback}`);
}

// Supplied videos (public/assets/media via manifest) take priority; otherwise the bundled sample clip is used.
export function resolveVideo(manifest, slot, fallback) {
  const vids = manifest.videos || [];
  if (vids.length && slot != null) return asset(vids[slot % vids.length].file);
  return fallback ? asset(`placeholders/${fallback}`) : null;
}
