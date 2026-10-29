import { useEffect, useRef, useState } from 'react';

// Keeps a notice page oriented as the person scrolls: tells us which numbered step they are on, whether the
// deadline bar has locked to the top, and publishes the pinned heights as CSS variables so the step list,
// scroll targets and the bar itself all stack without overlapping.
const MINI_H = 54; // height of the one-line bar before it has rendered

export function useStickyStory(count, resetKey) {
  const pageRef = useRef(null);
  const barRef = useRef(null);
  const tocRef = useRef(null);
  const sentinelRef = useRef(null);
  const miniRef = useRef(null);
  const [active, setActive] = useState(0);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;
    const hdr = document.querySelector('.pub header');
    let offset = 0;
    let hdrH = 0;
    const measure = () => {
      hdrH = hdr && getComputedStyle(hdr).position === 'sticky' ? hdr.offsetHeight : 0;
      const bar = miniRef.current ? miniRef.current.offsetHeight : MINI_H;
      const mobile = window.matchMedia('(max-width: 820px)').matches;
      const toc = mobile && tocRef.current ? tocRef.current.offsetHeight : 0;
      page.style.setProperty('--pub-hdr', `${hdrH}px`);
      page.style.setProperty('--pub-bar', `${bar}px`);
      page.style.setProperty('--pub-toc', `${toc}px`);
      offset = hdrH + bar + toc;
      document.documentElement.style.setProperty('--pub-stack', `${offset + 16}px`);
    };
    const spy = () => {
      const line = offset + window.innerHeight * 0.3;
      let idx = 0;
      for (let i = 0; i < count; i += 1) {
        const el = document.getElementById(`q${i + 1}`);
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) idx = count - 1;
      setActive(idx);
      // The full bar has scrolled out from under the header: time for the one-line version.
      if (barRef.current) setStuck(barRef.current.getBoundingClientRect().bottom <= hdrH + 1);
    };
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(spy); };
    const onResize = () => { measure(); spy(); };
    measure(); spy();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    [miniRef.current, tocRef.current, hdr].filter(Boolean).forEach((el) => ro.observe(el));
    return () => { document.documentElement.style.removeProperty('--pub-stack'); cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); ro.disconnect(); };
  }, [count, resetKey, stuck]);

  return { pageRef, barRef, miniRef, tocRef, sentinelRef, active, stuck };
}
