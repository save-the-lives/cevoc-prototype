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
  c('4567', 'QUARTERLY', '15/12/2025', '28/02/2026', 'Published', { reissueOf: 'c22' }),
  c('4567', 'QUARTERLY', '15/03/2026', '12/06/2026'),
  c('4567', 'QUARTERLY', '13/06/2026', '10/09/2026', 'Draft'),
  c('5678', 'QUARTERLY', '02/03/2026', '31/05/2026'),
  c('5678', 'QUARTERLY', '25/11/2025', '23/02/2026'),
];

// The signed link both apps open today: certificateDetails.jsf?p=&d=&s=&i=&m= (owner, 25 Nov 2026).
// p notice number, d offence date-time yyyyMMddTHHmmss, s site or camera, i unknown (U29), m signature (U30).
// One invented fine is used for both entry flows so they can be compared. All values are fictitious.
export const OFFENCES = [
  { p: '4000000001', d: '20260314T083000', s: '5678', i: '1', program: 'Mobile Phone Detection Camera', offence: 'Driver use mobile phone when not permitted - camera detected - Individual', amount: '$000.00' },
  { p: '4000000002', d: '20260308T171500', s: '4567', i: '1', program: 'Red Light Speed Camera', offence: 'Proceed through red traffic light - camera detected - Individual', amount: '$000.00' },
];
export const DEMO_SIGNATURE = '0000demo0signature0not0real0000';
export const signedLink = (o) => `/uplift/record?p=${o.p}&d=${o.d}&s=${o.s}&i=${o.i}&m=${DEMO_SIGNATURE}`;
export const offenceFromLink = (q) => {
  const o = OFFENCES.find((x) => x.p === q.p && x.d === q.d && x.s === q.s && x.i === q.i);
  return o && q.m === DEMO_SIGNATURE ? o : null;
};
export const ENTRY_LINK = signedLink(OFFENCES[0]);
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
    rows.push(...touching);
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
export const STATUS = ['Confirmed requirement', 'Assumption to validate', 'Proposed UX improvement', 'Out of scope'];
export const OPEN = (q) => q.status === 'Assumption to validate';
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
  { id: 'U2', topic: 'When a certificate appears', at: ['search', 'record'], q: 'Which status values make a certificate visible?', why: 'Replaces the BRD’s conflicting day delays (BR_04 five to six business days, BR_07 immediate).', assume: 'Approved or Published appear; Draft never does. No delay in days.', who: 'CMCS data owner', status: 'Confirmed requirement', source: OWNER, action: 'Confirm the exact status values in CMCS.', impact: 'API filters on status.' },
  { id: 'U3', topic: 'Sample certificate data from CMCS', at: ['search', 'record', 'fields'], q: 'Which certificate fields exist today, and in which form?', why: 'The BRD asks for seven fields the legacy grid does not show. If CMCS lacks them, the API and data change.', assume: 'They exist inside the certificate record in CMCS, the source of truth.', who: 'CMCS data owner', status: 'Assumption to validate', source: SHOTS + '; ' + BRD + ' BR_01', action: 'Request anonymised sample certificates from CMCS showing every field, its status values and where it is stored.', impact: 'Field delta; S10, S16 stay blocked.' },
  { id: 'U4', topic: 'Duplicate rows', at: ['search'], q: 'Are identical rows in the legacy grid re-issued certificates?', why: 'The legacy screenshot shows rows with identical type, cycle and dates that nothing tells apart.', assume: 'They are re-issues; the new page marks the replacement and the one it replaced.', who: 'CMCS data owner', status: 'Assumption to validate', source: SHOTS + '; ' + BRD + ' BR_09', action: 'Check against the CMCS samples.', impact: 'Re-issue marker (S9).' },
  { id: 'U5', topic: 'Which certificate counts for an offence', at: ['record'], q: 'When a yearly and a quarterly certificate are both in force, which does a person need to see?', why: 'The end-user view shows only what applies to their offence.', assume: 'All certificates in force on the offence day, one per cycle.', who: 'Transport, Legal', status: 'Assumption to validate', source: BRD + ' BR_01', action: 'Confirm the rule, including re-issues.', impact: 'End-user record (S11).' },
  { id: 'U6', topic: 'One certificate view, two ways in', at: ['search', 'record'], q: 'Do the public record and an expanded staff row show the same details?', why: 'One component and one API instead of two.', assume: 'Yes: same fields, the public sees only the certificates for their offence.', who: 'Product owner', status: 'Confirmed requirement', source: OWNER, action: 'None.', impact: 'Shared detail component.' },
  { id: 'U7', topic: 'API for other government sites', at: ['fields'], q: 'How do Service NSW and Revenue NSW get certificate data?', why: 'They should call an API, never scrape a website.', assume: 'Versioned REST API, GET with query parameters (location codes, from, to).', who: 'Enterprise architecture', status: 'Confirmed requirement', source: OWNER, action: 'Agree agency-to-agency authentication and response fields once U3 is answered.', impact: 'API contract (S16).' },
  { id: 'U8', topic: 'Legal disclaimer', at: ['record'], q: 'What disclaimer must the record show?', why: 'The BRD requires one (BR_05); wording is with Legal.', assume: 'A short paragraph under the certificate.', who: 'Legal', status: 'Assumption to validate', source: BRD + ' BR_05', action: 'Legal to supply the wording.', impact: 'Text on the record page.' },
  { id: 'U9', topic: 'Where Close goes', at: ['search'], q: 'What does CLOSE return to on the legacy page?', why: 'Staff expect the same exit.', assume: 'Unknown; the mock-up clears the search.', who: 'Product owner', status: 'Assumption to validate', source: SHOTS, action: 'Check on the legacy page.', impact: 'S18.' },
  { id: 'U10', topic: 'Default dates', at: ['search'], q: 'What do the dates hold when the page opens?', why: 'The legacy page fills To with the current date and time.', assume: 'Both empty; days only, no time (owner).', who: 'Product owner', status: 'Confirmed requirement', source: OWNER, action: 'None.', impact: 'Form defaults.' },
  { id: 'U11', topic: 'Contact us and Help', at: ['search'], q: 'Where do Contact us and Help go?', why: 'They are on the legacy page; destinations unknown.', assume: 'Kept, destinations to capture.', who: 'Product owner', status: 'Assumption to validate', source: SHOTS, action: 'Capture the current destinations.', impact: 'Header links.' },
  { id: 'U13', topic: 'Help text for customers', at: ['record'], q: 'What explanatory text helps people read a certificate?', why: 'BR_06 asks for it, BR_08 for directing court matters to customer enquiries.', assume: 'Short plain-English notes on the record page.', who: 'Transport', status: 'Assumption to validate', source: BRD + ' BR_06, BR_08', action: 'Draft and test.', impact: 'Record page content.' },
  { id: 'U14', topic: 'Login', at: ['search', 'record'], q: 'Do the end-user and Revenue views need a login?', why: 'The information is no more sensitive in one view than the other.', assume: 'No login on either. The difference is scope: one record, or the list.', who: 'Product owner', status: 'Confirmed requirement', source: OWNER, action: 'Confirm with Cyber before build.', impact: 'No sign-in.' },
  { id: 'U15', topic: 'Link from the Service NSW app and myPenalty', at: ['record', 'journey'], q: 'How do the two apps link to the certificate record, and what does the link carry?', why: 'It is the only way the public reaches the record.', assume: 'A link carrying the location code and the offence date.', who: 'Service NSW, Revenue NSW', status: 'Assumption to validate', source: OWNER, action: 'Agree the link with both app owners; owner to share app screenshots.', impact: 'Entry flow page; S11, S14.' },
  PROGRAM_Q('U16', 'Red light speed camera'),
  PROGRAM_Q('U17', 'Fixed speed camera'),
  PROGRAM_Q('U18', 'Average speed (point to point) camera'),
  PROGRAM_Q('U19', 'Mobile speed camera'),
  PROGRAM_Q('U20', 'Mobile phone and seatbelt detection camera'),
  { id: 'U21', topic: 'Other camera programs', at: ['fields'], q: 'Are there other programs (for example heavy vehicle or school zone) with their own certificates?', why: 'Every enforced program needs its certificate list.', assume: 'The five programs above.', who: 'Camera program manager', status: 'Assumption to validate', source: OWNER, action: 'Confirm the full program list.', impact: 'Gap detection.' },
  { id: 'U22', topic: 'Withdrawn certificates', at: ['search', 'record'], q: 'How is a certificate that was issued and then withdrawn shown, and what does a person whose offence fell in its period see?', why: 'Hiding it silently would hide a real event; showing it as valid would mislead.', assume: 'Staff: listed, marked Withdrawn with the date, and the re-issue linked. Public: told a certificate was withdrawn and shown the replacement, or told none was in force.', who: 'Transport, Legal', status: 'Assumption to validate', source: OWNER, action: 'Decide display and wording for staff and public.', impact: 'S9, S12.' },
  { id: 'U23', topic: 'Genuinely missing certificate', at: ['search', 'record'], q: 'When no certificate covered an enforced day, what do the pages show?', why: 'We expect a certificate for everything we enforce at all times, so a gap is a real problem and must never be hidden.', assume: 'Staff: a warning naming the location, cycle and dates. Public: “No certificate of this kind was in force on that day” with who to contact.', who: 'Transport, Legal', status: 'Assumption to validate', source: OWNER, action: 'Agree the wording and who is told when a gap is found.', impact: 'S8, S12.' },
  { id: 'U24', topic: 'System fault versus missing certificate', at: ['search', 'record'], q: 'What exactly do the fault, missing and no-match messages say?', why: 'A fault must never look like “no certificate”, and “no certificate” must never look like a fault.', assume: 'Fault: “We couldn’t get certificates right now. This is a problem with our system, not a missing certificate. Try again later.” Missing: as U23. No match: NSW empty state with a way forward.', who: 'Transport communications, Legal', status: 'Assumption to validate', source: OWNER, action: 'Approve the three messages.', impact: 'S6, S7, S12, S13.' },
  { id: 'U25', topic: 'Location search', at: ['search'], q: 'What can staff search by, and how many locations at once?', why: 'Power users search several cameras and by address, not only by code.', assume: 'Code or any part of the address, from CMCS site records; up to 10 locations.', who: 'CMCS data owner, Revenue NSW', status: 'Assumption to validate', source: OWNER, action: 'Confirm the address source and a sensible maximum.', impact: 'S1, API parameters.' },
  { id: 'U26', topic: 'Days, not times', at: ['search', 'record'], q: 'Is a day enough, given the legacy page used date and time?', why: 'Certified dates have no time; an offence on the morning of the certified day could fall before certification.', assume: 'Days are enough (owner). Edge case: same-day certification to confirm.', who: 'Transport, Legal', status: 'Assumption to validate', source: OWNER, action: 'Confirm the same-day rule.', impact: 'S2, S11.' },
  { id: 'U27', topic: 'Date range picker', at: ['search'], q: 'How do staff pick a date range?', why: 'The NSW Design System date picker has no start-to-end range mode.', assume: 'One calendar: first click sets From, second sets To, with From and To still typeable. Follows the NSW picker’s format (dd/mm/yyyy), look and keyboard pattern.', who: 'Product owner', status: 'Confirmed requirement', source: OWNER + '; designsystem.nsw.gov.au/components/date-picker', action: 'None.', impact: 'S2.' },
  { id: 'U28', topic: 'New label names', at: ['search', 'fields'], q: 'Are the proposed new names right?', why: 'The label switch lets reviewers compare legacy and new names side by side.', assume: 'As listed on the field delta page.', who: 'Revenue NSW and Transport users', status: 'Assumption to validate', source: OWNER, action: 'Test with users.', impact: 'Labels.' },
  { id: 'U29', topic: 'Signed link: parameter i', at: ['record', 'entry'], q: 'What does the i parameter in the signed certificateDetails link mean?', why: 'The link carries p (notice number), d (offence date and time), s (site or camera), i and m (signature). We must reproduce it exactly for both apps.', assume: 'Unknown, possibly an image or incident index.', who: 'CEVOC technical owner', status: 'Assumption to validate', source: OWNER, action: 'Confirm from the CEVOC code or the link builders in Revenue NSW.', impact: 'Link contract (U15).' },
  { id: 'U30', topic: 'Signed link: how m is signed and checked', at: ['record', 'entry'], q: 'How is the signature m made, and what does CEVOC do when it does not match?', why: 'A tampered link must never show another person’s offence details.', assume: 'A keyed hash over p, d, s and i; on mismatch the page shows the wrong-link message.', who: 'CEVOC technical owner, Cyber', status: 'Assumption to validate', source: OWNER, action: 'Confirm the algorithm, key holder and rotation.', impact: 'Wrong-link state (S14).' },
  { id: 'U31', topic: 'Two Revenue NSW fine sites', at: ['entry', 'journey'], q: 'Do the Service NSW path (fines.digital) and the public myPenalty path (apps09) link to CEVOC the same way?', why: 'They are different websites that look alike.', assume: 'Verified by the owner: both give the identical signed certificateDetails link, so one CEVOC page serves both.', who: 'Product owner', status: 'Confirmed requirement', source: OWNER, action: 'None.', impact: 'One end-user page for both entry points.' },
  { id: 'U32', topic: 'Service NSW to Revenue NSW sign-on', at: ['entry', 'journey'], q: 'Does the single sign-on from Service NSW into Revenue NSW’s fines site affect the CEVOC link?', why: 'The logged-in path never asks for the registration; the public path does.', assume: 'No: the link is signed and needs no session, so CEVOC needs no login.', who: 'Service NSW, Revenue NSW', status: 'Assumption to validate', source: OWNER, action: 'Confirm with both agencies.', impact: 'No login on the record page (U14).' },
  { id: 'U33', topic: 'Outdated wording on myPenalty', at: ['entry'], q: 'myPenalty still says “Roads and Maritime Services (RMS) website” and “contact RMS”. Who updates it?', why: 'RMS no longer exists; the wording now points people to CEVOC under Transport.', assume: 'Out of scope for the CEVOC uplift; raise with Revenue NSW.', who: 'Revenue NSW', status: 'Out of scope', source: OWNER, action: 'Raise with Revenue NSW.', impact: 'None on CEVOC.' },
  { id: 'U35', topic: 'Who maintains the copy template', at: ['record'], q: 'Who owns, edits and approves the static wording on the certificate page, and in what tool?', why: 'The template must be changeable without a release, but changes to legal and certification text need approval.', assume: 'Transport communications edits, Legal approves the disclaimer and certification wording; the tool is to be chosen.', who: 'Transport communications, Legal, delivery team', status: 'Assumption to validate', source: OWNER, action: 'Name the owner, approver and tool.', impact: 'S20.' },
  { id: 'U34', topic: 'Copy for the end-user page', at: ['record'], q: 'Which wording works best for the static and dynamic text?', why: 'People arrive worried; each variant answers a different worry.', assume: 'Three variants to test: A reassurance, B plain summary, C what next.', who: 'Transport communications, customers in testing', status: 'Proposed UX improvement', source: OWNER, action: 'Test the variants with customers.', impact: 'Record page copy.' },
];
export const qById = (id) => QUESTIONS.find((q) => q.id === id);

