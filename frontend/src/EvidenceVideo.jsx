import { useCallback, useEffect, useRef, useState } from 'react';
import ZoomPan from './ZoomPan.jsx';
import { useInView } from './useInView.js';
import { downloadHref, isHls, isPoorConnection, isSmallScreen, pickLevels } from './media.js';

/**
 * Adaptive video. .m3u8 -> hls.js (loaded on demand), Safari/iOS native HLS as fallback,
 * anything else plays as a plain file. Loads only when scrolled near the viewport; segments
 * are fetched on first play. Each instance has its own loading and error state.
 */
export default function EvidenceVideo({ item, bare = false }) {
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
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!seen || !video) return undefined;
    let dead = false;
    setStatus('loading');
    setErrorText('');
    setLevels([]);
    setQuality(-1);

    if (!isHls(item.url)) {
      setPreparing(false);
      video.src = item.url;
      setStatus('ready'); // preload=none: nothing fetched until play; failures surface via onError
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
          fail('The video stream could not be loaded. Try again shortly.');
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

  // Auto-retry: when the video is being prepared (blur running server-side), poll every 5s
  const retryTimer = useRef(null);
  useEffect(() => {
    if (preparing && status === 'error') {
      retryTimer.current = setTimeout(() => setTries((t) => t + 1), 5000);
    }
    return () => { if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, [preparing, status, tries]);

  const videoEl = (
    <>
      <video
        ref={videoRef}
        className="media-video"
        controls
        playsInline
        webkit-playsinline=""
        preload="none"
        poster={item.posterUrl}
        aria-label={item.title}
        onPlay={() => { setPlaying(true); hlsRef.current?.startLoad(); }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime({ t: e.currentTarget.currentTime, d: e.currentTarget.duration || 0 })}
        onError={() => {
          if (hlsRef.current || !videoRef.current?.getAttribute('src')) return;
          fetch(item.url, { method: 'GET', mode: 'cors' }).then(res => {
            if (res.status === 451) { fail('The server is blurring this video for privacy.'); setPreparing(true); }
            else if (res.status === 503) fail('The video service is temporarily unavailable.');
            else fail('');
          }).catch(() => { fail(''); setPreparing(true); });
        }}
      >
        {item.captionsUrl && <track kind="captions" src={item.captionsUrl} srcLang={item.captionsLang || 'en'} label="English captions" />}
        Your browser does not support embedded video.
      </video>
      {status === 'loading' && <div className="media-overlay" aria-hidden="true">Loading video…</div>}
    </>
  );

  return (
    <div ref={boxRef} className="media-body">
      {/* NSW DS compact page notification — inline, not a big box */}
      {status === 'error' && (
        <div className={`nsw-notification nsw-notification--${preparing ? 'info' : 'error'}`} role="alert" style={{ marginBottom: 8 }}>
          <svg className="nsw-notification__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            {preparing
              ? <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              : <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>}
          </svg>
          <p className="nsw-notification__content">
            {preparing
              ? 'Preparing video for safe viewing…'
              : <>{errorText || 'This video could not be loaded.'} <button type="button" className="linklike" onClick={() => setTries((t) => t + 1)}>Try again</button></>}
          </p>
        </div>
      )}
      {bare ? videoEl : (
        <ZoomPan label={`${item.title}, video`} controlsAtRest renderTools={tools} onFullscreenFallback={fsFallback}>
          {videoEl}
        </ZoomPan>
      )}
      {href && <a className="dl" href={href} download>Download original<span className="sr-only"> of {item.title}</span></a>}
    </div>
  );
}
