// CERTIFICATE UPLIFT (phase 1): demo content for the lift-and-shift of the legacy certificate search
// (Customer Enquiry and Verification of Certificate). Same status vocabulary as register.js.
// Sources: the owner's screenshots of the legacy page (25 Nov 2026), owner decisions by voice, and the
// CEVOC Enhancement BRD v1.1 (Nov 2026). All certificates shown in the prototype are fictitious.

export const SHOTS = 'Owner screenshots of the legacy page, 25 Nov 2026';
export const OWNER = 'Owner decision, 25 Nov 2026';
export const BRD = 'CEVOC Enhancement BRD v1.1';

// Sample searches the presenter can run. Each opens #/uplift with the form filled and the search run.
export const UPLIFT_SAMPLES = [
  { label: 'A year of certificates', loc: '1234', from: '01/11/2025 00:00', to: '25/11/2026 12:00', note: '7 certificates' },
  { label: 'One month (in force only)', loc: '1234', from: '01/01/2026 00:00', to: '31/01/2026 23:59', note: '2 certificates' },
  { label: 'Unknown location', loc: '0000', from: '01/11/2025 00:00', to: '25/11/2026 12:00', note: 'No records found.' },
];

export const upliftLink = (s) => `/uplift?loc=${encodeURIComponent(s.loc)}&from=${encodeURIComponent(s.from)}&to=${encodeURIComponent(s.to)}&run=1`;

export const recordLink = (loc, at) => `/uplift/record?loc=${encodeURIComponent(loc)}&at=${encodeURIComponent(at)}`;

export const UPLIFT_STORIES = [
  {
    title: '0. Check the camera on my notice (end user)',
    who: 'Person who received a red-light notice, no login',
    context: 'The notice carries a link with the camera’s location code and the offence time.',
    pain: 'A list of every certificate for the camera is hard to read; they only care about their moment.',
    job: 'When I open the link on my notice, I want to see only the certificate in force at my offence time, so I can trust the camera was certified.',
    links: [['Open the record for an offence on 14/03/2026 08:30', recordLink('1234', '14/03/2026 08:30')], ['Open a link for an unknown location', recordLink('0000', '14/03/2026 08:30')]],
  },
  {
    title: '1. Confirm a camera was certified on the day',
    who: 'Customer enquiry officer, Transport',
    context: 'A customer calls about a red-light notice and asks whether the camera was certified when the photo was taken.',
    pain: 'The legacy page works but looks dated and gives no help when a field is wrong.',
    job: 'When a customer asks about a camera, I want to list its certificates around the offence date, so I can answer on the call.',
    links: [['Search a month around the offence', upliftLink(UPLIFT_SAMPLES[1])], ['Widen to a year and sort by expiry', upliftLink(UPLIFT_SAMPLES[0])], ['Press View on a row to open the same record a customer sees', upliftLink(UPLIFT_SAMPLES[1])]],
  },
  {
    title: '2. Wrong or unknown location code',
    who: 'Revenue NSW review officer',
    context: 'The officer types a location code from a note that turns out to be wrong.',
    pain: 'An empty grid that looks like a fault.',
    job: 'When nothing matches, I want a clear “No records found.”, so I know to check the code rather than report a fault.',
    links: [['Search an unknown location', upliftLink(UPLIFT_SAMPLES[2])]],
  },
  {
    title: '3. Missing or badly formatted fields',
    who: 'Any staff user',
    context: 'The officer presses SEARCH before filling the dates, or types a date the wrong way round.',
    pain: 'The legacy page gives little guidance on what is wrong.',
    job: 'When I make a mistake, I want each problem listed with a link to the field, so I can fix it quickly.',
    links: [['Open an empty search, then press SEARCH', '/uplift']],
  },
];

