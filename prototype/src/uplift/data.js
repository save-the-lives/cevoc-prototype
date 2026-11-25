// CERTIFICATE UPLIFT HUB: one place for the phase 1 uplift of the legacy certificate search
// (Customer Enquiry and Verification of Certificate). Modelled on the enf-site-onboarding prototype hub:
// screens, plus a companion layer of journey, stories, open questions and field delta, each linked to the others.
//
// Everything here is fictitious: locations, addresses and certificates are invented. Wording taken from the
// legacy page comes from the owner's screenshots (not stored in this public repo).

export const SHOTS = 'Owner screenshots of the legacy page (25 Nov 2026)';
export const OWNER = 'Owner decision (25 Nov 2026)';
export const BRD = 'CEVOC Enhancement BRD v1.1';

// ---------------------------------------------------------------------------------------------------------------
// Dates (day granularity, owner 25 Nov 2026). dd/mm/yyyy in, Date out.
const pad = (n) => String(n).padStart(2, '0');
export const fmtDay = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const parseDay = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(y, mo - 1, d);
  return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d ? t : null;
};
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const sameDay = (a, b) => a && b && a.getTime() === b.getTime();

// ---------------------------------------------------------------------------------------------------------------
// Invented camera locations. Search accepts the code or any part of the address.
export const PROGRAMS = {
  RLSC: 'Red light speed camera',
  FDSC: 'Fixed speed camera',
  ASC: 'Average speed (point to point)',
  MPDC: 'Mobile phone detection camera',
};
export const LOCATIONS = [
  { code: '1234', address: 'Example St & Sample Ave, Testville', program: 'RLSC' },
  { code: '2345', address: 'Demo Rd (eastbound), Mockton', program: 'FDSC' },
  { code: '3456', address: 'Placeholder Hwy (northbound), Fakeham', program: 'ASC' },
  { code: '4567', address: 'Specimen Pde & Trial St, Testville', program: 'RLSC', note: 'Has a withdrawn and a re-issued certificate, and a missing quarterly certificate' },
  { code: '9999', address: 'Fault Test Lane, Errorton', program: 'RLSC', note: 'Simulates a system fault' },
  { code: '5678', address: 'Sample Hwy (southbound), Mockton', program: 'MPDC', note: 'The invented fine used in both entry flows' },
  ...['Example Pde', 'Demo St', 'Sample Rd', 'Mock Ave', 'Trial Cres', 'Placeholder Way', 'Specimen Lane', 'Test Blvd', 'Dummy Dr', 'Proto Pl', 'Fixture Ct', 'Stub Tce']
    .map((st, i) => ({ code: String(6001 + i), address: `${st} & ${['Wattle', 'Banksia', 'Waratah'][i % 3]} Ave, ${['Testville', 'Mockton', 'Fakeham'][i % 3]}`, program: ['RLSC', 'FDSC', 'ASC', 'MPDC'][i % 4] })),
];
export const locByCode = (code) => LOCATIONS.find((l) => l.code === String(code || '').trim());
export const locLabel = (l) => `${l.code} · ${l.address}`;
export const FAULT_CODES = new Set(['9999']);

// Certificates. status: Draft | Approved | Published | Withdrawn. Only Approved and Published appear (owner, U2).
// Withdrawn ones are shown marked, pending U22. reissueOf: the certificate this one replaces (BRD BR_09).
const DESC = 'Approved Traffic Enforcement Device';
const TYPE = { RLSC: 'Red Light Speed Camera', FDSC: 'Fixed Speed Camera', ASC: 'Average Speed Camera', MPDC: 'Mobile Phone Detection Camera' };
let seq = 0;
const c = (loc, period, certified, expiry, status = 'Published', extra = {}) => ({
  id: `c${++seq}`, loc, desc: DESC, type: TYPE[locByCode(loc).program], period, certified, expiry, status, ...extra,
});
export const CERTIFICATES = [
  c('1234', 'YEARLY', '12/08/2025', '12/08/2026'),
  c('1234', 'YEARLY', '12/08/2025', '12/08/2026', 'Published', { note: 'Invented duplicate of the row above (U4 example)' }),
  c('1234', 'QUARTERLY', '02/10/2025', '31/12/2025'),
  c('1234', 'QUARTERLY', '22/12/2025', '21/03/2026'),
  c('1234', 'QUARTERLY', '18/03/2026', '16/06/2026'),
  c('1234', 'QUARTERLY', '12/06/2026', '10/09/2026'),
  c('1234', 'YEARLY', '10/08/2026', '10/08/2027'),
  c('1234', 'QUARTERLY', '07/09/2026', '06/12/2026'),
  c('2345', 'YEARLY', '01/07/2025', '01/07/2026'),
  c('2345', 'QUARTERLY', '15/09/2025', '14/12/2025'),
  c('2345', 'QUARTERLY', '10/12/2025', '10/03/2026'),
  c('2345', 'QUARTERLY', '05/03/2026', '03/06/2026'),
  c('2345', 'YEARLY', '28/06/2026', '28/06/2027'),
  c('2345', 'QUARTERLY', '01/06/2026', '30/08/2026'),
  c('2345', 'QUARTERLY', '25/08/2026', '23/11/2026'),
  c('3456', 'YEARLY', '20/10/2025', '20/10/2026'),
  c('3456', 'QUARTERLY', '20/10/2025', '18/01/2026'),
  c('3456', 'QUARTERLY', '15/01/2026', '15/04/2026'),
  c('3456', 'QUARTERLY', '10/04/2026', '09/07/2026'),
  c('3456', 'QUARTERLY', '06/07/2026', '04/10/2026'),
  c('4567', 'YEARLY', '01/09/2025', '01/09/2026', 'Approved'),
  c('4567', 'QUARTERLY', '01/09/2025', '30/11/2025'),
  c('4567', 'QUARTERLY', '01/12/2025', '28/02/2026', 'Withdrawn', { withdrawn: '12/12/2025' }),
  c('4567', 'QUARTERLY', '15/12/2025', '28/02/2026', 'Published', { reissueOf: 'c23' }),
  c('4567', 'QUARTERLY', '15/03/2026', '12/06/2026'),
  c('4567', 'QUARTERLY', '13/06/2026', '10/09/2026', 'Draft'),
  c('5678', 'QUARTERLY', '02/03/2026', '31/05/2026'),
  c('5678', 'QUARTERLY', '25/11/2025', '23/02/2026'),
  // Generated, invented: a yearly certificate and rolling quarterlies for 6001 to 6012 (many-locations example, U25).
  ...Array.from({ length: 12 }, (_, i) => String(6001 + i)).flatMap((code, i) => {
    const d = 1 + (i * 2) % 27;
    const p = (n) => String(n).padStart(2, '0');
    return [
      c(code, 'YEARLY', `${p(d)}/07/2025`, `${p(d)}/07/2026`),
      c(code, 'QUARTERLY', `${p(d)}/11/2025`, `${p(d)}/02/2026`),
      c(code, 'QUARTERLY', `${p(d)}/02/2026`, `${p(d)}/05/2026`),
    ];
  }),
];

