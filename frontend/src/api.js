// Single place the UI talks to the backend. Swap the backend adapter, not this file.
// Dev only: open the page with ?mock=1 to use built-in fixtures (stripped from production builds).
export const mockEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).has('mock');

// Backend base URL. Empty = same origin (dev proxy). Set VITE_API_BASE_URL at build time when the API lives elsewhere.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function lookupPenalty({ infringementNumber, offenceDate }) {
  if (mockEnabled) return (await import('./mock.js')).mockLookup({ infringementNumber, offenceDate });
  const res = await fetch(`${API_BASE}/api/penalty-lookups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ infringementNumber, offenceDate }),
  });
  if (res.status === 400) throw new Error('Please check the notice number and the offence date.');
  if (!res.ok) throw new Error('Something went wrong. Please try again.');
  return res.json();
}
