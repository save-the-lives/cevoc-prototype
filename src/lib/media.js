// Sorts a notice's images and video by how much weight they carry as evidence.
//   prime  = prima facie: the image(s) that show the offence itself
//   id     = identification: the number plate close-up
//   extra  = additional images
//   video  = video
export const KIND = {
  prime: { label: 'Prime facie', note: 'Shows the offence' },
  id: { label: 'Identification', note: 'Number plate' },
  extra: { label: 'Additional', note: 'Supporting images' },
  video: { label: 'Video', note: 'Supporting footage' },
};
const ORDER = ['prime', 'id', 'extra', 'video'];
// Red-light and average-speed offences are shown by a sequence of two frames, not one.
const PRIME_COUNT = { RED_LIGHT_SPEED: 2, AVERAGE_SPEED: 2 };

export function classifyMedia(items, program) {
  const need = PRIME_COUNT[program] || 1;
  let primes = 0;
  const tagged = items.map((m) => {
    if (m.type === 'video') return { ...m, kind: 'video' };
    if (/plate/i.test(m.caption)) return { ...m, kind: 'id' };
    if (primes < need) { primes += 1; return { ...m, kind: 'prime' }; }
    return { ...m, kind: 'extra' };
  });
  return ORDER.flatMap((k) => tagged.filter((m) => m.kind === k));
}