// The signed link both apps open today: certificateDetails.jsf?p=&d=&s=&i=&m= (owner, 25 Nov 2026).
// p notice number, d offence date-time yyyyMMddTHHmmss, s site or camera, i unknown (U29), m signature (U30).
// One invented fine is used for both entry flows so they can be compared. All values are fictitious.
export const OFFENCES = [
  { p: '4000000001', d: '20260314T083000', s: '5678', i: '1', r: 'SNSW', program: 'Mobile Phone Detection Camera', offence: 'Driver use mobile phone when not permitted - camera detected - Individual', amount: '$000.00' },
  { p: '4000000002', d: '20260308T171500', s: '4567', i: '1', r: 'RNSW', program: 'Red Light Speed Camera', offence: 'Proceed through red traffic light - camera detected - Individual', amount: '$000.00' },
];
export const DEMO_SIGNATURE = '0000demo0signature0not0real0000';
export const signedLink = (o, r = o.r) => `/uplift/record?p=${o.p}&d=${o.d}&s=${o.s}&i=${o.i}${r ? `&r=${r}` : ''}&m=${DEMO_SIGNATURE}`;
export const offenceFromLink = (q) => {
  const o = OFFENCES.find((x) => x.p === q.p && x.d === q.d && x.s === q.s && x.i === q.i);
  // The source r is covered by the signature (U9): in this mock, a link may omit r, but an r that doesn't match
  // the fine's own source counts as tampering.
  return o && q.m === DEMO_SIGNATURE && (!q.r || q.r === o.r) ? o : null;
};
export const ENTRY_LINK = signedLink(OFFENCES[0]);

// APP SETTINGS (configurable), owner 25 Nov 2026. Everything tunable is an app setting: the backend holds them
// (e.g. Azure App Configuration or a settings table) and serves a read-only /config; the React front end loads it
// at startup and caches it. Changing a setting needs no redeploy. Values here are the prototype's defaults.
export const SOURCES = { SNSW: { name: 'Service NSW', url: 'https://account.service.nsw.gov.au/overview' }, RNSW: { name: 'myPenalty (Revenue NSW)', url: 'https://www.revenue.nsw.gov.au' } };
export const APP_SETTINGS = [
  { key: 'search.datePresets', purpose: 'Date range presets on the staff search; each sets From, To is always today (Sydney time)', value: 'Last 7 days, Last 30 days, Last 3 months, Last 6 months, Last 12 months', owner: 'Product owner', q: 'U27' },
  { key: 'search.defaultPreset', purpose: 'Preset selected when the search opens', value: 'Last 6 months', owner: 'Product owner', q: 'U10' },
  { key: 'api.maxLocationsPerRequest', purpose: 'Cap on locations per API request, only if load ever needs it (enforced by the API, with paging)', value: 'None', owner: 'Enterprise architecture, CMCS data owner', q: 'U25' },
  { key: 'certificate.visibleStatuses', purpose: 'Lifecycle statuses that make a certificate visible', value: 'Approved, Published', owner: 'CMCS data owner', q: 'U2' },
  { key: 'certificate.bufferDays', purpose: 'Days to wait before showing a certificate (not used now)', value: '0', owner: 'Product owner', q: 'U2' },
  { key: 'certificate.rulesPerProgram', purpose: 'Which certificate types apply per camera program, and which wins when several are in force', value: 'All in force, one per cycle', owner: 'Transport, CMCS / CES data owners', q: 'U5' },
  { key: 'record.returnLinks', purpose: 'Return link per signed-link source', value: Object.entries(SOURCES).map(([k, v]) => `${k}: ${v.name}`).join('; '), owner: 'Product owner, Service NSW, Revenue NSW', q: 'U9' },
  { key: 'links.contactUs', purpose: 'Contact us destination', value: 'Legacy destination (to capture)', owner: 'Product owner', q: 'U11' },
  { key: 'links.help', purpose: 'Help destination', value: 'Legacy destination (to capture)', owner: 'Product owner', q: 'U11' },
  { key: 'programs.enabled', purpose: 'Which camera programs the page shows (on or off per program)', value: 'RLSC, FDSC, ASC, MPDC on', owner: 'Product owner', q: 'U16' },
  { key: 'programs.rules', purpose: 'Per program: certificate types that apply, cycles, which wins (held and applied by the backend, ADR-001)', value: 'All in force, one per cycle', owner: 'Transport, CMCS / CES data owners', q: 'U16' },
  { key: 'certificate.statusRules', purpose: 'For each lifecycle status: shown or not, and how (tag, date, data-error flag)', value: 'As the Lifecycle tab', owner: 'CMCS data owner, Transport', q: 'U22' },
  { key: 'copy.templates', purpose: 'Static copy of the record page, per camera program with a default', value: 'Legacy wording (default template)', owner: 'Transport communications, Legal', q: 'U35' },
  { key: 'copy.gipaUrl', purpose: 'Link in the legal disclaimer', value: 'Transport access application page', owner: 'Legal', q: 'U8' },
];
// Lifecycle label for display (U22): Withdrawn, Re-issued, Current (covers today) or Expired.
export const lifecycle = (x) => (x.status === 'Withdrawn' ? 'Withdrawn' : x.reissueOf ? 'Re-issued' : (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return parseDay(x.expiry) < t ? 'Expired' : parseDay(x.certified) > t ? 'Not yet in force' : 'Current'; })());
export const VISIBLE = (x) => x.status === 'Approved' || x.status === 'Published' || x.status === 'Withdrawn';
export const COUNTS = (x) => x.status === 'Approved' || x.status === 'Published'; // in force only if not withdrawn

// Certificates touching [from, to] for the given locations, plus the gaps: days in the range when no certificate
// of a cycle the location normally has (YEARLY, QUARTERLY) was in force. Which cycles are expected per program is
// an open question (U23); the prototype expects every cycle seen at the location.
export function searchCertificates(codes, from, to) {
  const rows = [];
  const gaps = [];
  codes.forEach((code) => {
    const mine = CERTIFICATES.filter((x) => x.loc === code && VISIBLE(x));
    const touching = mine.filter((x) => parseDay(x.certified) <= to && parseDay(x.expiry) >= from);
    // One record per grouping key (U4): site + cycle + certification date. Identical current rows collapse to one,
    // flagged as a data error; a withdrawn row and its re-issue are different states and both stay.
    const groups = new Map();
    touching.forEach((x) => {
      const k = `${x.loc}|${x.period}|${x.certified}|${x.status === 'Withdrawn' ? 'W' : 'C'}`;
      if (groups.has(k)) groups.get(k).duplicates += 1; else groups.set(k, { ...x, duplicates: 0 });
    });
    rows.push(...groups.values());
    const cycles = [...new Set(mine.map((x) => x.period))];
    cycles.forEach((cycle) => {
      const live = mine.filter((x) => x.period === cycle && COUNTS(x));
      let start = null;
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const covered = live.some((x) => parseDay(x.certified) <= d && parseDay(x.expiry) >= d);
        if (!covered && !start) start = d;
        if (covered && start) { gaps.push({ code, cycle, from: start, to: addDays(d, -1) }); start = null; }
      }
      if (start) gaps.push({ code, cycle, from: start, to });
    });
  });
  // A gap that only runs past the last certificate into the future is not a missing certificate yet.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return { rows, gaps: gaps.filter((g) => g.from <= today).map((g) => ({ ...g, to: g.to > today ? today : g.to })) };
}

// The record a person reaches from their notice: certificates in force at the offence day, per cycle.
export function certificatesAt(code, day) {
  const mine = CERTIFICATES.filter((x) => x.loc === code && VISIBLE(x));
  const cycles = [...new Set(mine.map((x) => x.period))];
  const inForce = mine.filter((x) => COUNTS(x) && parseDay(x.certified) <= day && parseDay(x.expiry) >= day);
  const withdrawn = mine.filter((x) => x.status === 'Withdrawn' && parseDay(x.certified) <= day && parseDay(x.expiry) >= day);
  const missing = cycles.filter((cy) => !inForce.some((x) => x.period === cy));
  return { inForce, withdrawn, missing };
}

