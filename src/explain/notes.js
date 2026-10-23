// Explain mode: tester-facing notes pinned to parts of the prototype.
// Each note finds its element by CSS selector (and optional text). Notes only appear when the element is on screen.
// "Notice recipient" = the person or business the penalty notice was issued to (not assumed to be the driver).

export const NOTES = [
  // ---------- Shared ----------
  {
    id: 'modebar', selector: '.cevoc-modebar', title: 'Prototype vs design studio',
    why: 'Separates what a notice recipient or officer would see from the thinking behind it, so testers never mistake design notes for the real service.',
    who: 'Everyone testing the prototype', principle: 'Honest about scope', status: 'Prototype-only',
  },
  {
    id: 'controls', selector: '.cevoc-demo', title: 'Prototype controls',
    why: 'Lets testers force situations that are hard to catch in real life, so we can judge how the service behaves when things go wrong.',
    who: 'Testers and facilitators', principle: 'Fail visibly and kindly', status: 'Prototype-only',
    list: [
      ['Response speed: Slow', 'Every call takes 2–3 seconds. Shows skeleton placeholders, then a “taking longer than usual” note after 2 seconds.'],
      ['Response speed: Timeout', 'Calls never answer. After about 6 seconds we stop waiting and offer Try again, so nobody is left watching a spinner.'],
      ['Source-system outage', 'Everything fails. Tests that every page explains itself and offers a way out instead of going blank.'],
      ['Certificate service down', 'Only the certification check fails. Offence details and images keep working: a partial failure stays partial.'],
      ['Image service down', 'Only images fail (applies on the next lookup). Details and checks still show, with Try again on the image area.'],
      ['Show future video', 'Shows or hides video, which isn’t approved yet. Proves the page works with or without it.'],
      ['Reset demo', 'Clears sign-in, decisions, withdrawals and toggles so the next tester starts fresh.'],
    ],
  },

  // ---------- Notice recipient: lookup ----------
  {
    id: 'lookup', selector: 'form.nsw-form', title: 'Only two details to look up a notice',
    why: 'Notice number plus registration proves the person holds the notice without making them create an account. Fewer fields also means fewer typos for someone already stressed.',
    who: 'All notice recipients; especially Ken (scam worry) and Tom (on an old phone)', principle: 'Design for the worst moment',
    sad: 'CAP-01 Public information access', status: 'Open question: is this enough protection for image access? (Privacy, Cyber)',
  },
  {
    id: 'trust', selector: '.cevoc-trust', title: '“Is this genuine?”',
    why: 'Fine scams are common. People need reassurance before typing anything: this page never asks for card details and you can’t pay here.',
    who: 'Ken, who thinks it might be a scam', principle: 'Design for the worst moment', status: 'Wording to confirm with Revenue NSW',
  },
  {
    id: 'nomatch', selector: '.nsw-in-page-alert', text: 'couldn’t find a matching offence', title: 'Record not found',
    why: 'The message deliberately doesn’t say which detail was wrong, so nobody can guess other people’s notices. It tells the person what to check instead.',
    who: 'Anyone who mistypes; protects every notice recipient', principle: 'Fail visibly and kindly', sad: 'Security / privacy', status: 'Pattern',
  },

  // ---------- Notice recipient: results ----------
  {
    id: 'due', selector: '.nsw-in-page-alert', text: 'days left', title: 'Due date up front',
    why: 'Deadlines drive what people can do. Showing days left, and that help exists before the due date, stops a small fine turning into a bigger one.',
    who: 'Tom (can’t pay), Dave (livelihood at risk)', principle: 'Options, not orders', status: 'Illustrative',
  },
  {
    id: 'review-banner', selector: '.nsw-in-page-alert', text: 'review request is being considered', title: 'Review in progress',
    why: 'If someone has already asked for a review, the most useful thing is to say so and that they don’t need to do anything else, instead of repeating pay options.',
    who: 'Notice recipients who already acted', principle: 'Design for the worst moment', status: 'Assumes review status is available from Revenue NSW',
  },
  {
    id: 'jog', selector: '.cevoc-jog', title: '“Don’t remember this trip?”',
    why: 'Notices often arrive weeks after the trip. Weekday, time of day and “how long ago” jog memory far better than a bare date.',
    who: 'Mia, who can’t remember the trip', principle: 'Evidence before admin',
    evidence: 'Public anecdotes suggest one to four weeks between offence and notice. Validate with contact-centre data.', status: 'Hypothesis',
  },
  {
    id: 'measure', selector: '.cevoc-measure', title: 'How it was measured (per program)',
    why: 'Each enforcement program measures differently: one point, two points with an average, or a red signal. This panel changes by program through configuration, not code.',
    who: 'Dave (average speed), Priya (red light)', principle: 'Configuration, not code', sad: 'Program configuration', status: 'Illustrative wording',
  },
  {
    id: 'gallery', selector: '.cevoc-gallery', title: 'Images before paperwork',
    why: 'Seeing the car and plate answers “was it even me?” faster than any text. The plate close-up also helps fleet managers match bookings.',
    who: 'Mia, Lena (fleet)', principle: 'Evidence before admin', sad: 'CAP-01, CAP-06', status: 'Pattern',
  },
  {
    id: 'withdrawn', selector: '.cevoc-gallery__withdrawn', title: 'Withdrawn content',
    why: '“Withdrawn” means Transport has deliberately taken an item out of public view, for example an image that was wrong, shows someone else, or is legally restricted. The source record isn’t deleted. We keep a visible “not available” placeholder so the person knows something existed and wasn’t silently hidden.',
    who: 'Every notice recipient; Jo (camera operations) controls it', principle: 'Fail visibly and kindly', sad: 'CAP-06 Publication control', status: 'Who can withdraw is an open question',
  },
  {
    id: 'cert-withdrawn', selector: '.nsw-in-page-alert', text: 'has been withdrawn', title: 'Withdrawn certificate',
    why: 'A withdrawn certificate stays findable with an explanation (for example, superseded by a reissued one) rather than disappearing.',
    who: 'Notice recipients checking a camera', principle: 'Fail visibly and kindly', sad: 'CAP-06', status: 'Pattern',
  },
  {
    id: 'video', selector: '.cevoc-video', title: 'Video: future capability',
    why: 'Shows the architecture can support video. It is NOT approved: Legal, Prosecutions, privacy and security decisions are still needed. Clips are generated samples.',
    who: 'Notice recipients who want to see what happened', principle: 'Honest about scope', sad: 'CAP-08 (future)', status: 'Not approved',
  },
  {
    id: 'options', selector: '.cevoc-options', title: 'Options, not orders',
    why: 'Pay, review, nominate, payment plan and court are shown as equal choices. Money help isn’t buried under “pay now”. Each one hands off to Revenue NSW.',
    who: 'Tom (money), Lena (not the driver), Dave (court)', principle: 'Options, not orders', status: 'Wording to confirm with Revenue NSW',
  },
  {
    id: 'pack', selector: '.cevoc-pack', title: 'Legal checks for this camera',
    why: 'The law requires certificates showing the camera was approved, tested (s137, 12 months) and inspected (s138(2), 90 days). We check each one against the offence date and say Met or Not met in plain words.',
    who: 'Notice recipients asking “was the camera even working?”; Alex (review)', principle: 'Evidence before admin',
    sad: 'Road Transport Act 2013 ss132, 137, 138, 257', status: 'Program sets need confirming with program owners',
  },
  {
    id: 'lapsed', selector: '.cevoc-packitem.is-lapsed', title: 'A check that isn’t met',
    why: 'Shows what happens when a certificate is out of date. We tell the person plainly and suggest a review, without giving legal advice.',
    who: 'Notice recipients; Alex (review)', principle: 'Fail visibly and kindly', status: 'Try notice 3162457895 / NEW001',
  },
  {
    id: 'hash', selector: '.cevoc-hash', title: 'Security indicator',
    why: 'Digital camera photos carry a code calculated from the image file (s138(1)). Any change to the image changes the code. Values here are mock.',
    who: 'Alex (review), courts', principle: 'Honest about scope', sad: 'Regulation cl 29(3)', status: 'Mock values',
  },
  {
    id: 'pn', selector: '.cevoc-pn', title: 'The penalty notice as sent',
    why: 'People often arrive holding the paper notice. Showing the same layout helps them match what they see. Names, amounts and codes are invented.',
    who: 'All notice recipients; Ahmed (helping a parent)', principle: 'Honest about scope', status: 'Fictitious sample',
  },
  {
    id: 'unconfigured', selector: '.cevoc-proto-note', title: 'Prototype note',
    why: 'Purple dashed boxes mark something a tester should know: an open question, or a program nobody has configured yet (the page falls back to the default instead of breaking).',
    who: 'Testers', principle: 'Configuration, not code', status: 'Prototype-only',
  },

  // ---------- Failure states ----------
  {
    id: 'skeleton', selector: '.cevoc-skeleton', title: 'Loading placeholder',
    why: 'Grey shapes hold the layout still while data loads, so nothing jumps around. Each part of the page loads on its own.',
    who: 'Everyone, especially on slow mobile connections (Dave)', principle: 'Fail visibly and kindly', sad: 'NFR performance', status: 'Pattern',
  },
  {
    id: 'slow', selector: '.cevoc-slow', title: '“Taking longer than usual”',
    why: 'After 2 seconds we reassure the person that we’re still trying, so they don’t refresh and lose their place.',
    who: 'Everyone', principle: 'Fail visibly and kindly', status: 'Threshold is an example, to confirm with Architecture',
  },
  {
    id: 'timeout', selector: '.nsw-in-page-alert', text: 'taking too long', title: 'Timeout',
    why: 'We stop waiting after a few seconds and offer Try again. A spinner that never ends is worse than an honest “not right now”.',
    who: 'Everyone', principle: 'Fail visibly and kindly', sad: 'NFR resilience', status: 'Timeout value is an example',
  },
  {
    id: 'outage', selector: '.nsw-in-page-alert', text: 'temporarily unavailable', title: 'Source system down',
    why: 'Makes clear the problem is ours, not the person’s details, and offers Try again.',
    who: 'Everyone', principle: 'Fail visibly and kindly', sad: 'NFR-07 Resilience', status: 'Pattern',
  },
  {
    id: 'cert-down', selector: '.nsw-in-page-alert', text: 'can’t check the camera’s certification', title: 'Partial failure: certificates',
    why: 'Only the certificate service is down. Everything else on the page is still correct and stays visible.',
    who: 'Everyone', principle: 'Fail visibly and kindly', sad: 'NFR-07 Resilience', status: 'Pattern',
  },
  {
    id: 'img-down', selector: '.nsw-in-page-alert', text: 'Images can’t be shown', title: 'Partial failure: images',
    why: 'Only the image service is down. Details, camera and legal checks still show; the image area offers Try again.',
    who: 'Everyone', principle: 'Fail visibly and kindly', sad: 'NFR-07 Resilience', status: 'Pattern',
  },

  // ---------- Officers ----------
  {
    id: 'idp', selector: '.cevoc-idp', title: 'Your organisation’s sign-in',
    why: 'Officers sign in with their own work account. CEVOC never holds passwords; the email domain decides which organisation signs them in.',
    who: 'Alex (Revenue NSW), Sam and Jo (Transport)', principle: 'Same data, different lenses', sad: 'CAP-02 Authenticated access',
    status: 'Assumption: Revenue NSW identity platform and federation to confirm',
  },
  {
    id: 'console', selector: '.cevoc-console__nav', title: 'Role-based workspace',
    why: 'A different layout for a different job. The menu only shows what this person’s role allows. Signed in is not the same as authorised.',
    who: 'Officers', principle: 'Same data, different lenses', sad: 'CAP-03 Authorisation', status: 'Pattern',
  },
  {
    id: 'quote', selector: '.cevoc-quote', title: 'The customer’s own words',
    why: 'The reviewer starts from what the notice recipient actually said, next to the evidence, so the decision answers their real complaint.',
    who: 'Alex (review officer)', principle: 'Design for the worst moment', status: 'Assumption',
  },
  {
    id: 'timeline', selector: '.cevoc-timeline', title: 'Case timeline',
    why: 'Offence, notice, review and today in one line, so delays and deadlines are obvious.',
    who: 'Alex', principle: 'Evidence before admin', status: 'Pattern',
  },
  {
    id: 'checklist', selector: '.cevoc-checklist', title: 'Program-specific checklist',
    why: 'What to verify depends on the program (two cameras for average speed, signal timing for red light). Checks that can be automated are ticked for the reviewer.',
    who: 'Alex', principle: 'Configuration, not code', status: 'Illustrative checklist',
  },
  {
    id: 'letter', selector: '.cevoc-letter', title: 'Plain-English outcome letter',
    why: 'The decision has to make sense to an upset person. Previewing the letter before recording the decision catches jargon early.',
    who: 'Alex, and the notice recipient who receives it', principle: 'Design for the worst moment', status: 'Mock letter, not sent',
  },
  {
    id: 'adj', selector: '.cevoc-adj__list', title: 'Adjudication queue',
    why: 'Flags (low plate confidence, lapsed certificate, possible emergency vehicle) are visible in the list so the officer can prioritise.',
    who: 'Sam (adjudication)', principle: 'Fail visibly and kindly', status: 'Assumption',
  },
  {
    id: 'blocked', selector: '.cevoc-panel--officer', text: 'Accept is blocked', title: 'Accept is blocked',
    why: 'If the camera had no certificate in force, the system stops the detection becoming a fine. The rule is enforced, not left to memory.',
    who: 'Sam; protects every notice recipient', principle: 'Evidence before admin', sad: 'Road Transport Act 2013 s137', status: 'Pattern',
  },
  {
    id: 'publication', selector: '.cevoc-panel--officer', text: 'Publication control', title: 'Withdraw / restore',
    why: 'Camera operations can pull public content immediately without deleting the source record, and restore it later. Every action is logged.',
    who: 'Jo (camera operations)', principle: 'Honest about scope', sad: 'CAP-06, CAP-09', status: 'Who can do this is an open question',
  },
];

// Plain explanations of the active prototype controls.
export const ACTIVE = {
  outage: ['Source-system outage is ON', 'Every lookup and page that needs data will fail with “temporarily unavailable”.'],
  certOutage: ['Certificate service down is ON', 'Certification checks fail; everything else works.'],
  imageOutage: ['Image service down is ON', 'Images fail on the next lookup; details still show.'],
  slow: ['Response speed is SLOW', 'Expect skeleton placeholders and a “taking longer” note.'],
  timeout: ['Response speed is TIMEOUT', 'Nothing will load. Pages give up after a few seconds and offer Try again.'],
  noMedia: ['Future video is OFF', 'Video sections say video isn’t available.'],
};
