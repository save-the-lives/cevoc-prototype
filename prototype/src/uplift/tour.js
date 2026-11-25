// TOUR OVERLAY content (owner, 25 Nov 2026): nothing prototype-specific sits in the real UI. Everything a reviewer
// needs (legacy versus new names, stories, open questions, dynamic versus static content, copy variants) lives in
// one overlay, off by default, pinned to the element it is about via data-tour="key".

// Pinned notes per screen. legacy/next: the label before and after. stories/qs: ids. kind: what the element is.
export const NOTES = {
  search: [
    { key: 'title', title: 'Page heading and instructions', legacy: '“Search” · “Please enter the search parameters” · “* indicates mandatory fields.”', next: '“Find camera certificates” · “Search by camera location and a date range.” · “All fields are required.”', stories: ['S5', 'S19'], qs: ['U28'] },
    { key: 'loc', title: 'Locations', legacy: 'Location code: one code, typed exactly', next: 'Camera locations: several, by code or any part of the address, as removable chips', stories: ['S1'], qs: ['U25'] },
    { key: 'dates', title: 'Date range', legacy: 'Date/Time from and Date/Time to, date and time, To defaults to now', next: 'From and To as days only, empty by default, one calendar picks both (airline style), still typeable', stories: ['S2', 'S17'], qs: ['U26', 'U27', 'U10'] },
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
    { key: 'requirements', title: 'Enforcement cameras and certification requirements', legacy: 'Explanatory text: four camera categories, how often each is certified, the Road Transport Act 2013, 13 22 13', next: 'Same content by default (static copy); variants to test. Partly covers the BRD’s help text (BR_06).', stories: ['S19'], qs: ['U13', 'U34', 'U8'] },
    { key: 'close', title: 'CLOSE', legacy: 'CLOSE button', next: 'Close, returns the person to the app they came from', stories: ['S18'], qs: ['U9'] },
  ],
};

// Dynamic data on the end-user page, with where it comes from. Shown in the Page content tab and, with
// "Highlight dynamic data" on, outlined on the page itself (data-dyn="source").
export const DYNAMIC = [
  ['Penalty notice number', 'Signed link: p', 'Revenue NSW'],
  ['Program type', 'CMCS site record (camera program) for the site in s', 'CMCS'],
  ['Site, zone or camera number', 'Signed link: s', 'CMCS'],
  ['Site location', 'CMCS site record for s', 'CMCS'],
  ['Date of offence', 'Signed link: d (date part)', 'Revenue NSW'],
  ['Time of offence', 'Signed link: d (time part)', 'Revenue NSW'],
  ['Tested on (certified) date', 'Certificate in force at d for site s', 'CMCS'],
];
export const STATIC = [
  ['Section headings', 'Offence Details; Camera certificate details for this offence; Enforcement cameras and certification requirements'],
  ['Certificate sentence', 'The fixed words around the tested-on date'],
  ['Camera categories', 'Fixed cameras enforcing speed, or speed and red lights; fixed cameras for other offences; mobile cameras enforcing speed; mobile cameras for other offences'],
  ['Certification frequency', 'Speed measuring devices at least every 12 months; fixed image capture at least every 90 days; mobile cameras before each deployment'],
  ['Legal basis', 'Road Transport Act 2013'],
  ['Contact', 'Transport for NSW customer service centre, 13 22 13'],
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