// ---------------------------------------------------------------------------------------------------------------
// Labels: what the legacy page calls things, and the proposed new names (owner: phase 1 UI, 25 Nov 2026).
export const LABELS = {
  legacy: {
    h1: 'Search', intro: 'Please enter the search parameters', mandatory: 'indicates mandatory fields.',
    loc: 'Location code', from: 'Date/Time from', to: 'Date/Time to',
    search: 'SEARCH', clear: 'CLEAR', close: 'CLOSE', results: 'Search results',
    desc: 'Certificate Description', type: 'Certificate type', period: 'Period', certified: 'Certified date', expiry: 'Expiry date',
    location: 'Location code', none: 'No records found.', status: 'Status',
  },
  next: {
    h1: 'Find camera certificates', intro: 'Search by camera location and a date range.', mandatory: 'All fields are required.',
    loc: 'Camera locations', from: 'From', to: 'To',
    search: 'Search', clear: 'Clear', close: 'Close', results: 'Certificates',
    desc: 'Certificate', type: 'Camera type', period: 'Certification cycle', certified: 'Certified on', expiry: 'Expires on',
    location: 'Location', none: 'No certificates found', status: 'Status',
  },
};
export const LABEL_KEYS = ['h1', 'intro', 'mandatory', 'loc', 'from', 'to', 'search', 'clear', 'close', 'results', 'desc', 'type', 'period', 'certified', 'expiry', 'none'];