// User stories for phase 1 with acceptance criteria. A story with no acceptance criteria, or with an open
// question that blocks it, is not ready for dev.
export const UPLIFT_USER_STORIES = [
  {
    id: 'US1', title: 'Search certificates by location and date range',
    story: 'As a staff user, I want to search certificates by location code and a date/time range, so I can see which certificates applied in that period.',
    source: SHOTS,
    ac: [
      'Given the page opens, Location code and Date/Time from are empty and Date/Time to holds the current date and time (DD/MM/YYYY HH:MM).',
      'Given all three fields are valid, when I press SEARCH, “Search results” lists every certificate in force at any time in the range.',
      'Each row shows Certificate Description, Certificate type, Period (YEARLY or QUARTERLY), Certified date and Expiry date, as today.',
      'Given nothing matches, the table shows “No records found.”.',
    ],
    blockers: [],
  },
  {
    id: 'US2', title: 'Tell me what is wrong before searching',
    story: 'As a staff user, I want missing or badly formatted fields called out, so I can correct them without guessing.',
    source: SHOTS + '; ' + OWNER,
    ac: [
      'Given a mandatory field is empty or not DD/MM/YYYY HH:MM, when I press SEARCH, no search runs and an error summary lists each problem.',
      'Each item in the summary moves focus to its field, and the field shows the same message.',
      'Given Date/Time to is before Date/Time from, the summary says so.',
    ],
    blockers: ['U12'],
  },
  {
    id: 'US3', title: 'Sort the results',
    story: 'As a staff user, I want to sort results by type, period, certified date or expiry date, so I can find the certificate I need.',
    source: SHOTS,
    ac: [
      'Clicking Certificate type, Period, Certified date or Expiry date sorts ascending; clicking again sorts descending.',
      'Dates sort as dates, not text. The sorted column is announced to screen readers.',
    ],
    blockers: [],
  },
  {
    id: 'US4', title: 'Clear and close',
    story: 'As a staff user, I want to clear the form or leave the search, as on the legacy page.',
    source: SHOTS,
    ac: [
      'CLEAR empties Location code and Date/Time from, resets Date/Time to to now and removes the results.',
      'Before a search CLOSE sits beside SEARCH and CLEAR; after a search it sits below the results.',
    ],
    blockers: ['U9'],
  },
  {
    id: 'US5', title: 'New look, no new functions',
    story: 'As the business, I want the page restyled to the NSW Design System without adding functions, so phase 1 is a low-risk lift and shift.',
    source: OWNER,
    ac: [
      'No download, save, print or PDF function. The only control on a result row is View, which opens the record view (US9).',
      'Meets WCAG 2.2 AA: labels, focus order, contrast, keyboard use for every control including the calendar and sorting.',
      'Works at phone width without sideways page scrolling (the results table may scroll inside its box).',
    ],
    blockers: ['U11'],
  },
  {
    id: 'US8', title: 'See only the certificate for my offence (end user)',
    story: 'As a person with a notice, I want the link on my notice to show only the certificate(s) in force at my offence time, without logging in.',
    source: OWNER + '; ' + BRD + ' BR_01',
    ac: [
      'Given a link with location code and offence date and time, the page shows only certificates whose certified date is on or before, and expiry date on or after, that time.',
      'No login is asked for. No other certificate for the location is listed.',
      'Given none applies, the page says “No records found.”.',
      'No download, save or print function.',
    ],
    blockers: ['U5', 'U3', 'U15'],
  },
  {
    id: 'US9', title: 'Open one record from the list (Revenue)',
    story: 'As a Revenue NSW user, I want to open any row from the search results and see the same record view a customer sees, without logging in.',
    source: OWNER + '; ' + BRD + ' BR_10',
    ac: [
      'Each result row has a View control that opens that certificate’s record view.',
      'The record view shows the same fields as the end-user view, and a way back to the results.',
    ],
    blockers: ['U3'],
  },
  {
    id: 'US6', title: 'Show only approved or published certificates',
    story: 'As the business, I want only certificates whose status is approved or published to appear, so nothing unvalidated is shown.',
    source: OWNER + ' (replaces BRD BR_04 and BR_07)',
    ac: [],
    blockers: ['U2', 'U3'],
  },
  {
    id: 'US7', title: 'Other government sites can fetch certificates',
    story: 'As Service NSW or Revenue NSW, I can fetch a site’s certificates by location code and date range from an API, so our own pages show the same answer without scraping CEVOC.',
    source: OWNER,
    ac: [
      'A REST GET with location code, from and to as query parameters returns the same rows as the page, as JSON.',
      'The contract is versioned and documented (OpenAPI), and does not depend on any one website.',
    ],
    blockers: ['U3', 'U7'],
  },
];

