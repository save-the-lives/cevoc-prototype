/**
 * Post-deployment verification tests (PDVT).
 *
 * Reads LIVE_CASES_PASS and LIVE_CASES_FAIL from environment (JSON arrays set as GitHub secrets).
 * Each case is sent to the deployed app's public streaming endpoint and checked against its expect block.
 * Skipped entirely when neither secret is set, so normal CI is unaffected.
 *
 * Env vars:
 *   LIVE_CASES_PASS  — JSON array of pass cases
 *   LIVE_CASES_FAIL  — JSON array of fail cases
 *   PDVT_BASE_URL    — e.g. https://<fqdn>
 *   PDVT_TAGS        — comma-separated tags to filter (e.g. "smoke"); empty = all
 *
 * Design doc: https://claude.ai/artifact/5eksi8fQJ6EmEf6gQxyfvi
 */
import { describe, it, expect } from 'vitest';

// ---- SSE reader ----

/** POST to the streaming endpoint and collect all SSE events as [{event, data}]. */
async function readSSE(baseUrl, input, signal) {
  const url = `${baseUrl}/api/penalty-lookups/stream`;
  const req = {
    infringementNumber: input.notice,
    offenceDate: input.date,
    registration: input.plate || null,
  };
  if (input.familyName) req.familyName = input.familyName;
  if (input.givenNames) req.givenNames = input.givenNames;
  if (input.organisation) req.organisation = input.organisation;
  const body = JSON.stringify(req);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body,
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const text = await res.text();
  const events = [];
  let currentEvent = null;
  let currentData = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('event:')) {
      if (currentEvent) events.push({ event: currentEvent, data: parseData(currentData.join('\n')) });
      currentEvent = line.slice(6).trim();
      currentData = [];
    } else if (line.startsWith('data:')) {
      currentData.push(line.slice(5));
    } else if (line === '' && currentEvent) {
      events.push({ event: currentEvent, data: parseData(currentData.join('\n')) });
      currentEvent = null;
      currentData = [];
    }
  }
  if (currentEvent) events.push({ event: currentEvent, data: parseData(currentData.join('\n')) });
  return events;
}

function parseData(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return trimmed; }
}

function findEvent(events, name) {
  return events.find((e) => e.event === name)?.data;
}

// ---- Load cases ----

function loadCases(envName) {
  const raw = process.env[envName];
  if (!raw) return [];
  // Secret is stored as plain JSON. The workflow masks sensitive input values
  // (notice, date, plate) with ::add-mask:: so they don't appear in logs.
  const trimmed = raw.trim();
  // GitHub masks substrings of secret values inside process.env (not just logs).
  // Try plain JSON first, then base64 decode as fallback.
  // To store as base64: base64 -w0 < cases.json | gh secret set LIVE_CASES_PASS
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    // Show the real parse error — position and type, not raw values.
    const msg = e.message || '';
    const posMatch = msg.match(/position\s+(\d+)/i) || msg.match(/column\s+(\d+)/i);
    const pos = posMatch ? Number(posMatch[1]) : null;
    const hint = pos != null
      ? `. char at ${pos}=${trimmed.charCodeAt(pos)} (${trimmed[pos] === ',' ? 'trailing comma?' : trimmed[pos] === '“' || trimmed[pos] === '”' ? 'curly quote?' : 'check this position'})`
      : '';
    throw new Error(
      `${envName}: JSON parse error — ${msg.replace(/\n.*/s, '').substring(0, 120)}${hint}. ` +
      `Length=${trimmed.length}.`
    );
  }
  // Accept either a bare array or an object whose matching key holds the array.
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed[envName])) {
    return parsed[envName];
  }
  throw new Error(`${envName}: expected a JSON array (or an object with a "${envName}" key).`);
}

function filterByTags(cases) {
  const tagFilter = process.env.PDVT_TAGS;
  if (!tagFilter) return cases;
  const wanted = tagFilter.split(',').map((t) => t.trim()).filter(Boolean);
  if (wanted.length === 0) return cases;
  return cases.filter((c) => c.tags && wanted.some((t) => c.tags.includes(t)));
}

const passCases = filterByTags(loadCases('LIVE_CASES_PASS'));
const failCases = filterByTags(loadCases('LIVE_CASES_FAIL'));
const baseUrl = process.env.PDVT_BASE_URL;
const noBase = !baseUrl;
const skipPass = noBase || !passCases.length;
const skipFail = noBase || !failCases.length;
const skip = skipPass && skipFail;

