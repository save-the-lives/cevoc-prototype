export const TODAY = new Date().toISOString().slice(0, 10);

export const fmtDate = (iso) =>
  iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });

export const weekday = (iso) => new Date(iso).toLocaleDateString('en-AU', { weekday: 'long' });

export function partOfDay(iso) {
  const h = new Date(iso).getHours();
  return h < 5 ? 'overnight' : h < 9 ? 'early morning' : h < 12 ? 'morning' : h < 14 ? 'around lunchtime' : h < 17 ? 'afternoon' : h < 20 ? 'evening' : 'at night';
}

export function ago(days) {
  if (days < 1) return 'today';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (days < 63) return `about ${Math.round(days / 7)} weeks ago`;
  return `about ${Math.round(days / 30)} months ago`;
}
