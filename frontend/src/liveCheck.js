// Pure logic for the hidden owner-only live check page. No storage, no logging.
export const LIVE_CHECK_PATH = '/live-check';

export function isLiveCheckRoute(loc) {
  const path = (loc.pathname || '').replace(/\/+$/, '');
  return path === LIVE_CHECK_PATH || loc.hash === `#${LIVE_CHECK_PATH}` || loc.hash === `#${LIVE_CHECK_PATH}/`;
}

export const emptyFields = () => ({ token: '', notice: '', date: '', registration: '' });

// DD/MM/YYYY -> YYYY-MM-DD, or null if not a real calendar date.
export function parseOffenceDate(input) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((input || '').trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Returns { ok:true, request:{token, body} } or { ok:false, error } (error text never contains the values).
export function buildRequest(fields) {
  const token = (fields.token || '').trim();
  const notice = (fields.notice || '').trim();
  const registration = (fields.registration || '').trim();
  if (!token) return { ok: false, error: 'Enter the access token.' };
  if (!/^[A-Za-z0-9]{4,20}$/.test(notice)) return { ok: false, error: 'Penalty notice number should be 4 to 20 letters or digits.' };
  const offenceDate = parseOffenceDate(fields.date);
  if (!offenceDate) return { ok: false, error: 'Offence date must be a real date as DD/MM/YYYY.' };
  if (registration && !/^[A-Za-z0-9 -]{1,10}$/.test(registration)) return { ok: false, error: 'Registration should be up to 10 letters, digits, spaces or dashes.' };
  return { ok: true, request: { token, body: { notice, offenceDate, registration: registration || null } } };
}

// Backend answers text/plain lines like "images             : 2" and indented "  location: yes".
// Returns rows [{label, value, nested}] in order; unknown lines are kept as plain rows.
export function formatSummary(text) {
  const rows = [];
  for (const raw of String(text || '').split('\n')) {
    if (!raw.trim()) continue;
    const nested = /^\s{2,}/.test(raw);
    const i = raw.indexOf(':');
    if (i < 0) { rows.push({ label: raw.trim(), value: '', nested }); continue; }
    const label = raw.slice(0, i).trim();
    const value = raw.slice(i + 1).trim();
    rows.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value, nested });
  }
  return rows;
}

export function errorForStatus(status) {
  if (status === 401 || status === 403) return 'The access token was not accepted.';
  if (status === 400) return 'The server did not accept those details. Check the notice number, date and registration.';
  if (status === 404) return 'The live check is not switched on at that server.';
  if (status === 429) return 'Too many tries. Wait a bit and try again.';
  return 'The check failed on the server. See the backend console.';
}

// Never reads response text for errors beyond status, so nothing user-supplied can be echoed.
export async function runLiveCheck(fields, { fetchImpl = fetch, base = '' } = {}) {
  const built = buildRequest(fields);
  if (!built.ok) return { ok: false, error: built.error };
  try {
    const res = await fetchImpl(`${base}/live-check/lookup`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'X-Live-Check-Token': built.request.token },
      body: JSON.stringify(built.request.body),
    });
    if (!res.ok) return { ok: false, error: errorForStatus(res.status) };
    return { ok: true, rows: formatSummary(await res.text()) };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}