// ---------------------------------------------------------------------------------------------------------------
// Open questions. Same status vocabulary as the CEVOC validation register. `at` lists the screens where the
// question shows as a ? badge. IDs U1 to U15 keep the numbers already used in the hand-off log.
export const STATUS = ['Confirmed requirement', 'Confirmation required', 'Assumption to validate', 'Proposed UX improvement', 'Future scope', 'Out of scope', 'Merged', 'Resolved', 'Removed'];
export const OPEN = (q) => q.status === 'Assumption to validate' || q.status === 'Confirmation required';
const PROGRAM_Q = (id, program) => ({
  id, topic: `Certificate types: ${program}`, at: ['search', 'record', 'fields'],
  q: `Which certificates must be in force for a ${program.toLowerCase()} to enforce, and on what cycle?`,
  why: 'Without the list we cannot tell a genuinely missing certificate from one that is simply not required.',
  assume: 'Every cycle seen at the location (yearly, quarterly) must be in force every day.',
  who: 'CMCS data owner, camera program manager', status: 'Assumption to validate', source: OWNER,
  action: 'List the certificate types and cycles per program from CMCS.', impact: 'Gap detection (S8, S12).',
});
export const QUESTIONS = [
  { id: 'U1', topic: 'No PDF or downloads', at: ['search', 'record'], q: 'Does the uplift add a certificate download?', why: 'The legacy page offers none; phase 1 adds no new functions.', assume: 'No download, save or print anywhere.', who: 'Product owner', status: 'Confirmed requirement', source: OWNER + '; ' + BRD + ' BR_03', action: 'None.', impact: 'No download controls.' },
  { id: 'U2', topic: 'When a certificate appears', at: ['search', 'record'], q: 'Which lifecycle status values make a certificate visible?', why: 'Replaces the BRD’s conflicting day delays (BR_04 five to six business days, BR_07 immediate).', assume: 'Visibility follows the certificate’s lifecycle status (e.g. Approved or Published), never a fixed delay: no magic number of days, easier to control when a certificate is ready, more maintainable. No buffer days for now; if ever needed, an app setting (configurable), not hard-coded. Principle: show what we have, exactly what the system holds, so there are no surprises such as “yesterday it was empty, today it isn’t”.', who: 'CMCS data owner', status: 'Confirmation required', source: OWNER, action: 'Arjan to get the exact status values confirmed.', impact: 'API filters on status.' },
  { id: 'U3', topic: 'Value of each additional certificate field', at: ['search', 'record', 'fields'], q: 'What value does each additional field give the person with the fine, Revenue NSW or another user: device model, Gazette reference, device approval scope, inspection date and time, inspection details, certification date, the masked officer name and signature (BR_02) and the re-issued marker (BR_09)?', why: 'The BRD asks for these, but each adds data work and possibly API change; only fields with real user value should be built.', assume: 'Whether a certificate record exists in CMCS is the source of truth. Value per field not yet confirmed.', who: 'CMCS and CES data owners (what exists); the business (the value)', status: 'Assumption to validate', source: SHOTS + '; ' + BRD + ' BR_01', action: 'Confirm the user value of each field; ask CMCS for anonymised sample certificates showing every required field.', impact: 'Field delta; S10, S16 stay blocked.' },
  { id: 'U4', topic: 'Duplicate rows', at: ['search'], q: 'Are identical rows in the legacy grid re-issued certificates or data errors, and how should the page group them?', why: 'The legacy screenshot shows rows with identical type, cycle and dates that nothing tells apart.', assume: 'More than one certificate for the same item is a system or data error unless they differ in state (withdrawn, re-issued). The page shows one record per grouping key: program + site + certificate cycle + certification date; lifecycle status decides which row wins (current beats withdrawn; a re-issue replaces the original and is marked). Examples (invented): two identical yearly rows for 1234 on 12/08/2025 show once, flagged as a data error; 4567’s withdrawn quarterly plus its re-issue show the re-issue with its marker and the withdrawn one as withdrawn (pending U22); the same site on two certification dates shows both.', who: 'CMCS data owner', status: 'Confirmation required', source: OWNER + '; ' + SHOTS + '; ' + BRD + ' BR_09', action: 'Confirm the grouping key and the data-error handling.', impact: 'Duplicate handling (S9).' },
  { id: 'U5', topic: 'Camera programs and their certificate types', at: ['record'], q: 'What is the relationship between a camera program and its certificate types, and do the rules (which types apply, which wins when several are in force, e.g. yearly and quarterly) need to be configurable per program?', why: 'The end-user page shows only what applies to the offence; the rule may differ by program.', assume: 'All certificates in force on the offence day, one per cycle, until the per-program rules are known.', who: 'Transport, CMCS / CES data owners, Legal', status: 'Confirmation required', source: OWNER + '; ' + BRD + ' BR_01', action: 'Confirm the program-to-certificate-type rules and whether they must be configurable per program. See U36 and S21.', impact: 'End-user record (S11); program templates (S21).' },
  { id: 'U6', topic: 'One certificate view, two ways in', at: ['search', 'record'], q: 'Do the public record page and an expanded staff search row show the same details?', why: 'One component and one API instead of two.', assume: 'Both pages are public with no login (U14), so information cannot be compartmentalised: anything in the staff search view is public. With no login planned, staff-only detail must not be shown at all.', who: 'Product owner', status: 'Confirmation required', source: OWNER, action: 'Decide whether any staff-only detail exists; if so, decide on authentication.', impact: 'Shared detail component.' },
  { id: 'U7', topic: 'API for other government sites', at: ['fields'], q: 'How do Service NSW and Revenue NSW get certificate data?', why: 'They should call an API, never scrape a website. Today Service NSW and Revenue NSW have no way to display penalty or certificate details.', assume: 'Future scope, but designed for now: the APIs built for this uplift are reusable, not one-off, for the later broader Transport facelift (the earlier customer-facing mock-up) and for Service NSW and Revenue NSW. Versioned REST API, GET with query parameters (location codes, from, to).', who: 'Enterprise architecture', status: 'Future scope', source: OWNER, action: 'Design the API as reusable; see U37 for who consumes it.', impact: 'API contract (S16, low priority).' },
  { id: 'U8', topic: 'Legal disclaimer', at: ['record'], q: 'What disclaimer must the record show?', why: 'The BRD requires one (BR_05).', assume: 'Proposed: “This page is not a legal document. If you need the certificate for legal purposes, you can make an access application under the GIPA Act to Transport for NSW. A fee may apply as part of the GIPA process.” with “access application” linking to Transport’s access application page. Part of the configurable template (S20). The fee amount is not shown.', who: 'Legal', status: 'Confirmation required', source: OWNER + '; ' + BRD + ' BR_05', action: 'Legal to confirm the proposed wording.', impact: 'Disclaimer on the record page (S20).' },
  { id: 'U9', topic: 'Where Close goes', at: ['search', 'record'], q: 'What should Close do, given people arrive from different places?', why: 'People from a signed link have no earlier CEVOC page to go back to; staff came from the search. Browsers often block a page from closing its own tab.', assume: 'Proposed: depends on how the person arrived. Staff on the search: “Back to search”, keeping their filters. Public via a signed link: the link carries a source code (e.g. Service NSW, Revenue NSW myPenalty), covered by the signature; the page looks up that source’s return link in the app settings and shows “Return to <source>”. Source missing or unknown: no return button, just “You can close this tab”. No reliance on the browser referrer or on closing the window.', who: 'Product owner', status: 'Confirmation required', source: OWNER + '; ' + SHOTS, action: 'Confirm the behaviour and the return link for each source.', impact: 'S18, S22; app setting record.returnLinks.' },
  { id: 'U10', topic: 'Default dates', at: ['search'], q: 'What do the dates hold when the search page opens?', why: 'Only the staff search has dates to default; a signed link already carries the exact offence date. The legacy page fills To with the current date and time.', assume: 'Proposed: the “Last 6 months” preset (From = today minus six months, To = today, Sydney time), days only. The default preset is an app setting (configurable).', who: 'Product owner', status: 'Confirmation required', source: OWNER, action: 'Confirm six months.', impact: 'Form defaults; app setting search.defaultPreset.' },
  { id: 'U11', topic: 'Contact us and Help', at: ['search', 'record'], q: 'Where do Contact us and Help go?', why: 'They are on the legacy page.', assume: 'Proposed: the destinations the legacy links use today (to be captured), kept as app settings (configurable) so they can change without a release.', who: 'Product owner', status: 'Confirmation required', source: OWNER + '; ' + SHOTS, action: 'Capture today’s destinations and confirm them.', impact: 'Header links; app settings links.contactUs and links.help.' },
  { id: 'U13', topic: 'Help text for customers (merged into U34)', at: ['record'], q: 'What explanatory text helps people read a certificate?', why: 'BR_06 asks for plain-English help on what the certificate means; BR_08 asks to point people with a court matter to customer enquiries.', assume: 'Merged into U34: the help text is part of the copy variants being tested.', who: 'Transport', status: 'Merged', source: OWNER + '; ' + BRD + ' BR_06, BR_08', action: 'See U34.', impact: 'Record page copy.', see: { to: '/uplift/hub/content', label: 'Copy variants (Page content tab)' } , noStoryReason: 'Merged into U34; its stories are U34’s.' },
  { id: 'U14', topic: 'Login', at: ['search', 'record'], q: 'Do the end-user view and the Revenue NSW staff search need a login?', why: 'The information is no more sensitive in one view than the other.', assume: 'No login on either. Staff use the search, but anyone on the internet could see this information, so the search is public too.', who: 'Product owner', status: 'Confirmation required', source: OWNER, action: 'Confirm; check with Cyber before build.', impact: 'No sign-in; see U6 and U32.' },
  { id: 'U15', topic: 'Link from the Service NSW app and myPenalty', at: ['record', 'journey'], q: 'How do the two apps link to the certificate record, and what does the link carry?', why: 'It is the only way the public reaches the record.', assume: 'Proposed, from the signed links the owner shared: the apps open the record page with a signed link carrying p (penalty notice number), d (offence date and time, yyyymmddThhmmss), s (site or camera number), i (meaning open, U29) and m (signature over the values), so a changed value shows the wrong-link message. No login and no search; it goes straight to one record. Going forward keep this format and add the source code inside the signature (U9). Port to the target stack: the signature is checked on the Java backend, the React front end only reads the result.', who: 'Service NSW, Revenue NSW, CEVOC technical owner', status: 'Confirmation required', source: OWNER, action: 'Confirm Service NSW and Revenue NSW can keep generating these links, and who holds the signing key.', impact: 'Entry flow page; S11, S14, S22.' },
  { ...PROGRAM_Q('U16', 'Red light speed camera'), topic: 'Certificate types per camera program (ADR-001)', q: 'For each camera program, which certificates must be in force, on what cycle, and which wins; and where do those rules live so a new program can be added without reworking the page? Sub-points, merged here with their IDs kept: U16 red light speed; U17 fixed speed; U18 average speed (point to point); U19 mobile speed; U20 mobile phone and seatbelt detection; U21 any other programs (e.g. heavy vehicle, school zone).', at: ['search', 'record', 'fields'], status: 'Confirmation required', assume: 'Raised as ADR-001 (must scale when a new program is added): either the program rules are app settings read by the page (A), or the API decides and returns display-ready results so the page holds no program knowledge (B). Proposed: B, with the rules held as app settings in the backend and an app setting to turn each program on or off.', action: 'Confirm ADR-001, then list the certificate types and cycles per program from CMCS.', see: { to: '/uplift/hub/adr?a=ADR-001', label: 'ADR-001 on the ADRs tab' } },
  { ...PROGRAM_Q('U17', 'Fixed speed camera'), topic: 'Certificate types: Fixed speed camera (merged into U16)', status: 'Merged', action: 'See U16.', see: { to: '/uplift/hub/questions?q=U16', label: 'U16 (ADR-001)' } },
  { ...PROGRAM_Q('U18', 'Average speed (point to point) camera'), topic: 'Certificate types: Average speed (point to point) camera (merged into U16)', status: 'Merged', action: 'See U16.', see: { to: '/uplift/hub/questions?q=U16', label: 'U16 (ADR-001)' } },
  { ...PROGRAM_Q('U19', 'Mobile speed camera'), topic: 'Certificate types: Mobile speed camera (merged into U16)', status: 'Merged', action: 'See U16.', see: { to: '/uplift/hub/questions?q=U16', label: 'U16 (ADR-001)' } },
  { ...PROGRAM_Q('U20', 'Mobile phone and seatbelt detection camera'), topic: 'Certificate types: Mobile phone and seatbelt detection camera (merged into U16)', status: 'Merged', action: 'See U16.', see: { to: '/uplift/hub/questions?q=U16', label: 'U16 (ADR-001)' } },
  { id: 'U21', topic: 'Other camera programs (merged into U16)', at: ['fields'], q: 'Are there other programs (for example heavy vehicle or school zone) with their own certificates?', why: 'Every enforced program needs its certificate list.', assume: 'The five programs above.', who: 'Camera program manager', status: 'Merged', source: OWNER, action: 'See U16.', impact: 'Gap detection.' , see: { to: '/uplift/hub/questions?q=U16', label: 'U16 (ADR-001)' } , noStoryReason: 'Merged into U16; its stories are U16’s.' },
  { id: 'U22', topic: 'Certificate lifecycle status', at: ['search', 'record'], q: 'How does each certificate lifecycle status (from CMCS, the source of truth) show on the search and the record page?', why: 'Hiding a real event silently would mislead; so would showing an unvalidated or withdrawn certificate as valid.', assume: 'Rule (owner): an unapproved certificate (issued but not approved) is never displayed. Proposed for the rest (see the Lifecycle tab): approved or in force shown normally; expired shown for offences inside its period; withdrawn shown with a Withdrawn tag and date if it covered the offence date; the re-issue shown with a Re-issued marker and the original shown as withdrawn; cancelled not shown and logged as a data error; duplicates collapsed to one row and flagged. Each status is a visible tag with text and colour, never colour alone. Each status-to-behaviour rule is an app setting.', who: 'CMCS data owner (statuses); Transport, Legal (behaviour)', status: 'Confirmation required', source: OWNER, action: 'Ask CMCS for the full list of lifecycle statuses and their meanings; confirm the behaviour table.', impact: 'S9, S12; app setting certificate.statusRules.', see: { to: '/uplift/hub/lifecycle', label: 'Lifecycle tab (behaviour table and status mock)' } },
  { id: 'U23', topic: 'Genuinely missing certificate', at: ['search', 'record'], q: 'When no certificate covered an enforced day, what do the pages show?', why: 'We expect a certificate for everything we enforce at all times, so a gap is a real problem and must never be hidden.', assume: 'Staff: a warning naming the location, cycle and dates. Public: “No certificate of this kind was in force on that day” with who to contact.', who: 'Transport, Legal', status: 'Assumption to validate', source: OWNER, action: 'Agree the wording and who is told when a gap is found.', impact: 'S8, S12.' },
  { id: 'U24', topic: 'System fault versus missing certificate', at: ['search', 'record'], q: 'What exactly do the fault, missing and no-match messages say?', why: 'A fault must never look like “no certificate”, and “no certificate” must never look like a fault.', assume: 'Fault: “We couldn’t get certificates right now. This is a problem with our system, not a missing certificate. Try again later.” Missing: as U23. No match: NSW empty state with a way forward.', who: 'Transport communications, Legal', status: 'Confirmation required', source: OWNER, action: 'Owner likes the current wording and keeps it; to be confirmed.', impact: 'S6, S7, S12, S13.' },
  { id: 'U25', topic: 'Location search', at: ['search'], q: 'What can staff search by, and how many locations at once?', why: 'Power users search several cameras and by address, not only by code.', assume: 'Code or any part of the address, from CMCS site records. Proposed: no limit on the page; chips wrap with a “+N more” collapse and Clear all, and results are grouped by location. The only reasons for a cap are API and database load on a public, unauthenticated endpoint and very large result sets; if one is ever needed it is an app setting enforced by the API (with paging), not a hard-coded limit in the page.', who: 'CMCS data owner, Revenue NSW', status: 'Confirmation required', source: OWNER, action: 'Confirm no page limit and the address source.', impact: 'S1, API parameters; app setting api.maxLocationsPerRequest.' },
  { id: 'U26', topic: 'Days, not times', at: ['search', 'record'], q: 'Is a day enough, given the legacy page used date and time?', why: 'Certified dates have no time; an offence on the morning of the certified day could fall before certification.', assume: 'Days are enough (owner). Edge case: same-day certification to confirm.', who: 'Transport, Legal', status: 'Assumption to validate', source: OWNER, action: 'Confirm the same-day rule.', impact: 'S2, S11.' },
  { id: 'U27', topic: 'Date range picker', at: ['search'], q: 'How do staff pick a date range?', why: 'The NSW Design System date picker has no start-to-end range mode.', assume: 'Decided (owner): presets (Last 7 days, Last 30 days, Last 3 months, Last 6 months, Last 12 months) plus two date inputs, From and To. A preset sets From; To is always today (Sydney time); editing either date switches to Custom. The preset list is an app setting. The airline-style range calendar is a nice-to-have, not phase 1.', who: 'Product owner', status: 'Resolved', source: OWNER + '; designsystem.nsw.gov.au/components/date-picker', action: 'None.', impact: 'S2; app settings search.datePresets and search.defaultPreset.' },
  { id: 'U28', topic: 'New label names (removed: labels handled per story)', at: ['search', 'fields'], q: 'Are the proposed new names right?', why: 'The label switch lets reviewers compare legacy and new names side by side.', assume: 'As listed on the field delta page.', who: 'Revenue NSW and Transport users', status: 'Removed', source: OWNER, action: 'Test with users.', impact: 'Labels.' },
  { id: 'U29', topic: 'Signed link: parameter i', at: ['record', 'entry'], q: 'What does the i parameter in the signed certificateDetails link mean?', why: 'The link carries p (notice number), d (offence date and time), s (site or camera), i and m (signature). We must reproduce it exactly for both apps.', assume: 'Unknown, possibly an image or incident index.', who: 'CEVOC technical owner', status: 'Assumption to validate', source: OWNER, action: 'Confirm from the CEVOC code or the link builders in Revenue NSW.', impact: 'Link contract (U15).' , see: { to: '/uplift/hub/entry', label: 'Signed link worked example (Entry from the apps)' } },
  { id: 'U30', topic: 'Signed link: how m is signed and checked', at: ['record', 'entry'], q: 'How is the signature m made, and what does CEVOC do when it does not match?', why: 'A tampered link must never show another person’s offence details.', assume: 'A keyed hash over p, d, s, i (and the source code, U9); on mismatch the page shows the wrong-link message. In the target stack the Java backend checks it and the React front end only reads the result.', who: 'CEVOC technical owner, Cyber', status: 'Assumption to validate', source: OWNER, action: 'Confirm the algorithm, key holder and rotation.', impact: 'Wrong-link state (S14).' , see: { to: '/uplift/hub/entry', label: 'Signed link worked example (Entry from the apps)' } },
  { id: 'U31', topic: 'Two Revenue NSW fine sites', at: ['entry', 'journey'], q: 'Do the Service NSW path (fines.digital) and the public myPenalty path (apps09) link to CEVOC the same way?', why: 'They are different websites that look alike.', assume: 'The owner saw both give the identical signed certificateDetails link. Direction: lean towards the newer Fines digital pathway, which is aligned with the digital systems. RISK: myPenalty and the new certificate page will look different, which may confuse people moving between them.', who: 'Product owner, Revenue NSW', status: 'Confirmation required', source: OWNER, action: 'Verify both send an identical parameter set; note the look-and-feel risk.', impact: 'One end-user page for both entry points.', see: { to: '/uplift/hub/entry', label: 'Entry from the apps' } },
  { id: 'U32', topic: 'Signed URL or federated login from Service NSW', at: ['entry', 'journey'], q: 'For the route from Service NSW, does the URL have to be signed, and must the person use Service NSW’s federated login to reach the certificate page?', why: 'People already arrive from Revenue NSW without a login, so requiring one for Service NSW would be inconsistent.', assume: 'Proposed: no federated login; the same signed URL for every source. That is consistent, and the information is public (U14). The signature only stops tampered or guessed links (enumeration).', who: 'Service NSW', status: 'Confirmation required', source: OWNER, action: 'Confirm with Service NSW.', impact: 'No login on the record page (U14); signed link for all sources (U15).', see: { to: '/uplift/hub/entry', label: 'Signed link worked example' } },
  { id: 'U33', topic: 'Outdated wording on myPenalty', at: ['entry'], q: 'myPenalty still says “Roads and Maritime Services (RMS) website” and “contact RMS”. Who updates it?', why: 'RMS no longer exists; the wording now points people to CEVOC under Transport.', assume: 'Out of scope for CEVOC (it is Revenue NSW’s site). Noted as an observation to pass on to Revenue NSW.', who: 'Revenue NSW', status: 'Out of scope', source: OWNER, action: 'Raise with Revenue NSW.', impact: 'None on CEVOC.' , noStoryReason: 'Out of scope: Revenue NSW’s own site, no CEVOC story.' },
  { id: 'U35', topic: 'Who maintains the copy template', at: ['record'], q: 'Who owns, edits and approves the static wording on the certificate page, and in what tool?', why: 'The template must be changeable without a release, but changes to legal and certification text need approval.', assume: 'Transport communications edits, Legal approves the disclaimer and certification wording; the tool is to be chosen.', who: 'Transport communications, Legal, delivery team', status: 'Assumption to validate', source: OWNER, action: 'Name the owner, approver and tool.', impact: 'S20.' },
  { id: 'U36', topic: 'Differences between camera programs', at: ['record', 'fields'], q: 'Do the camera programs (red light speed, fixed speed, average speed, mobile phone detection and others) differ in what the page shows, in dynamic fields or static copy?', why: 'If they differ, each program needs its own template (S21).', assume: 'Some copy differs (for example mobile phone detection has no speed measurement).', who: 'CMCS / CES data owners, camera program owners', status: 'Assumption to validate', source: OWNER, action: 'List the differences per program.', impact: 'S21 program templates.' },
  { id: 'U37', topic: 'Who consumes the API', at: ['fields'], q: 'Will Service NSW and Revenue NSW consume the certificate API, and who owns that agreement?', why: 'Designing the API for reuse only pays off if the agencies plan to use it.', assume: 'Not yet agreed.', who: 'Service NSW, Revenue NSW, Transport enterprise architecture', status: 'Assumption to validate', source: OWNER, action: 'Raise with both agencies and name the agreement owner.', impact: 'S16.' },
  { id: 'U34', topic: 'Copy for the end-user page', at: ['record'], q: 'Which wording works best for the static and dynamic text?', why: 'People arrive worried; each variant answers a different worry. Includes the help text the BRD asks for (BR_06, BR_08), merged from U13.', assume: 'Three variants to test: A reassurance, B plain summary, C what next.', who: 'Transport communications, customers in testing', status: 'Proposed UX improvement', source: OWNER, action: 'Test the variants with customers.', impact: 'Record page copy.', see: { to: '/uplift/hub/content', label: 'Copy variants (Page content tab)' } },
];
export const qById = (id) => QUESTIONS.find((q) => q.id === id);