// ---------------------------------------------------------------------------------------------------------------
// User stories, Given/When/Then. A story is ready for dev only when it has acceptance criteria and none of its
// questions is still open.
const ac = (g, w, t) => ({ g, w, t });
export const STORIES = [
  { id: 'S1', screen: 'search', role: 'Revenue NSW officer', want: 'search several camera locations at once, by code or by address', so: 'I can answer about any camera without repeating the search', qs: ['U25'],
    ac: [ac('the search page', 'I type a code or part of an address', 'matching locations are suggested as I type'), ac('a suggestion', 'I pick it', 'it becomes a removable chip and I can add more'), ac('several chips', 'I search', 'results include every chosen location, with a Location column')] },
  { id: 'S2', screen: 'search', role: 'Revenue NSW officer', want: 'pick a date range in one calendar or type the dates', so: 'I can set a range in two clicks', qs: ['U26'],
    ac: [ac('the calendar is open', 'I click a first day then a second day', 'From and To are filled and the days between are highlighted'), ac('the From and To fields', 'I type dd/mm/yyyy', 'the calendar opens on that range'), ac('a keyboard user', 'they open the calendar', 'arrows move by day, Page Up/Down by month, Enter picks, Escape closes, as in the NSW date picker')] },
  { id: 'S3', screen: 'search', role: 'Revenue NSW officer', want: 'sort the results', so: 'I can find the certificate I need', qs: [],
    ac: [ac('results', 'I click a sortable column heading', 'rows sort ascending, then descending on a second click'), ac('a date column', 'it is sorted', 'dates sort as dates and the sorted column is announced')] },
  { id: 'S4', screen: 'search', role: 'Revenue NSW officer', want: 'expand a result in place to see its details', so: 'I don’t lose my place in the list', qs: [],
    ac: [ac('a result row', 'I activate it', 'its details open directly below it and the control says it is expanded'), ac('an expanded row', 'I activate it again', 'it collapses'), ac('several rows', 'I expand more than one', 'each stays open until I close it')] },
  { id: 'S5', screen: 'search', role: 'reviewer', want: 'switch the labels between legacy and new names', so: 'I can compare what changes', qs: ['U28'],
    ac: [ac('any uplift screen', 'I choose Legacy names or New names', 'every label, button and column on the screen changes'), ac('a choice', 'I move to another screen', 'the choice is kept')] },
  { id: 'S6', screen: 'search', role: 'Revenue NSW officer', want: 'a clear empty state when nothing matches', so: 'I know to change the search rather than report a fault', qs: ['U24'],
    ac: [ac('a search with no matching certificates', 'results load', 'an NSW Design System empty state says no certificates were found, repeats what was searched, and offers to change the search')] },
  { id: 'S7', screen: 'search', role: 'Revenue NSW officer', want: 'a system fault to look different from a missing certificate', so: 'I never tell a customer a certificate is missing when our system failed', qs: ['U24'],
    ac: [ac('the certificate service fails', 'I search', 'an error alert says it is a system problem, not a missing certificate, and no empty state or table is shown'), ac('a fault', 'I press Try again', 'the search runs again')] },
  { id: 'S8', screen: 'search', role: 'Revenue NSW officer', want: 'see when a certificate was genuinely missing', so: 'gaps are dealt with, not hidden', qs: ['U23', 'U16', 'U17', 'U18', 'U19', 'U20'],
    ac: [ac('a location with days in the range when no certificate of an expected cycle was in force', 'results load', 'a warning names the location, cycle and dates of each gap, above the table')] },
  { id: 'S9', screen: 'search', role: 'Revenue NSW officer', want: 'see withdrawn and re-issued certificates for what they are', so: 'identical-looking rows make sense', qs: ['U22', 'U4'],
    ac: [ac('a withdrawn certificate', 'it is listed', 'it is marked Withdrawn with the withdrawal date and is not counted as in force'), ac('a re-issued certificate', 'it is listed', 'it is marked Re-issued and its details name the certificate it replaces')] },
  { id: 'S10', screen: 'search', role: 'Revenue NSW officer', want: 'see the certificate details the BRD asks for', so: 'I can answer without opening another system', qs: ['U3'],
    ac: [ac('an expanded row or a public record', 'it shows', 'device model, Gazette reference, approval scope, location, camera code, inspection date and time and inspection details are shown when CMCS holds them')] },
  { id: 'S11', screen: 'record', role: 'person with a notice', want: 'see only the certificates for my offence, without logging in', so: 'I can trust the camera was certified that day', qs: ['U5', 'U15', 'U26'],
    ac: [ac('a link with a location code and offence date', 'I open it', 'only certificates in force on that day are shown, one card each'), ac('the record', 'it shows', 'no other certificate for the location is listed, and there is no download, save or print')] },
  { id: 'S12', screen: 'record', role: 'person with a notice', want: 'be told plainly when a certificate was missing or withdrawn on my offence day', so: 'nothing is hidden from me', qs: ['U22', 'U23', 'U24'],
    ac: [ac('no certificate of an expected cycle was in force that day', 'I open the link', 'a warning says so for that cycle and who to contact'), ac('a certificate covering that day was withdrawn', 'I open the link', 'it is shown as withdrawn, with any re-issued replacement')] },
  { id: 'S13', screen: 'record', role: 'person with a notice', want: 'know when the system failed', so: 'I don’t think the camera wasn’t certified', qs: ['U24'],
    ac: [ac('the certificate service fails', 'I open the link', 'an error alert says it is a system problem, not a missing certificate, with Try again')] },
  { id: 'S14', screen: 'record', role: 'person with a notice', want: 'a clear message when my link is wrong', so: 'I know what to do next', qs: ['U15'],
    ac: [ac('a link with an unknown location code or a bad date', 'I open it', 'the page says the link couldn’t be matched to a camera and how to get help')] },
  { id: 'S15', screen: 'search', role: 'the business', want: 'only approved or published certificates to appear', so: 'nothing unvalidated is shown', qs: [],
    ac: [ac('a certificate in Draft', 'any search or record runs', 'it never appears'), ac('a certificate Approved or Published', 'its dates match', 'it appears straight away, with no delay in days')] },
  { id: 'S16', screen: 'fields', role: 'Service NSW or Revenue NSW', want: 'fetch certificates from an API', so: 'our own pages show the same answer without scraping', qs: ['U3', 'U7'],
    ac: [ac('location codes and a date range', 'we call GET /certificates with them as query parameters', 'we get the same rows the page shows, as JSON, from a versioned, documented contract')] },
  { id: 'S17', screen: 'search', role: 'Revenue NSW officer', want: 'be told what is wrong before searching', so: 'I fix it quickly', qs: [],
    ac: [ac('a missing location or date, a bad date, or To before From', 'I press Search', 'no search runs, and an error summary lists each problem with a link to its field')] },
  { id: 'S18', screen: 'search', role: 'Revenue NSW officer', want: 'clear the search or leave it', so: 'the page behaves as today', qs: ['U9'],
    ac: [ac('a filled search', 'I press Clear', 'locations, dates and results are cleared'), ac('the page', 'I press Close', 'I return to where I came from')] },
  { id: 'S20', screen: 'record', role: 'Transport content owner', want: 'change the static wording on the certificate page through a maintained, configurable template', so: 'wording can change without rewriting or redeploying the application', qs: ['U35'],
    ac: [ac('the certificate page', 'it renders', 'every static block (headings, sentences, requirements, contact, disclaimer) comes from the template, not from code'), ac('a content owner edits a block', 'they publish it', 'the page shows the new wording with no code change or release'), ac('a template block with placeholders such as {certificationDate}', 'it is saved', 'unknown placeholders are rejected and a preview shows the block with sample values'), ac('a published change', 'something is wrong', 'the previous version can be restored, and every change records who made it and when')] },
  { id: 'S19', screen: 'search', role: 'the business', want: 'the page restyled to the NSW Design System and accessible', so: 'phase 1 is a low-risk uplift', qs: ['U11'],
    ac: [ac('any control', 'it is used by keyboard or screen reader', 'it meets WCAG 2.2 AA'), ac('a phone', 'the page is shown', 'there is no sideways page scrolling; the table scrolls in its box')] },
];
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
