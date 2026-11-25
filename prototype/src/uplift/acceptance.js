// Acceptance criteria uplift (owner, 26 Nov 2026). Every story's criteria are Given/When/Then steps (data.js).
// Here: which criteria are automated, by a named Playwright check in tests/acceptance/run.cjs, the BRD reference per
// criterion where one exists, the cross-cutting criteria that apply to every story, and the Definition of Done.
// A criterion is "covered" when it has a named check; the check runs in CI (acceptance.yml) and locally with
// `npm run build && npm run test:acceptance`. Criteria that need CMCS data, a backend or a person stay manual.

// Story criterion -> check name. Key: `${storyId}.${criterionNumber}` (1-based, as shown on the story).
export const AC_CHECKS = {
  'S1.1': 'search.location-suggestions',
  'S1.2': 'search.location-chip',
  'S1.3': 'search.multi-location-results',
  'S2.1': 'search.default-range',
  'S2.2': 'search.preset-sets-range',
  'S2.3': 'search.edit-makes-custom',
  'S2.4': 'search.date-validation',
  'S3.1': 'search.sort-toggle',
  'S3.2': 'search.sort-dates',
  'S4.1': 'search.expand-row',
  'S4.2': 'search.collapse-row',
  'S4.3': 'search.expand-several',
  'S5.1': 'labels.switch',
  'S5.2': 'labels.kept',
  'S6.1': 'search.empty-state',
  'S7.1': 'search.fault',
  'S7.2': 'search.fault-retry',
  'S8.1': 'search.gap-warning',
  'S9.1': 'search.withdrawn-tag',
  'S9.2': 'search.reissue-details',
  'S11.1': 'record.signed-link',
  'S11.2': 'record.no-download',
  'S12.1': 'record.missing-warning',
  'S12.2': 'record.withdrawn-notice',
  'S13.1': 'record.fault',
  'S14.1': 'record.bad-link',
  'S15.1': 'lifecycle.draft-hidden',
  'S20.5': 'record.disclaimer-gipa',
  'S17.1': 'search.error-summary',
  'S18.1': 'search.clear',
  'S19.1': 'a11y.axe',
  'S19.2': 'layout.phone-no-hscroll',
  'S22.1': 'record.return-link',
  'S22.2': 'record.close-tab',
  'S22.3': 'record.tampered-source',
};

// BRD reference per criterion, where it differs from (or narrows) the story's own BRD list.
export const AC_BRD = {
  'S10.1': 'BR_01, BR_02', 'S11.2': 'BR_03', 'S9.1': 'BR_09', 'S9.2': 'BR_09', 'S15.1': 'BR_04, BR_07', 'S15.2': 'BR_04, BR_07',
  'S20.1': 'BR_05, BR_06, BR_08',
};

// Cross-cutting criteria: apply to every story and every screen.
const x = (id, area, g, w, t, brd, check, note = '') => ({ id, area, g, w, t, brd, check, note });
export const CROSS = [
  x('X1', 'Accessibility', 'the search page and the record page in every state', 'axe-core runs with the WCAG 2.0, 2.1 and 2.2 A and AA rules', 'it reports no violations', '—', 'a11y.axe'),
  x('X2', 'Accessibility', 'any page', 'I use only the keyboard', 'every control can be reached with Tab in reading order and shows a visible focus outline', '—', 'a11y.keyboard'),
  x('X3', 'Accessibility', 'a status (Current, Expired, Withdrawn, missing, fault)', 'it is shown', 'it is said in words, not by colour alone', 'BR_09', 'a11y.status-in-words'),
  x('X4', 'Accessibility', 'any page', 'text is zoomed to 200% or the window is 320 px wide', 'nothing is cut off and there is no sideways page scrolling', '—', 'layout.phone-no-hscroll'),
  x('X5', 'Privacy', 'a signed link', 'the record page opens', 'the address holds only the signed link’s fields (p, d, s, i, r, m) and the page adds no other personal data to it', '—', 'privacy.url-fields'),
  x('X6', 'Privacy', 'the record page', 'it loads', 'the browser console has no log lines carrying the notice number or other link values', '—', 'privacy.no-console-data'),
  x('X7', 'Privacy', 'the record page', 'it loads', 'the GIPA disclaimer is shown with a link to Transport’s access application page', 'BR_05', 'privacy.gipa-disclaimer'),
  x('X8', 'Privacy', 'any page', 'it loads', 'it makes no calls to other sites (no analytics, fonts or scripts from elsewhere)', '—', 'privacy.no-external-calls'),
  x('X9', 'Signed link', 'a link whose signature does not match (tampered)', 'I open it', 'I see the wrong-link message and no offence or certificate data', '—', 'record.tampered'),
  x('X10', 'Signed link', 'a link with a required field missing', 'I open it', 'I see the wrong-link message', '—', 'record.missing-field'),
  x('X11', 'Signed link', 'an expired link', 'I open it', 'I see a message that the link has expired and how to get a new one', '—', null, 'Link expiry is not in the prototype: how long a link lives is an open question (U15, U29).'),
  x('X12', 'Performance', 'a mid-range phone (4× slower CPU, fast 3G)', 'I open the record page from a signed link', 'the certificate date is on screen within 3 seconds', '—', 'perf.record-phone'),
  x('X13', 'Offline and local hosting', 'the built site copied into any folder of any web server, with no internet', 'I open it', 'every page works from that folder (relative paths, hash routing) and nothing is fetched from elsewhere', '—', 'hosting.subfolder'),
  x('X14', 'Offline and local hosting', 'the site on Apache/XAMPP with PHP, installed by git clone of the site branch', 'a deploy is pulled with git pull', 'shared edits survive and the database cannot be downloaded', '—', 'exam/run-exam.sh', 'Run by the XAMPP exam in deploy.yml, not by the acceptance run.'),
];

export const DOD = [
  'Every acceptance criterion is a Given/When/Then step, traced to its BRD reference where one exists.',
  'Criteria that can be automated have a named Playwright check, and it passes in CI (acceptance.yml).',
  'The cross-cutting criteria X1 to X14 pass: accessibility (WCAG 2.2 AA), privacy, signed-link failures, phone performance, local hosting.',
  'No open question linked to the story is still “Assumption to validate” or “Confirmation required”.',
  'Manual criteria have been checked by a person, and the result is noted on the story.',
  'Invented data only; nothing prototype-specific on the two key screens (Tour overlay only).',
  'Docs, the Tour notes and app settings are updated in the same change.',
];

export const checkFor = (sid, n) => AC_CHECKS[`${sid}.${n}`] || null;
export const ALL_CHECKS = [...new Set([...Object.values(AC_CHECKS), ...CROSS.map((c) => c.check).filter((c) => c && !c.includes('/'))])];