export const UPLIFT_REGISTER = [
  { id: 'U1', topic: 'No PDF or new functions in phase 1', q: 'Does the uplift add a certificate download?', now: 'No. The legacy page offers none, and lift and shift adds no new functions.', source: OWNER + '; ' + BRD + ' BR_03', owner: 'Product owner', status: 'Confirmed requirement', action: 'None.', impact: 'No download, save or print anywhere.' },
  { id: 'U2', topic: 'When a certificate appears', q: 'Is availability a delay in days, or the certificate’s status?', now: 'Status: only approved or published certificates appear. No delay in days. This settles the BRD conflict between BR_04 (5 to 6 business days) and BR_07 (immediate).', source: OWNER, owner: 'Product owner', status: 'Confirmed requirement', action: 'Confirm the exact status values in the source system.', impact: 'Filter on status in the API, not on dates.' },
  { id: 'U3', topic: 'Sample certificate data from CMCS', q: 'Which certificate fields exist today, and in which form?', now: 'The legacy grid shows five columns. The BRD (BR_01) asks for device model, Gazette reference, approval scope, street location, camera code, inspection date and time, and an inspection narrative. None are on the legacy grid.', source: SHOTS + '; ' + BRD + ' BR_01', owner: 'CMCS data owner', status: 'Assumption to validate', action: 'Request anonymised sample certificates from CMCS (the source of truth) showing every field, its status values and where it is stored.', impact: 'Decides whether the API must change. Stories that need these fields stay not ready for dev.' },
  { id: 'U4', topic: 'Duplicate rows', q: 'Are identical rows in the legacy grid re-issued certificates?', now: 'The legacy grid shows some rows with the same type, period, certified and expiry dates, and nothing tells them apart.', source: SHOTS + '; ' + BRD + ' BR_09', owner: 'CMCS data owner', status: 'Assumption to validate', action: 'Check against the CMCS samples.', impact: 'A re-issued marker (BR_09) needs a re-issue flag in the data.' },
  { id: 'U5', topic: 'Which certificate is relevant to an offence', q: 'For one offence, which certificate applies?', now: 'Assumed: each certificate in force at the offence date and time (certified ≤ offence ≤ expiry). Yearly and quarterly may both apply.', source: BRD + ' BR_01', owner: 'Transport, Legal', status: 'Assumption to validate', action: 'Confirm the rule, including re-issued certificates.', impact: 'Public single-record view (later phase).' },
  { id: 'U6', topic: 'One detail view, two ways in', q: 'Do the public view and the staff list show the same certificate detail?', now: 'Proposed: the public sees the one record for their offence; staff see a list, and each row opens the same detail.', source: BRD + ' BR_01, BR_10; owner review', owner: 'Product owner', status: 'Proposed UX improvement', action: 'Test with staff and customers.', impact: 'One detail component and one API.' },
  { id: 'U7', topic: 'API for other government sites', q: 'How do Service NSW and Revenue NSW get certificate data?', now: 'Through a versioned REST API using GET with query parameters, never by scraping the website.', source: OWNER, owner: 'Enterprise architecture', status: 'Confirmed requirement', action: 'Agree authentication between agencies and the response fields once U3 is answered.', impact: 'API contract.' },
  { id: 'U8', topic: 'Legal disclaimer', q: 'What disclaimer must the page show?', now: 'The BRD asks for one, wording yet to be discussed with Legal.', source: BRD + ' BR_05', owner: 'Legal', status: 'Assumption to validate', action: 'Legal to supply the wording.', impact: 'Text on the page.' },
  { id: 'U9', topic: 'Where CLOSE goes', q: 'What does CLOSE return to on the legacy page?', now: 'Unknown. The mock-up starts a new search.', source: SHOTS, owner: 'Product owner', status: 'Assumption to validate', action: 'Check on the legacy page.', impact: 'Navigation.' },
  { id: 'U10', topic: 'Default dates', q: 'What do the date fields hold when the page opens?', now: 'Date/Time from is empty; Date/Time to holds the current date and time.', source: SHOTS, owner: 'Product owner', status: 'Confirmed requirement', action: 'None.', impact: 'Form defaults.' },
  { id: 'U11', topic: 'Contact us and Help', q: 'Where do Contact us and Help go?', now: 'Shown on the legacy page; destinations not known.', source: SHOTS, owner: 'Product owner', status: 'Assumption to validate', action: 'Capture the current destinations.', impact: 'Header links.' },
  { id: 'U12', topic: 'Location code format', q: 'What is a valid location code?', now: 'Assumed digits only. The mock-up rejects anything else.', source: 'Prototype behaviour', owner: 'CMCS data owner', status: 'Assumption to validate', action: 'Confirm the format and length.', impact: 'Validation message.' },
  { id: 'U14', topic: 'Login', q: 'Do the end-user and Revenue views need a login?', now: 'No. The information is no more sensitive in one view than the other. The difference is scope: one record for the offence, or the list for a location.', source: OWNER, owner: 'Product owner', status: 'Confirmed requirement', action: 'None for the prototype; confirm with Cyber before build.', impact: 'No sign-in on either view.' },
  { id: 'U15', topic: 'Link from the Service NSW app and myPenalty', q: 'How do the Service NSW app and myPenalty link a person to the certificate record?', now: 'The person finds the notice and sees what happened in either app. Assumed: the app links to the certificate record carrying the location code and the offence date and time, then the person returns to the app to pay, request a review or elect court.', source: OWNER, owner: 'Service NSW, Revenue NSW', status: 'Assumption to validate', action: 'Agree the link and what it carries with both app owners.', impact: 'Entry point for the end-user record view (US8).' },
  { id: 'U13', topic: 'Help text for customers', q: 'What explanatory text helps people read a certificate?', now: 'The BRD asks for it (BR_06) and for directing court matters to customer enquiries (BR_08). Not part of the staff lift and shift.', source: BRD + ' BR_06, BR_08', owner: 'Transport', status: 'Out of scope', action: 'Revisit for the public phase.', impact: 'None in phase 1.' },
];

