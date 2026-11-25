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
    { key: 'offence', title: 'Offence Details', legacy: 'Penalty notice number, Program type, Site, zone or camera number, Site location, Date of offence, Time of offence', next: 'Same fields, same order. All dynamic, from the signed link and the CMCS site record.', stories: ['S11'], qs: ['U3'] },
    { key: 'cert', title: 'Camera certificate details for this offence', legacy: '“The approved traffic enforcement device used at the location above was tested on [date] and its image capture performance certified.”', next: 'Same sentence by default; copy variants A, B and C to test. The date is dynamic.', stories: ['S11', 'S12'], qs: ['U5', 'U26', 'U34'] },
    { key: 'states', title: 'Missing, withdrawn or fault', legacy: 'Not shown on the legacy page', next: 'A genuinely missing certificate, a withdrawn one and a system fault each get their own message', stories: ['S12', 'S13'], qs: ['U22', 'U23', 'U24'] },
    { key: 'requirements', title: 'Enforcement cameras and certification requirements', legacy: 'Explanatory text: four camera categories, how often each is certified, the Road Transport Act 2013, 13 22 13', next: 'Same content by default (static copy); variants to test. Partly covers the BRD’s help text (BR_06).', stories: ['S19', 'S20'], qs: ['U13', 'U34', 'U8', 'U35'] },
    { key: 'disclaimer', title: 'Legal disclaimer (proposed)', legacy: 'None on the legacy page', next: 'Proposed GIPA notice with a link to Transport’s access application page; from the template; Legal to confirm', stories: ['S20'], qs: ['U8'] },
    { key: 'close', title: 'Close / return', legacy: 'CLOSE button', next: 'Proposed: “Return to <source>” from the signed link’s source (app setting record.returnLinks); otherwise “You can close this tab”', stories: ['S22', 'S18'], qs: ['U9'] },
  ],
};

// Dynamic data on the end-user page, with where it comes from, who owns it (owner, 25 Nov 2026) and how it
// lines up with the BRD. status 'On page': on the legacy page today. 'New': asked for by the BRD, not on the page,
// owner unknown until CMCS samples arrive (U3). Shown in the Page content tab and outlined by the tour.
export const DYNAMIC = [
  { field: 'Penalty notice number', source: 'Signed link: p', owner: 'Revenue NSW / Transport', brd: '—', status: 'On page' },
  { field: 'Program type', source: 'CMCS site record for the site in s', owner: 'Transport', brd: 'BR_01 (device type)', status: 'On page' },
  { field: 'Site, zone or camera number', source: 'Signed link: s', owner: 'Transport', brd: 'BR_01 (camera code)', status: 'On page' },
  { field: 'Site location', source: 'CMCS site record for s', owner: 'Transport', brd: 'BR_01 (location)', status: 'On page' },
  { field: 'Date of offence', source: 'Signed link: d (date part)', owner: 'Transport / Revenue NSW', brd: '—', status: 'On page' },
  { field: 'Time of offence', source: 'Signed link: d (time part)', owner: 'Transport', brd: '—', status: 'On page' },
  { field: 'Certification date (“tested on”)', source: 'Certificate in force at d for site s', owner: 'CMCS / CES (FAES)', brd: 'BR_01 (inspection date; the BRD also wants the time)', status: 'On page' },
  { field: 'Inspection time', source: 'Unknown', owner: 'Unknown', brd: 'BR_01', status: 'New' },
  { field: 'Device model', source: 'Unknown', owner: 'Unknown', brd: 'BR_01', status: 'New' },
  { field: 'Gazette reference', source: 'Unknown', owner: 'Unknown', brd: 'BR_01', status: 'New' },
  { field: 'Device approval scope (what it is approved for)', source: 'Unknown', owner: 'Unknown', brd: 'BR_01', status: 'New' },
  { field: 'Inspection details (narrative)', source: 'Unknown', owner: 'Unknown', brd: 'BR_01', status: 'New' },
  { field: 'Inspecting officer’s name and signature (masked)', source: 'Unknown', owner: 'Unknown', brd: 'BR_02', status: 'New' },
  { field: 'Re-issued marker', source: 'Unknown', owner: 'Unknown', brd: 'BR_09', status: 'New' },
];
// Static copy: held in a configurable template so wording can change without changing the application (owner,
// 25 Nov 2026; story S20). 'BRD' rows are static text the BRD asks for that the legacy page does not have.
export const STATIC = [
  { block: 'Section headings', what: 'Offence Details; Camera certificate details for this offence; Enforcement cameras and certification requirements', brd: '—', status: 'On page' },
  { block: 'Certificate sentence', what: 'The fixed words around the certification date', brd: '—', status: 'On page' },
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
    cert: (t) => `The approved traffic enforcement device used at the location above was tested on ${t} and its image capture performance certified.`,
    req: [
      'Enforcement cameras fall into four groups: fixed cameras enforcing speed, or speed and red lights; fixed cameras enforcing other offences; mobile cameras enforcing speed; and mobile cameras enforcing other offences.',
      'Speed measuring devices are tested and certified at least every 12 months. The image capture performance of fixed cameras is tested and certified at least every 90 days. Mobile cameras are tested and certified before each deployment.',
      'Certification is carried out under the Road Transport Act 2013.',
      'For more information, call the Transport for NSW customer service centre on 13 22 13.',
    ],
  },
  A: {
    label: 'A: Was the camera working?', worry: 'Biggest worry: “Was the camera working properly when I was caught?” Leads with reassurance and the date.',
    cert: (t, o) => `This camera was tested on ${t} and passed. Its photos were certified as accurate${o ? ` before your offence on ${o}` : ''}.`,
    req: [
      'Every enforcement camera must be tested and certified regularly by law (Road Transport Act 2013).',
      'Fixed cameras: photos checked at least every 90 days, speed measurement at least every 12 months. Mobile cameras: checked before every deployment.',
      'Questions? Call Transport for NSW on 13 22 13.',
    ],
  },
  B: {
    label: 'B: What does this mean for me?', worry: 'Biggest worry: “What does all this mean for me?” The shortest, plainest version.',
    cert: (t) => `Checked and certified on ${t}. The photo of your vehicle came from a certified camera.`,
    req: [
      'By law, cameras are checked regularly: at least every 90 days for photos, every 12 months for speed, and before every use for mobile cameras.',
    ],
  },
  C: {
    label: 'C: Can I question it?', worry: 'Biggest worry: “Can I question this, and what do I do next?” Ends with the options.',
    cert: (t) => `The camera was tested on ${t} and its photos were certified. If you still think something is wrong, you can ask for a review.`,
    req: [
      'Cameras are tested and certified regularly under the Road Transport Act 2013: photos at least every 90 days, speed at least every 12 months, mobile cameras before each use.',
      'What you can do next, through Revenue NSW (the Service NSW app or myPenalty): pay the fine, request a review, or elect to have the matter decided by a court.',
      'Questions about the camera or this certificate: call Transport for NSW on 13 22 13.',
    ],
  },
};
export const COPY_KEYS = ['legacy', 'A', 'B', 'C'];

// Proposed legal disclaimer (U8, owner 25 Nov 2026): same in every variant, part of the configurable template (S20).
// Confirmation required from Legal. The fee amount is deliberately not shown.
export const GIPA_URL = 'https://www.transport.nsw.gov.au/about-us/access-to-information/access-application';
export const DISCLAIMER = {
  before: 'This page is not a legal document. If you need the certificate for legal purposes, you can make an ',
  link: 'access application',
  after: ' under the GIPA Act to Transport for NSW. A fee may apply as part of the GIPA process.',
};
