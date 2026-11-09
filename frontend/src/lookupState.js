// The progressive state of one lookup: each section has its own loading state and fills in as its event arrives.
// Pure functions, so the order of events and the failure cases are unit tested without a browser.

export const SECTION = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

export function initialLookup() {
  return {
    details: null, // { status, infringementNumber, summary, notice, source } once known
    evidence: { state: SECTION.LOADING, items: [], plateRequired: false },
    certificates: { state: SECTION.LOADING, items: [], coverage: null }, // coverage: { status, side, gapDays, message } from the server
    finished: false,
    error: null, // whitelisted cause token
  };
}

/** Same lookup again (for example with a vehicle registration number): keep the notice, show the other sections as loading again. */
export function restartSections(state) {
  const fresh = initialLookup();
  return { ...fresh, details: state.details };
}

/** Applies one event {name, data}. Unknown events are ignored. */
export function applyEvent(state, name, data) {
  switch (name) {
    case 'details':
      return { ...state, details: { ...data } };
    case 'evidence':
      return { ...state, evidence: { state: SECTION.READY, items: data.evidence || [], plateRequired: !!data.plateRequired } };
    case 'extra':
      return data && data.details && typeof data.details === 'object' ? { ...state, extra: { ...data.details } } : state;
    case 'certificates':
      return { ...state, certificates: { state: SECTION.READY, items: data.certificates || [], coverage: data.coverage || null, uncoveredTypes: data.uncoveredTypes || [] } };
    case 'done':
      return settle({ ...state, finished: true });
    case 'error':
      return settle({ ...state, finished: true, error: typeof data?.cause === 'string' ? data.cause : 'source-failed' });
    default:
      return state;
  }
}

/** When the stream is over, sections that never arrived are marked as failed rather than loading forever. */
function settle(state) {
  const fail = (s) => (s.state === SECTION.LOADING ? { ...s, state: SECTION.ERROR } : s);
  return { ...state, evidence: fail(state.evidence), certificates: fail(state.certificates) };
}

/** Events a single JSON answer is equivalent to (used when the stream endpoint is not there). */
export function eventsFromResult(result) {
  const events = [['details', {
    status: result.status, infringementNumber: result.infringementNumber, summary: result.summary, notice: result.notice, source: result.source,
  }]];
  if (result.status === 'FOUND') {
    events.push(['evidence', { evidence: result.evidence || [], plateRequired: !!result.plateRequired }]);
    if (result.details && Object.keys(result.details).length) events.push(['extra', { details: result.details }]);
    events.push(['certificates', { certificates: result.certificates || [], coverage: result.certificateCoverage || null, uncoveredTypes: result.uncoveredTypes || [] }]);
  } else {
    events.push(['evidence', { evidence: [], plateRequired: false }], ['certificates', { certificates: [] }]);
  }
  events.push(['done', { ok: true }]);
  return events;
}

/** The single result object the page components read. */
export function toResult(state) {
  const d = state.details;
  if (!d) return null;
  return {
    ...d,
    evidence: state.evidence.items,
    certificates: state.certificates.items,
    certificateCoverage: state.certificates.coverage,
    uncoveredTypes: state.certificates.uncoveredTypes || [],
    plateRequired: state.evidence.plateRequired,
    ...(state.extra ? { details: state.extra } : {}), // flexible details map (record 0009); keys the page does not know are ignored
  };
}
