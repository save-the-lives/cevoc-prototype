import React from 'react';
import { useAssets, resolveVideo, asset } from '../services/assets.js';

// Sample video player with caption and download. Supplied videos (manifest) replace bundled samples.
export default function VideoPlayer({ video, downloadName }) {
  const manifest = useAssets();
  const src = resolveVideo(manifest, video.slot, video.fallback);
  return (
    <div className="cevoc-video">
      <figure style={{ margin: 0 }}>
        <video key={video.id} controls playsInline preload="metadata" poster={video.poster ? asset(`placeholders/${video.poster}`) : undefined} src={src}>
          Your browser can’t play this video.
        </video>
        <figcaption className="cevoc-gallery__caption">
          {video.title} · {video.id} · no audio
        </figcaption>
      </figure>
      <div className="cevoc-actions">
        <a className="nsw-button nsw-button--dark-outline" href={src} download={downloadName || `${video.id}-SAMPLE.mp4`}>
          Download video
        </a>
      </div>
    </div>
  );
}
