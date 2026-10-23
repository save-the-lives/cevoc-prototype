// Small helpers for dates and query strings used by v0.4 screens.
import { TODAY } from './format.js';

export const query = (path) => Object.fromEntries(new URLSearchParams((path || '').split('?')[1] || ''));

const day = (iso) => new Date(iso.slice(0, 10) + 'T00:00:00');
export const daysBetween = (a, b) => Math.round((day(b) - day(a)) / 86400000);
export const daysFromToday = (iso) => daysBetween(TODAY, iso);

export const weekday = (iso) => new Date(iso).toLocaleDateString('en-AU', { weekday: 'long' });

export function partOfDay(iso) {
  const h = new Date(iso).getHours();
  if (h < 5) return 'overnight';
  if (h < 9) return 'early morning';
  if (h < 12) return 'morning';
  if (h < 14) return 'around lunchtime';
  if (h < 17) return 'afternoon';
  if (h < 20) return 'evening';
  return 'at night';
}

export function agoText(days) {
  if (days < 1) return 'today';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  const w = Math.round(days / 7);
  if (w < 9) return `about ${w} weeks ago`;
  return `about ${Math.round(days / 30)} months ago`;
}