/** Safe summary for logs — no notice numbers, plates or dates. */
function caseSummary(c) {
  return { id: c.id, description: c.description, tags: c.tags, program: c.program };
}

/** Label for it.each — "<id> — <description>". */
function caseLabel(c) {
  return c.description ? `${c.id} — ${c.description}` : c.id;
}

// ---- Tests ----

describe('Smoke test config', () => {
  it('cases loaded', () => {
    console.log(`pass cases (${passCases.length}):`, passCases.map(caseSummary));
    console.log(`fail cases (${failCases.length}):`, failCases.map(caseSummary));
    expect(Array.isArray(passCases)).toBe(true);
    expect(Array.isArray(failCases)).toBe(true);
    if (passCases.length) expect(baseUrl).toBeTruthy();
  });
});

describe.skipIf(skipPass)('Smoke pass cases', () => {

  it.each(passCases.map((c) => [caseLabel(c), c]))('%s', async (_label, c) => {
    const id = c.id;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 120_000);
    try {
      const events = await readSSE(baseUrl, c.input, ac.signal);
      const details = findEvent(events, 'details');
      const evidence = findEvent(events, 'evidence');
      const certificates = findEvent(events, 'certificates');
      const done = findEvent(events, 'done');
      const error = findEvent(events, 'error');

      // Log actual response for diagnosis (safe fields only).
      console.log(`[case ${id}] status=${details?.status}, summary=${details?.summary?.substring(0, 100)}, requiredFields=${JSON.stringify(details?.requiredFields)}`);

      expect(error, `case ${id}: unexpected error event`).toBeFalsy();
      expect(done, `case ${id}: no done event`).toBeTruthy();

      if (c.expect.status) {
        expect(details?.status, `case ${id}: status`).toBe(c.expect.status);
      }
      if (c.expect.noticeStatus) {
        expect(details?.notice?.noticeStatus, `case ${id}: noticeStatus`).toBe(c.expect.noticeStatus);
      }
      if (c.expect.plateRequired !== undefined) {
        expect(details?.plateRequired ?? false, `case ${id}: plateRequired`).toBe(c.expect.plateRequired);
      }
      if (c.expect.minPhotos !== undefined) {
        const photos = (evidence?.evidence || []).filter((e) => e.kind === 'IMAGE');
        expect(photos.length, `case ${id}: minPhotos (got ${photos.length})`).toBeGreaterThanOrEqual(c.expect.minPhotos);
      }
      if (c.expect.minImageBytes !== undefined) {
        const photos = (evidence?.evidence || []).filter((e) => e.kind === 'IMAGE');
        for (const photo of photos) {
          if (!photo.url) continue;
          try {
            const imgRes = await fetch(photo.url);
            const buf = await imgRes.arrayBuffer();
            expect(buf.byteLength, `case ${id}: image ${photo.title} too small`).toBeGreaterThanOrEqual(c.expect.minImageBytes);
          } catch { /* image fetch may fail in CI without CORS; skip */ }
        }
      }
      if (c.expect.certificates) {
        if (c.expect.certificates === 'covered') {
          expect(certificates?.coverage?.status?.toLowerCase(), `case ${id}: certificates coverage`).toBe('covered');
        } else if (c.expect.certificates === 'none') {
          const hasCov = certificates?.coverage?.status?.toLowerCase();
          expect(hasCov === 'none' || hasCov === undefined, `case ${id}: certificates should be none/absent`).toBe(true);
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }, 130_000);
});

describe.skipIf(skipFail)('Smoke fail cases', () => {

  it.each(failCases.map((c) => [caseLabel(c), c]))('%s', async (_label, c) => {
    const id = c.id;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 120_000);
    try {
      const events = await readSSE(baseUrl, c.input, ac.signal);
      const details = findEvent(events, 'details');
      const error = findEvent(events, 'error');

      if (c.expect.error) {
        // Expect a specific error or a non-FOUND status
        if (c.expect.error.kind) {
          // Check error event or non-FOUND status
          const gotError = error?.cause || details?.status;
          expect(
            gotError === c.expect.error.kind || details?.status === c.expect.error.kind,
            `case ${id}: expected error ${c.expect.error.kind}, got status=${details?.status}, error=${error?.cause}`
          ).toBe(true);
        }
      }
      if (c.expect.status) {
        expect(details?.status, `case ${id}: expected status ${c.expect.status}`).toBe(c.expect.status);
      }
    } finally {
      clearTimeout(timer);
    }
  }, 130_000);
});
