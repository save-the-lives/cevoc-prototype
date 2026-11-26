// TOUR OVERLAY content (owner, 25 Nov 2026): nothing prototype-specific sits in the real UI. Everything a reviewer
// needs (legacy versus new names, stories, open questions, dynamic versus static content, copy variants) lives in
// one overlay, off by default, pinned to the element it is about via data-tour="key".

// Pinned notes per screen. legacy/next: the label before and after. stories/qs: ids. kind: what the element is.
export const NOTES = {
  search: [
    { key: 'title', title: 'Page heading and instructions', legacy: '“Search” · “Please enter the search parameters” · “* indicates mandatory fields.”', next: '“Find camera certificates” · “Search by camera location and a date range.” · “All fields are required.”', stories: ['S5', 'S19'], qs: ['U28'] },
    { key: 'loc', title: 'Locations', legacy: 'Location code: one code, typed exactly', next: 'Camera locations: any number, by code or any part of the address, as removable chips that wrap, with “+N more” and Clear all; results grouped by location', stories: ['S1'], qs: ['U25'] },
    { key: 'dates', title: 'Date range', legacy: 'Date/Time from and Date/Time to, date and time, To defaults to now', next: 'Presets (Last 7 days to Last 12 months, default Last 6 months) set From, To is today (Sydney time); From and To as days, typeable; editing switches to Custom. The range calendar is a nice-to-have.', stories: ['S2', 'S17'], qs: ['U27', 'U10', 'U26'] },
    { key: 'actions', title: 'Buttons', legacy: 'SEARCH · CLEAR · CLOSE (small image buttons)', next: 'Search · Clear · Close, full size, one baseline', stories: ['S18'], qs: ['U9'] },
    { key: 'results', title: 'Results', legacy: '“Search results”: Certificate Description, Certificate type, Period, Certified date, Expiry date', next: '“Certificates”: adds Location; rows expand in place to show details; withdrawn and re-issued are tagged', stories: ['S3', 'S4', 'S9', 'S10', 'S15'], qs: ['U2', 'U3', 'U4', 'U22'] },
    { key: 'outcomes', title: 'When there is nothing to list', legacy: '“No records found.” in an empty table row, for every case', next: 'Three different messages: no match (NSW empty state), a genuinely missing certificate (warning), a system fault (error)', stories: ['S6', 'S7', 'S8'], qs: ['U23', 'U24', 'U16'] },
    { key: 'support', title: 'Contact us and Help', legacy: 'Same links in the grey bar', next: 'Same links, new look', stories: ['S19'], qs: ['U11'] },
  ],
  record: [
    { key: 'title', title: 'How people get here', legacy: 'Reached from “View camera certification” on the Revenue NSW fines site, or from myPenalty: the same signed link', next: 'Same link, same page, new look. No login.', stories: ['S11', 'S14'], qs: ['U15', 'U29', 'U30', 'U31', 'U14'] },
    { key: 'offence', title: 'Offence Details', legacy: 'Penalty notice number, Program type, Site, zone or camera number, Site location, Date of offence, Time of offence', next: 'Same fields, same order, plus one new field: Offence type (for example red light offence, speed offence, average speed offence), after Program type. All dynamic. Where offence type comes from is open (U39). No other new fields in phase 1.', stories: ['S11', 'S24'], qs: ['U39', 'U3'] },
    { key: 'cert', title: 'Camera certificate details for this offence', legacy: '“The approved traffic enforcement device used at the location above was tested on [date] and its image capture performance certified.” One certificate, one date.', next: 'One lead-in, then one line per certificate type in force on the offence day, each with its certified and expiry dates (for example average speed: image capture and speed measurement). One template reads right for one type or several, in every copy variant (legacy, A, B, C). A type with none in force gets the missing-certificate warning. The types per program are an app setting, illustrative until the real list arrives (U16, pending).', stories: ['S11', 'S12', 'S23'], qs: ['U5', 'U26', 'U34', 'U16'] },
    { key: 'states', title: 'Missing, withdrawn or fault', legacy: 'Not shown on the legacy page', next: 'A genuinely missing certificate (named by type, while the other types in force are still listed), a withdrawn one and a system fault each get their own message', stories: ['S12', 'S13', 'S23'], qs: ['U22', 'U23', 'U24'] },
    { key: 'requirements', title: 'Enforcement cameras and certification requirements', legacy: 'Explanatory text: four camera categories, how often each is certified, the Road Transport Act 2013, 13 22 13', next: 'Same content by default (static copy); variants to test. Partly covers the BRD’s help text (BR_06).', stories: ['S19', 'S20'], qs: ['U13', 'U34', 'U8', 'U35'] },
    { key: 'disclaimer', title: 'Legal disclaimer (proposed)', legacy: 'None on the legacy page', next: 'Proposed GIPA notice with a link to Transport’s access application page; from the template; Legal to confirm', stories: ['S20'], qs: ['U8'] },
    { key: 'close', title: 'Close / return', legacy: 'CLOSE button', next: 'Proposed: “Return to <source>” from the signed link’s source (app setting record.returnLinks); otherwise “You can close this tab”', stories: ['S22', 'S18'], qs: ['U9'] },
  ],
};