// Legacy versus target, screen by screen.
export const UPLIFT_COMPARE = [
  ['Header', 'Green banner, title, NSW logo; grey bar with Contact us, Help and today’s date.', 'NSW Design System masthead and header with the same title; light bar with Contact us, Help and today’s date.', 'Same content, new look'],
  ['Instructions', '“Please enter the search parameters”, “* indicates mandatory fields.”', 'Same words, larger type.', 'Same'],
  ['Location code', 'Small text box.', 'Full-size field with label, required marker and error message.', 'Same function, clearer'],
  ['Date/Time from and to', 'Text boxes with calendar icons; To defaults to now.', 'Same defaults; format hint DD/MM/YYYY HH:MM; keyboard-reachable calendar button.', 'Same function, clearer'],
  ['Buttons', 'SEARCH, CLEAR, CLOSE as small coloured images.', 'Full-size buttons with the same labels; CLOSE moves below the results after a search, as today.', 'Same'],
  ['Errors', 'Little guidance.', 'Error summary listing each problem, linked to its field.', 'Improved'],
  ['Results', '“Search results” grid, five columns, last four sortable.', 'Same five columns and sorting, readable table, scrolls inside its box on a phone.', 'Same function, new look'],
  ['Downloads', 'None.', 'None (U1).', 'Same'],
];
