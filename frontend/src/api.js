// Single place the UI talks to the backend. Swap the backend adapter, not this file.
// Dev only: open the page with ?mock=1 to use built-in fixtures (stripped from production builds).
export const mockEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).has('mock');

// Backend base URL. Empty = same origin (dev proxy). Set VITE_API_BASE_URL at build time when the API lives elsewhere.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/** kind: 'invalid' (the backend rejected the details) or 'unavailable' (network or server problem). */
export class LookupError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

/**
 * `registration` is optional. It travels in the request body for this one call only: it is never put in a URL,
 * storage or a log line, and the caller clears it after sending.
 */
export async function lookupPenalty({ infringementNumber, offenceDate, registration }) {
  if (mockEnabled) return (await import('./mock.js')).mockLookup({ infringementNumber, offenceDate, registration });
  const body = { infringementNumber, offenceDate };
  if (registration) body.registration = registration;
  let res;
  try {
    res = await fetch(`${API_BASE}/api/penalty-lookups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new LookupError('unavailable', 'network');
  }
  if (res.status === 400) throw new LookupError('invalid', 'Please check the notice number and the offence date.');
  if (!res.ok) throw new LookupError('unavailable', `status ${res.status}`);
  try { return await res.json(); } catch { throw new LookupError('unavailable', 'unreadable'); }
}