// Dynamic data on the end-user page, with where it comes from, who owns it (owner, 25 Nov 2026) and how it
// lines up with the BRD. status 'On page': on the legacy page today. 'New': asked for by the BRD, not on the page,
// owner unknown until CMCS samples arrive (U3). page: where it shows (Record, Search, Both). Shown in the Page content
// tab and outlined by the tour's Highlight dynamic data; every <Dyn> on those pages maps to a row here (audit 26 Nov 2026).
export const DYNAMIC = [
  { field: 'Penalty notice number', source: 'Signed link: p', owner: 'Revenue NSW / Transport', brd: '—', status: 'On page', page: 'Record' },
  { field: 'Program type', source: 'CMCS site record for the site in s', owner: 'Transport', brd: 'BR_01 (device type)', status: 'On page', page: 'Record' },
  { field: 'Site, zone or camera number', source: 'Signed link: s', owner: 'Transport', brd: 'BR_01 (camera code)', status: 'On page', page: 'Record' },
  { field: 'Site location', source: 'CMCS site record for s', owner: 'Transport', brd: 'BR_01 (location)', status: 'On page', page: 'Record' },
  { field: 'Date of offence', source: 'Signed link: d (date part)', owner: 'Transport / Revenue NSW', brd: '—', status: 'On page', page: 'Record' },
  { field: 'Time of offence', source: 'Signed link: d (time part)', owner: 'Transport', brd: '—', status: 'On page', page: 'Record' },
  { field: 'Offence type', source: 'Unknown: CMCS, the offence code on the notice or the notice system (U39); the prototype reads the invented offence record behind the signed link', owner: 'Unknown', brd: '— (owner request)', status: 'New', page: 'Record' },
  { field: 'Certification date (“tested on”)', source: 'Certificate in force at d for site s', owner: 'CMCS / CES (FAES)', brd: 'BR_01 (inspection date; the BRD also wants the time)', status: 'On page', page: 'Record' },
  { field: 'Certificate type, certified and expiry dates: one line per type in force', source: 'CMCS certificate records in force at d for site s; type names from app setting certificate.typesPerProgram (illustrative until U16)', owner: 'CMCS / CES (FAES); Transport (type list)', brd: 'BR_01', status: 'New', page: 'Record' },
  { field: 'Inspection time', source: 'Unknown', owner: 'Unknown', brd: 'BR_01', status: 'New', page: 'Record' },
  { field: 'Device model', source: 'Unknown', owner: 'Unknown', brd: 'BR_01', status: 'New', page: 'Record' },
  { field: 'Gazette reference', source: 'Unknown', owner: 'Unknown', brd: 'BR_01', status: 'New', page: 'Record' },
  { field: 'Device approval scope (what it is approved for)', source: 'Unknown', owner: 'Unknown', brd: 'BR_01', status: 'New', page: 'Record' },
  { field: 'Inspection details (narrative)', source: 'Unknown', owner: 'Unknown', brd: 'BR_01', status: 'New', page: 'Record' },
  { field: 'Inspecting officer’s name and signature (masked)', source: 'Unknown', owner: 'Unknown', brd: 'BR_02', status: 'New', page: 'Record' },
  { field: 'Re-issued marker', source: 'Unknown', owner: 'Unknown', brd: 'BR_09', status: 'New', page: 'Record' },
  { field: 'Offence date inside the certificate sentence (variant A)', source: 'Signed link: d', owner: 'Transport / Revenue NSW', brd: '—', status: 'New', page: 'Record' },
  { field: 'Certificate period and status tag (Current, Expired, Withdrawn, Re-issued, Not yet in force)', source: 'CMCS certificate record; status worked out against today', owner: 'CMCS / CES (FAES)', brd: 'BR_09 (re-issued)', status: 'New', page: 'Both' },
  { field: 'Missing certificate: type and day', source: 'CMCS: no certificate of that type (app setting certificate.typesPerProgram) in force on d', owner: 'CMCS / CES (FAES)', brd: '—', status: 'New', page: 'Both' },
  { field: 'Withdrawn certificate: type, certified and withdrawn dates', source: 'CMCS certificate record', owner: 'CMCS / CES (FAES)', brd: 'BR_09', status: 'New', page: 'Both' },
  { field: 'Return link (“Return to <source>”)', source: 'Signed link: r, looked up in app setting record.returnLinks', owner: 'Product owner', brd: '—', status: 'New', page: 'Record' },
  { field: 'Today’s date in the grey bar', source: 'Server clock, Sydney time', owner: '—', brd: '—', status: 'On page', page: 'Both' },
  { field: 'Results: location, description, type, period, certified and expiry dates', source: 'CMCS certificate and site records', owner: 'CMCS / CES (FAES)', brd: 'BR_01', status: 'On page', page: 'Search' },
  { field: 'Results: location group heading, counts, “searched” summary', source: 'CMCS site record; the search entered', owner: 'Transport', brd: '—', status: 'New', page: 'Search' },
  { field: 'Row details: location, certificate type, status, re-issue of', source: 'CMCS certificate and site records', owner: 'CMCS / CES (FAES)', brd: 'BR_09', status: 'New', page: 'Search' },
  { field: 'Gaps: location, certificate type, from and to', source: 'CMCS: days with no certificate of that type in force', owner: 'CMCS / CES (FAES)', brd: '—', status: 'New', page: 'Search' },
  { field: 'Duplicate data error tag', source: 'CMCS: identical certificate rows', owner: 'CMCS / CES (FAES)', brd: '—', status: 'New', page: 'Search' },
];
// Static copy: held in a configurable template so wording can change without changing the application (owner,
// 25 Nov 2026; story S20). 'BRD' rows are static text the BRD asks for that the legacy page does not have.
export const STATIC = [
  { block: 'Section headings', what: 'Offence Details; Camera certificate details for this offence; Enforcement cameras and certification requirements', brd: '—', status: 'On page' },
  { block: 'Certificate lead-in and lines', what: 'The lead-in, in a singular and a plural form, and the one line pattern repeated for each certificate type in force (for example “On the day of your offence, these certificates were in force:” then “Image capture: certified … , expires …”)', brd: '—', status: 'On page' },
  { block: 'Camera categories', what: 'Fixed cameras enforcing speed, or speed and red lights; fixed cameras for other offences; mobile cameras enforcing speed; mobile cameras for other offences', brd: 'BR_06 (partly)', status: 'On page' },
  { block: 'Certification frequency', what: 'Speed measuring devices at least every 12 months; fixed image capture at least every 90 days; mobile cameras before each deployment', brd: 'BR_06 (partly)', status: 'On page' },
  { block: 'Legal basis', what: 'Road Transport Act 2013', brd: '—', status: 'On page' },
  { block: 'Contact', what: 'Transport for NSW customer service centre, 13 22 13', brd: '—', status: 'On page' },
  { block: 'Disclaimer (proposed, U8)', what: 'This page is not a legal document… make an access application under the GIPA Act to Transport for NSW (linked). A fee may apply. Legal to confirm.', brd: 'BR_05', status: 'New' },
  { block: 'Help reading a certificate', what: 'Plain-English explanation of the certificate’s parts', brd: 'BR_06', status: 'New' },
  { block: 'Court matters', what: 'Directs people with a court matter to customer enquiries', brd: 'BR_08', status: 'New' },
  { block: 'No download, save or print', what: 'No such function offered (not text, a rule)', brd: 'BR_03', status: 'On page' },
];

