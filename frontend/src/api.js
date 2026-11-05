// Single place the UI talks to the backend. Swap the backend adapter, not this file.
// Dev only: open the page with ?mock=1 to use built-in fixtures (stripped from production builds).
export const mockEnabled = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mock');

import { createSseParser } from './sse.js';
import { eventsFromResult } from './lookupState.js';

// Backend base URL. Empty = same origin (dev proxy). Set VITE_API_BASE_URL at build time when the API lives elsewhere.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/** kind: 'invalid' (the backend rejected the details) or 'unavailable' (network or server problem). */
export class LookupError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

/** Links the backend gives for stored images are relative (/api/media/...): they belong to the API origin, not the page's. */
export function resolveMediaUrl(url) {
  return typeof url === 'string' && url.startsWith('/api/') ? `${API_BASE}${url}` : url;
}

export function resolveEvidence(items) {
  return (items || []).map((e) => ({
    ...e,
    url: resolveMediaUrl(e.url),
    ...(e.previewUrl ? { previewUrl: resolveMediaUrl(e.previewUrl) } : {}),
    ...(e.mediumUrl ? { mediumUrl: resolveMediaUrl(e.mediumUrl) } : {}),
    ...(e.downloadUrl ? { downloadUrl: resolveMediaUrl(e.downloadUrl) } : {}),
  }));
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

/**
 * One request, answered in parts (Server-Sent Events read from a POST response): onEvent(name, data) for details, evidence,
 * certificates, then done (or error with a fixed cause token). The registration travels in the body of this one request only.
 * If the stream endpoint is not available (an older backend, a proxy that does not stream) it falls back to the single JSON
 * answer, delivered as the same events. Resolves when the stream is over; rejects with LookupError, or AbortError when aborted.
 */
export async function streamLookup({ infringementNumber, offenceDate, registration }, onEvent, signal) {
  if (mockEnabled) return (await import('./mock.js')).mockStream({ infringementNumber, offenceDate, registration }, onEvent, signal);
  const body = { infringementNumber, offenceDate };
  if (registration) body.registration = registration;
  let res;
  try {
    res = await fetch(`${API_BASE}/api/penalty-lookups/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new LookupError('unavailable', 'network');
  }
  if (res.status === 400) throw new LookupError('invalid', 'Please check the notice number and the offence date.');
  const isStream = res.ok && res.body && /text\/event-stream/i.test(res.headers.get('Content-Type') || '');
  if (!isStream) {
    if (res.status >= 500 && res.status !== 501) throw new LookupError('unavailable', `status ${res.status}`);
    const result = await lookupPenalty({ infringementNumber, offenceDate, registration });
    for (const [name, data] of eventsFromResult({ ...result, evidence: resolveEvidence(result.evidence) })) onEvent(name, data);
    return;
  }
  let settled = false;
  const parser = createSseParser((name, text) => {
    let data;
    try { data = JSON.parse(text); } catch { return; }
    if (name === 'evidence') data = { ...data, evidence: resolveEvidence(data.evidence) };
    if (name === 'done' || name === 'error') settled = true;
    onEvent(name, data);
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.end();
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    if (!settled) onEvent('error', { cause: 'stream-interrupted' });
    return;
  }
  if (!settled) onEvent('error', { cause: 'stream-interrupted' });
}

/**
 * The demo hub's list of cases (docs/DEMO-DATA.md). The backend serves it only while demo data is switched on; any other
 * answer (404, network, not JSON) means "not available" and gives null, so the page behaves like any unknown page.
 */
export async function fetchDemoCases() {
  try {
    const res = await fetch(`${API_BASE}/api/demo/cases`, { headers: { Accept: 'application/json' } });
    if (!res.ok || !/json/i.test(res.headers.get('Content-Type') || '')) return null;
    const body = await res.json();
    return body && Array.isArray(body.programs) ? body : null;
  } catch {
    return null;
  }
}