// ---------------------------------------------------------------------------------------------------------------
// User stories, Given/When/Then. A story is ready for dev only when it has acceptance criteria and none of its
// questions is still open.
const ac = (g, w, t) => ({ g, w, t });
export const STORIES = [
  { id: 'S1', priority: 'Medium', user: 'Revenue NSW officer', path: 'happy path', brd: ['BR_10'], screen: 'search', role: 'Revenue NSW officer', want: 'search several camera locations at once, by code or by address', so: 'I can answer about any camera without repeating the search', qs: ['U25', 'U14'],
    ac: [ac('the search page', 'I type a code or part of an address', 'matching locations are suggested as I type'), ac('a suggestion', 'I pick it', 'it becomes a removable chip and I can add more'), ac('several chips', 'I search', 'results include every chosen location, with a Location column')] },
  { id: 'S2', priority: 'Medium', user: 'Revenue NSW officer', path: 'happy path', brd: ['BR_10'], screen: 'search', role: 'Revenue NSW officer', want: 'pick a date range with a preset or by typing the dates', so: 'I can set a range in one click', qs: ['U26', 'U10', 'U27'],
    ac: [ac('the search page opens', 'nothing has been chosen', 'the “Last 6 months” preset is selected, From is six months ago and To is today (Sydney time)'), ac('a preset', 'I choose it', 'From is set by the preset and To is today'), ac('a preset is selected', 'I edit From or To', 'the preset deselects and the range shows as Custom'), ac('the From and To fields', 'I type dd/mm/yyyy', 'the dates are checked as real dates, To on or after From')] },
  { id: 'S3', priority: 'Medium', user: 'Revenue NSW officer', path: 'happy path', brd: ['BR_10'], screen: 'search', role: 'Revenue NSW officer', want: 'sort the results', so: 'I can find the certificate I need', qs: [],
    ac: [ac('results', 'I click a sortable column heading', 'rows sort ascending, then descending on a second click'), ac('a date column', 'it is sorted', 'dates sort as dates and the sorted column is announced')] },
  { id: 'S4', priority: 'Medium', user: 'Revenue NSW officer', path: 'happy path', brd: ['BR_10'], screen: 'search', role: 'Revenue NSW officer', want: 'expand a result in place to see its details', so: 'I don’t lose my place in the list', qs: ['U6'],
    ac: [ac('a result row', 'I activate it', 'its details open directly below it and the control says it is expanded'), ac('an expanded row', 'I activate it again', 'it collapses'), ac('several rows', 'I expand more than one', 'each stays open until I close it')] },
  { id: 'S5', priority: 'Medium', user: 'reviewer', path: 'happy path', brd: [], screen: 'search', role: 'reviewer', want: 'switch the labels between legacy and new names', so: 'I can compare what changes', qs: ['U28'],
    ac: [ac('any uplift screen', 'I choose Legacy names or New names', 'every label, button and column on the screen changes'), ac('a choice', 'I move to another screen', 'the choice is kept')] },
  { id: 'S6', priority: 'Medium', user: 'Revenue NSW officer', path: 'exception', brd: [], screen: 'search', role: 'Revenue NSW officer', want: 'a clear empty state when nothing matches', so: 'I know to change the search rather than report a fault', qs: ['U24'],
    ac: [ac('a search with no matching certificates', 'results load', 'an NSW Design System empty state says no certificates were found, repeats what was searched, and offers to change the search')] },
  { id: 'S7', priority: 'Medium', user: 'Revenue NSW officer', path: 'error / fault', brd: [], screen: 'search', role: 'Revenue NSW officer', want: 'a system fault to look different from a missing certificate', so: 'I never tell a customer a certificate is missing when our system failed', qs: ['U24'],
    ac: [ac('the certificate service fails', 'I search', 'an error alert says it is a system problem, not a missing certificate, and no empty state or table is shown'), ac('a fault', 'I press Try again', 'the search runs again')] },
  { id: 'S8', priority: 'Medium', user: 'Revenue NSW officer', path: 'exception', brd: [], screen: 'search', role: 'Revenue NSW officer', want: 'see when a certificate was genuinely missing', so: 'gaps are dealt with, not hidden', qs: ['U23', 'U16', 'U17', 'U18', 'U19', 'U20'],
    ac: [ac('a location with days in the range when no certificate of an expected cycle was in force', 'results load', 'a warning names the location, cycle and dates of each gap, above the table')] },
  { id: 'S9', priority: 'Medium', user: 'Revenue NSW officer', path: 'edge case', brd: ['BR_09'], screen: 'search', role: 'Revenue NSW officer', want: 'see withdrawn and re-issued certificates for what they are', so: 'identical-looking rows make sense', qs: ['U22', 'U4'],
    ac: [ac('a withdrawn certificate', 'it is listed', 'it is marked Withdrawn with the withdrawal date and is not counted as in force'), ac('a re-issued certificate', 'it is listed', 'it is marked Re-issued and its details name the certificate it replaces')] },
  { id: 'S10', priority: 'Medium', user: 'Revenue NSW officer', path: 'happy path', brd: ['BR_01', 'BR_02'], screen: 'search', role: 'Revenue NSW officer', want: 'see the certificate details the BRD asks for', so: 'I can answer without opening another system', qs: ['U3'],
    ac: [ac('an expanded row or a public record', 'it shows', 'device model, Gazette reference, approval scope, location, camera code, inspection date and time and inspection details are shown when CMCS holds them')] },
  { id: 'S11', priority: 'Medium', user: 'person with a fine', path: 'happy path', brd: ['BR_01', 'BR_03'], screen: 'record', role: 'person with a notice', want: 'see only the certificates for my offence, without logging in', so: 'I can trust the camera was certified that day', qs: ['U5', 'U15', 'U26', 'U1', 'U6', 'U14', 'U31', 'U32'],
    ac: [ac('a link with a location code and offence date', 'I open it', 'only certificates in force on that day are shown, one card each'), ac('the record', 'it shows', 'no other certificate for the location is listed, and there is no download, save or print')] },
  { id: 'S12', priority: 'Medium', user: 'person with a fine', path: 'exception', brd: ['BR_09'], screen: 'record', role: 'person with a notice', want: 'be told plainly when a certificate was missing or withdrawn on my offence day', so: 'nothing is hidden from me', qs: ['U22', 'U23', 'U24'],
    ac: [ac('no certificate of an expected cycle was in force that day', 'I open the link', 'a warning says so for that cycle and who to contact'), ac('a certificate covering that day was withdrawn', 'I open the link', 'it is shown as withdrawn, with any re-issued replacement')] },
  { id: 'S13', priority: 'Medium', user: 'person with a fine', path: 'error / fault', brd: [], screen: 'record', role: 'person with a notice', want: 'know when the system failed', so: 'I don’t think the camera wasn’t certified', qs: ['U24'],
    ac: [ac('the certificate service fails', 'I open the link', 'an error alert says it is a system problem, not a missing certificate, with Try again')] },
  { id: 'S14', priority: 'Medium', user: 'person with a fine', path: 'exception', brd: [], screen: 'record', role: 'person with a notice', want: 'a clear message when my link is wrong', so: 'I know what to do next', qs: ['U15', 'U29'],
    ac: [ac('a link with an unknown location code or a bad date', 'I open it', 'the page says the link couldn’t be matched to a camera and how to get help')] },
  { id: 'S15', priority: 'Medium', user: 'the business', path: 'happy path', brd: ['BR_04', 'BR_07'], screen: 'search', role: 'the business', want: 'only approved or published certificates to appear', so: 'nothing unvalidated is shown', qs: ['U2'],
    ac: [ac('a certificate in Draft', 'any search or record runs', 'it never appears'), ac('a certificate Approved or Published', 'its dates match', 'it appears straight away, with no delay in days')] },
  { id: 'S16', priority: 'Low', user: 'other agencies / API', path: 'happy path', brd: [], screen: 'fields', role: 'Service NSW or Revenue NSW', want: 'fetch certificates from an API', so: 'our own pages show the same answer without scraping', qs: ['U3', 'U7', 'U37'],
    ac: [ac('location codes and a date range', 'we call GET /certificates with them as query parameters', 'we get the same rows the page shows, as JSON, from a versioned, documented contract')] },
  { id: 'S17', priority: 'Medium', user: 'Revenue NSW officer', path: 'exception', brd: [], screen: 'search', role: 'Revenue NSW officer', want: 'be told what is wrong before searching', so: 'I fix it quickly', qs: [],
    ac: [ac('a missing location or date, a bad date, or To before From', 'I press Search', 'no search runs, and an error summary lists each problem with a link to its field')] },
  { id: 'S18', priority: 'Medium', user: 'Revenue NSW officer', path: 'happy path', brd: [], screen: 'search', role: 'Revenue NSW officer', want: 'clear the search or leave it', so: 'the page behaves as today', qs: ['U9'],
    ac: [ac('a filled search', 'I press Clear', 'locations, dates and results are cleared'), ac('the page', 'I press Close', 'I return to where I came from')] },
  { id: 'S20', priority: 'Medium', user: 'Transport', path: 'happy path', brd: ['BR_05', 'BR_06', 'BR_08'], screen: 'record', role: 'Transport content owner', want: 'change the static wording on the certificate page through a maintained, configurable template', so: 'wording can change without rewriting or redeploying the application', qs: ['U35', 'U8', 'U34'],
    ac: [ac('the certificate page', 'it renders', 'every static block (headings, sentences, requirements, contact, disclaimer) comes from the template, not from code'), ac('a content owner edits a block', 'they publish it', 'the page shows the new wording with no code change or release'), ac('a template block with placeholders such as {certificationDate}', 'it is saved', 'unknown placeholders are rejected and a preview shows the block with sample values'), ac('a published change', 'something is wrong', 'the previous version can be restored, and every change records who made it and when'), ac('the record page', 'it renders', 'the not-a-legal-document notice and the GIPA access application link show, both from the template')] },
  { id: 'S21', priority: 'Medium', user: 'Transport', path: 'edge case', brd: [], screen: 'record', role: 'Transport content owner', want: 'each camera program to show its own template where its content differs', so: 'people see fields and wording that fit their camera', qs: ['U36', 'U35'],
    ac: [ac('an offence from a program with its own template', 'the record page loads', 'that program’s template is used for both fields and copy'), ac('an offence from a program with no template of its own', 'the record page loads', 'the default template is used'), ac('a program template', 'it is edited', 'it changes without a code release, as in S20')] },
  { id: 'S22', priority: 'Medium', user: 'person with a fine', path: 'happy path', brd: [], screen: 'record', role: 'person with a fine', want: 'get back to the service I came from when I’m done', so: 'I can pay, request a review or elect court without hunting for the page', qs: ['U9', 'U30'],
    ac: [ac('I opened the record page from a signed link with source X', 'I finish reading', 'I see “Return to X”, linking to X’s page from the app settings'), ac('the link has no source or an unknown source', 'I finish reading', 'there is no return button, only “You can close this tab”'), ac('the source in the link was changed', 'I open it', 'the signature check fails and I see the wrong-link message')] },
  { id: 'S19', priority: 'Medium', user: 'the business', path: 'happy path', brd: [], screen: 'search', role: 'the business', want: 'the page restyled to the NSW Design System and accessible', so: 'phase 1 is a low-risk uplift', qs: ['U11', 'U1'],
    ac: [ac('any control', 'it is used by keyboard or screen reader', 'it meets WCAG 2.2 AA'), ac('a phone', 'the page is shown', 'there is no sideways page scrolling; the table scrolls in its box')] },
];
export const USERS = ['person with a fine', 'Revenue NSW officer', 'Transport', 'reviewer', 'the business', 'other agencies / API'];
export const PRIORITIES = ['High', 'Medium', 'Low'];
export const PATHS = ['happy path', 'exception', 'error / fault', 'edge case'];
export const storyReady = (s) => s.ac.length > 0 && !s.qs.some((id) => OPEN(qById(id)));
export const storiesFor = (screen) => STORIES.filter((s) => s.screen === screen);
export const questionsFor = (screen) => QUESTIONS.filter((q) => (q.at || []).includes(screen));