// Copy variants for the end-user page. Each answers one worry; the tour shows which and why.
export const COPY = {
  legacy: {
    label: 'Legacy (as today)', worry: 'Lift and shift: the wording the page uses today, in the new look.',
    // The sentence the legacy page has (one certificate) is now a lead-in plus one line per certificate type in force.
    // Templates take {type}, {certified}, {expiry} and {offenceDate}; the lead-in has a singular and a plural form.
    cert: {
      lead: { one: 'On the day of your offence, this certificate was in force:', many: 'On the day of your offence, these certificates were in force:' },
      line: '{type}: certified {certified}, expires {expiry}', tail: null,
    },
    req: [
      'Enforcement cameras fall into four groups: fixed cameras enforcing speed, or speed and red lights; fixed cameras enforcing other offences; mobile cameras enforcing speed; and mobile cameras enforcing other offences.',
      'Speed measuring devices are tested and certified at least every 12 months. The image capture performance of fixed cameras is tested and certified at least every 90 days. Mobile cameras are tested and certified before each deployment.',
      'Certification is carried out under the Road Transport Act 2013.',
      'For more information, call the Transport for NSW customer service centre on 13 22 13.',
    ],
  },
  A: {
    label: 'A: Was the camera working?', worry: 'Biggest worry: “Was the camera working properly when I was caught?” Leads with reassurance and the date.',
    cert: {
      lead: { one: 'On the day of your offence ({offenceDate}), this certificate was in force. It means the camera was tested and passed:', many: 'On the day of your offence ({offenceDate}), these certificates were in force. Each one means the camera was tested and passed:' },
      line: '{type}: tested on {certified}, valid until {expiry}', tail: null,
    },
    req: [
      'Every enforcement camera must be tested and certified regularly by law (Road Transport Act 2013).',
      'Fixed cameras: photos checked at least every 90 days, speed measurement at least every 12 months. Mobile cameras: checked before every deployment.',
      'Questions? Call Transport for NSW on 13 22 13.',
    ],
  },
  B: {
    label: 'B: What does this mean for me?', worry: 'Biggest worry: “What does all this mean for me?” The shortest, plainest version.',
    cert: {
      lead: { one: 'The camera had this certificate on the day of your offence:', many: 'The camera had these certificates on the day of your offence:' },
      line: '{type}: {certified} to {expiry}', tail: null,
    },
    req: [
      'By law, cameras are checked regularly: at least every 90 days for photos, every 12 months for speed, and before every use for mobile cameras.',
    ],
  },
  C: {
    label: 'C: Can I question it?', worry: 'Biggest worry: “Can I question this, and what do I do next?” Ends with the options.',
    cert: {
      lead: { one: 'On the day of your offence, this certificate was in force:', many: 'On the day of your offence, these certificates were in force:' },
      line: '{type}: certified {certified}, expires {expiry}', tail: 'If you still think something is wrong, you can ask for a review.',
    },
    req: [
      'Cameras are tested and certified regularly under the Road Transport Act 2013: photos at least every 90 days, speed at least every 12 months, mobile cameras before each use.',
      'What you can do next, through Revenue NSW (the Service NSW app or myPenalty): pay the fine, request a review, or elect to have the matter decided by a court.',
      'Questions about the camera or this certificate: call Transport for NSW on 13 22 13.',
    ],
  },
};
export const COPY_KEYS = ['legacy', 'A', 'B', 'C'];

