// Simulated failures so the prototype behaves like a real system.
// Clean mode: nothing fails. Realistic mode: weighted randomness, biased towards zero or one failure.
// Forced faults (demo hub) always apply, in either mode.

export const FAULT_KINDS = {
  slow: 'Loads slowly',
  error: 'Fails, retry works',
  missing: 'File not available',
};

export const FORCEABLE = [
  ['slowMedia', 'Slow images and video'],
  ['mediaError', 'One image fails to load'],
  ['missingVideo', 'Video file missing'],
  ['certError', 'Certificate service down'],
  ['metaSlow', 'Metadata slow (staff)'],
  ['downloadError', 'First download fails'],
];

// How many things go wrong in realistic mode. Mostly none or one; everything failing is rare.
const WEIGHTS = [[0, 0.5], [1, 0.32], [2, 0.13], [99, 0.05]];

function rng(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns { [target]: 'slow' | 'error' | 'missing' } for one notice view.
export function planFaults(notice, settings) {
  const plan = {};
  const media = notice.media || [];
  const f = settings.force || {};
  if (f.slowMedia) media.forEach((m) => (plan[m.id] = 'slow'));
  if (f.mediaError) { const m = media.find((x) => x.type === 'image'); if (m) plan[m.id] = 'error'; }
  if (f.missingVideo) media.filter((m) => m.type === 'video').forEach((m) => (plan[m.id] = 'missing'));
  if (f.certError) plan.certs = 'error';
  if (f.metaSlow) plan.meta = 'slow';
  if (f.downloadError) plan.download = 'error';
  if (settings.mode !== 'realistic') return plan;

  const r = rng(`${settings.seed}:${settings.nonce}:${notice.number}`);
  const roll = r();
  let acc = 0;
  let count = 0;
  for (const [n, w] of WEIGHTS) { acc += w; if (roll < acc) { count = n; break; } }
  const targets = [...media.map((m) => m.id), 'certs', 'meta', 'download'];
  for (let i = targets.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [targets[i], targets[j]] = [targets[j], targets[i]]; }
  targets.slice(0, Math.min(count, targets.length)).forEach((t) => {
    if (plan[t]) return;
    const m = media.find((x) => x.id === t);
    const kinds = m?.type === 'video' ? ['slow', 'error', 'missing'] : t === 'download' ? ['error'] : ['slow', 'error'];
    plan[t] = kinds[Math.floor(r() * kinds.length)];
  });
  return plan;
}