// ---------------------------------------------------------------------------------------------------------------
// Field delta: what the legacy page has against what the BRD asks for.
export const FIELDS = [
  { field: 'Location code', legacy: 'Yes (search input)', brd: '—', delta: 'Changed', change: 'One free-text search for code or address, several locations as chips (phase 1 UI).', source: 'CMCS sites', q: 'U25' },
  { field: 'Date/Time from', legacy: 'Yes (date and time)', brd: '—', delta: 'Changed', change: 'Day only, no time (owner).', source: '—', q: 'U26' },
  { field: 'Date/Time to', legacy: 'Yes (date and time, defaults to now)', brd: '—', delta: 'Changed', change: 'Day only, empty by default (owner).', source: '—', q: 'U10' },
  { field: 'Certificate Description', legacy: 'Yes', brd: 'BR_01', delta: 'Same', change: '', source: 'CMCS', q: '' },
  { field: 'Certificate type', legacy: 'Yes', brd: 'BR_01', delta: 'Same', change: '', source: 'CMCS', q: '' },
  { field: 'Period (YEARLY, QUARTERLY)', legacy: 'Yes', brd: '—', delta: 'Same', change: 'The certification cycle, not a date range.', source: 'CMCS', q: '' },
  { field: 'Certified date', legacy: 'Yes (date)', brd: 'BR_01 (inspection date and time)', delta: 'Changed', change: 'BRD wants the inspection date and time.', source: 'Unknown', q: 'U3' },
  { field: 'Expiry date', legacy: 'Yes', brd: '—', delta: 'Same', change: '', source: 'CMCS', q: '' },
  { field: 'Location (code) on each row', legacy: 'No (searched one location)', brd: '—', delta: 'New', change: 'Needed once several locations are searched.', source: 'CMCS', q: 'U25' },
  { field: 'Status (Approved, Published, Withdrawn)', legacy: 'No', brd: 'BR_04 / BR_07 (replaced)', delta: 'New', change: 'Visibility by status, not by days (owner).', source: 'CMCS', q: 'U2' },
  { field: 'Device model', legacy: 'No', brd: 'BR_01', delta: 'New', change: '', source: 'Unknown, likely CMCS', q: 'U3' },
  { field: 'Gazette reference', legacy: 'No', brd: 'BR_01', delta: 'New', change: '', source: 'Unknown', q: 'U3' },
  { field: 'Device approval scope', legacy: 'No', brd: 'BR_01', delta: 'New', change: '', source: 'Unknown', q: 'U3' },
  { field: 'Location (street or intersection)', legacy: 'No', brd: 'BR_01', delta: 'New', change: 'Also used for address search.', source: 'CMCS sites', q: 'U25' },
  { field: 'Camera code', legacy: 'No', brd: 'BR_01', delta: 'New', change: 'May equal the location code.', source: 'CMCS', q: 'U3' },
  { field: 'Inspection details', legacy: 'No', brd: 'BR_01', delta: 'New', change: 'Free-text narrative.', source: 'Unknown', q: 'U3' },
  { field: 'Officer name and signature', legacy: 'No', brd: 'BR_02 (masked)', delta: 'New', change: 'Only matters if a certificate image is shown.', source: 'Unknown', q: 'U3' },
  { field: 'Re-issued marker', legacy: 'No', brd: 'BR_09', delta: 'New', change: 'Needs a re-issue link in the data.', source: 'Unknown', q: 'U4' },
  { field: 'Withdrawn date', legacy: 'No', brd: '—', delta: 'New', change: 'For withdrawn certificates.', source: 'Unknown', q: 'U22' },
];