// Section 3 of the record page, from a variant's template: the lead-in (singular for one certificate, plural for
// several), one line per certificate type, an optional tail. `n` is how many certificate types are in force.
export const certLead = (C, n, hasDate = true) => {
  const t = n === 1 ? C.cert.lead.one : C.cert.lead.many;
  return hasDate ? t : t.replace(' ({offenceDate})', '');
};
// Fills {placeholders} in a template string; `wrap(name, value, key)` renders each value (the page marks them as
// dynamic data), anything unknown stays as written.
export const fillTemplate = (tpl, vals, wrap) => String(tpl).split(/(\{\w+\})/).map((part, i) => {
  const m = /^\{(\w+)\}$/.exec(part);
  return m && vals[m[1]] !== undefined ? wrap(m[1], vals[m[1]], i) : part;
});

// Proposed legal disclaimer (U8, owner 25 Nov 2026): same in every variant, part of the configurable template (S20).
// Confirmation required from Legal. The fee amount is deliberately not shown.
export const GIPA_URL = 'https://www.transport.nsw.gov.au/about-us/access-to-information/access-application';
export const DISCLAIMER = {
  before: 'This page is not a legal document. If you need the certificate for legal purposes, you can make an ',
  link: 'access application',
  after: ' under the GIPA Act to Transport for NSW. A fee may apply as part of the GIPA process.',
};
