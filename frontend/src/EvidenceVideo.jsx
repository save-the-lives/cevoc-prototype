import { useCallback, useEffect, useRef, useState } from 'react';
import ZoomPan from './ZoomPan.jsx';
import { useInView } from './useInView.js';
import { downloadHref, isHls, isPoorConnection, isSmallScreen, pickLevels } from './media.js';

/**
 * Adaptive video. .m3u8 -> hls.js (loaded on demand), Safari/iOS native HLS as fallback,
 * anything else plays as a plain file. Loads only when scrolled near the viewport; segments
 * are fetched on first play. Each instance has its own loading and error state.
 */
export default function EvidenceVideo({ item }) {
  const [boxRef, seen] = useInView();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [errorText, setErrorText] = useState('');
  const [levels, setLevels] = useState([]);
  const [quality, setQuality] = useState(-1);
  const [tries, setTries] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ t: 0, d: 0 });

  const fail = useCallback((msg) => { setErrorText(msg); setStatus('error'); }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!seen || !video) return undefined;
    let dead = false;
    setStatus('loading');
    setErrorText('');
    setLevels([]);
    setQuality(-1);

    if (!isHls(item.url)) {
      video.src = item.url;
      setStatus('ready'); // preload=none: nothing is fetched until play; failures surface via onError
      return () => { dead = true; video.removeAttribute('src'); video.load(); };
    }

    (async () => {
      let Hls = null;
      try { ({ default: Hls } = await import('hls.js')); } catch { /* fall through to native */ }
      if (dead) return;
      if (Hls && Hls.isSupported()) {
        const hls = new Hls({ autoStartLoad: false, capLevelToPlayerSize: false, maxBufferLength: 20 });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          const policy = pickLevels(data.levels, { small: isSmallScreen(), poor: isPoorConnection() });
          hls.autoLevelCapping = policy.capLevel;
          if (policy.startLevel >= 0) hls.startLevel = policy.startLevel;
          setLevels(data.levels.map((l, i) => ({ i, height: l.height })).sort((a, b) => b.height - a.height));
          setStatus('ready');
          // Play may have been pressed before hls.js was ready; its onPlay found no instance to start.
          if (!video.paused) hls.startLoad();
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
          hls.destroy();
          hlsRef.current = null;
          fail('This video could not be loaded.');
        });
        hls.loadSource(item.url);
        hls.attachMedia(video);
        // autoStartLoad is off: the manifest loads now, media segments load on first play.
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = item.url; // Safari / iOS native HLS (adapts by itself)
        setStatus('ready');
      } else {
        fail('This browser cannot play this video. Use Download original instead.');
      }
    })();

    return () => {
      dead = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [seen, item.url, tries, fail]);

  const onQuality = (e) => {
    const v = Number(e.target.value);
    setQuality(v);
    const hls = hlsRef.current;
    if (hls) { hls.autoLevelCapping = -1; hls.currentLevel = v; }
  };

  const toggle = () => { const v = videoRef.current; if (v.paused) v.play().catch(() => {}); else v.pause(); };
  const href = downloadHref(item);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const tools = (view) => (
    <>
      {levels.length > 1 && (
        <label className="zp-q">
          <span className="sr-only">Video quality</span>
          <select value={quality} onChange={onQuality} aria-label="Video quality">
            <option value={-1}>Auto</option>
            {levels.map((l) => <option key={l.i} value={l.i}>{l.height}p</option>)}
          </select>
        </label>
      )}
      {view.scale > 1 && (
        // Native controls are scaled with the picture, so offer the essentials while zoomed in.
        <span className="zp-vc">
          <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Pause' : 'Play'}</button>
          <input
            type="range" min="0" max={time.d || 0} step="0.1" value={time.t}
            aria-label="Seek" aria-valuetext={`${fmt(time.t)} of ${fmt(time.d)}`}
            onChange={(e) => { videoRef.current.currentTime = Number(e.target.value); }}
          />
        </span>
      )}
    </>
  );

  const fsFallback = () => videoRef.current?.webkitEnterFullscreen?.(); // iPhone Safari: video only

  return (
    <div ref={boxRef} className="media-body">
      <ZoomPan label={`${item.title}, video`} controlsAtRest renderTools={tools} onFullscreenFallback={fsFallback}>
        <video
          ref={videoRef}
          className="media-video"
          controls
          playsInline
          preload="none"
          poster={item.posterUrl}
          aria-label={item.title}
          onPlay={() => { setPlaying(true); hlsRef.current?.startLoad(); }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime({ t: e.currentTarget.currentTime, d: e.currentTarget.duration || 0 })}
          onError={() => { if (!hlsRef.current && videoRef.current?.getAttribute('src')) fail('This video could not be loaded.'); }}
        >
          {item.captionsUrl && <track kind="captions" src={item.captionsUrl} srcLang={item.captionsLang || 'en'} label="English captions" />}
          Your browser does not support embedded video.
        </video>
        {status === 'loading' && <div className="media-overlay" aria-hidden="true">Loading video...</div>}
      </ZoomPan>
      <p className="media-status" role={status === 'error' ? 'alert' : 'status'}>
        {status === 'loading' && 'Loading video...'}
        {status === 'error' && (
          <>
            {errorText}{' '}
            <button type="button" className="linklike" onClick={() => setTries((t) => t + 1)}>Try again</button>
          </>
        )}
      </p>
      {href && <a className="dl" href={href} download>Download original<span className="sr-only"> of {item.title}</span></a>}
    </div>
  );
}