// ---------------------------------------------------------------------------------------------------------------
// Journey. Public user first (owner), then staff.
export const JOURNEY = {
  public: [
    { id: 'j1', name: 'Letter arrives', who: 'Person', note: 'Penalty notice in the post.', kind: 'person' },
    { id: 'j2', name: 'Finds the notice', who: 'Service NSW app or myPenalty', note: 'In whichever app they use.', kind: 'ext', fork: ['Service NSW app', 'myPenalty (Revenue NSW)'] },
    { id: 'j3', name: 'Sees what happened', who: 'Same app', note: 'Time, place, photos.', kind: 'ext' },
    { id: 'j4', name: 'Checks it’s fair', who: 'CEVOC certificate record', note: 'Link with location code and offence date; only the certificates in force that day.', kind: 'ours', to: '/uplift/record?p=4000000001&d=20260314T083000&s=5678&i=1&m=0000demo0signature0not0real0000', qs: ['U15', 'U31', 'U5'] },
    { id: 'j5', name: 'Decides', who: 'Back in the app (Revenue NSW)', note: 'Pay, request a review or elect to go to court.', kind: 'ext', fork: ['Pay', 'Request a review', 'Elect court'] },
  ],
  staff: [
    { id: 's1', name: 'Customer asks', who: 'Revenue NSW officer', note: 'Call or review request about a camera.', kind: 'person' },
    { id: 's2', name: 'Searches', who: 'CEVOC certificate search', note: 'Several locations, by code or address, over a date range.', kind: 'ours', to: '/uplift?locs=1234,4567&from=01%2F11%2F2025&to=30%2F06%2F2026&run=1', qs: ['U25'] },
    { id: 's3', name: 'Expands a row', who: 'Same page', note: 'Details in place; gaps, withdrawn and re-issued certificates are marked.', kind: 'ours', qs: ['U22', 'U23'] },
    { id: 's4', name: 'Answers', who: 'Revenue NSW officer', note: 'Resolves, or refers to Transport.', kind: 'person' },
  ],
};

// Sample searches and links the presenter can run.
export const SAMPLES = [
  { label: 'One camera, a year', locs: ['1234'], from: '01/11/2025', to: '31/10/2026', note: 'Seven certificates' },
  { label: 'Two cameras, missing and withdrawn', locs: ['1234', '4567'], from: '01/11/2025', to: '30/06/2026', note: 'Gap warning, withdrawn and re-issued rows' },
  { label: 'Nothing in range', locs: ['2345'], from: '01/01/2024', to: '31/03/2024', note: 'Empty state' },
  { label: 'Many locations', locs: ['1234', '2345', '3456', ...Array.from({ length: 12 }, (_, i) => String(6001 + i))], from: '01/12/2025', to: '31/03/2026', note: '15 locations: chips wrap, “+N more”, results grouped by location' },
  { label: 'System fault', locs: ['9999'], from: '01/11/2025', to: '30/06/2026', note: 'Fault, not missing' },
];
export const searchLink = (s) => `/uplift?locs=${s.locs.join(',')}&from=${encodeURIComponent(s.from)}&to=${encodeURIComponent(s.to)}&run=1`;
export const RECORD_SAMPLES = [
  { label: 'Certified on the day', loc: '1234', at: '14/03/2026', note: 'Yearly and quarterly in force' },
  { label: 'Withdrawn, then re-issued', loc: '4567', at: '05/12/2025', note: 'Withdrawn shown; re-issue starts 15/12' },
  { label: 'Genuinely missing', loc: '4567', at: '08/03/2026', note: 'No quarterly certificate in force' },
  { label: 'System fault', loc: '9999', at: '14/03/2026', note: 'Fault, not missing' },
  { label: 'Wrong link', loc: '0000', at: '14/03/2026', note: 'Unknown location' },
];
export const recordLink = (s) => `/uplift/record?loc=${s.loc}&at=${encodeURIComponent(s.at)}`;
