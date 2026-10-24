// Content for the demo hub: user archetypes, scenarios, reference material and open questions.
// Everything here is presenter material, not part of the service.

export const VERIFIED = {
  confirmed: ['ok', 'Confirmed'],
  documented: ['doc', 'Documented on official sites'],
  assumed: ['warn', 'Exists, not seen'],
  proposed: ['new', 'Proposed (new)'],
};

// step kinds: ext = existing service, ours = CEVOC, out = hand-off back to the owning agency, person = what the person does
export const ARCHETYPES = [
  {
    id: 'individual', name: 'Logged-in individual', who: 'Most people with a single fine, usually on their phone',
    pain: 'Gets a letter weeks later, can’t remember the trip, and has to stitch the answers together from several sites.',
    job: 'When I find my fine in my account, I want to see what happened and whether it holds up, without logging in somewhere else.',
    steps: [['Letter arrives', 'person'], ['MyServiceNSW or Service NSW app', 'ext'], ['Fine page', 'ext'], ['CEVOC: your fine, explained', 'ours'], ['Pay, review or nominate', 'out']],
    doors: [
      { name: 'MyServiceNSW → Fines', owner: 'Service NSW', verified: 'confirmed', note: 'Service NSW fines page', lands: 'Fine page → CEVOC link' },
      { name: 'Service NSW app', owner: 'Service NSW', verified: 'documented', note: 'Service NSW mentions viewing and paying fines in the app', lands: 'Fine in app → CEVOC link' },
    ],
    notices: ['3162457890', '3162457893'], try: [['Open as this person', '/notice/3162457890']],
  },
  {
    id: 'letter', name: 'Letter in hand, no account', who: 'Anyone with the paper notice who doesn’t want to sign in',
    pain: 'Unsure the letter is real. Wants to check it quickly using only what is printed on it.',
    job: 'When I only have the letter, I want to type two details and see my fine, so I can decide what to do.',
    steps: [['Letter arrives', 'person'], ['myPenalty, QR code or a web search', 'ext'], ['Notice number + offence date', 'person'], ['CEVOC: your fine, explained', 'ours'], ['Pay, review or nominate', 'out']],
    doors: [
      { name: 'myPenalty', owner: 'Revenue NSW', verified: 'documented', note: 'Revenue NSW and Service NSW pages; inputs to confirm', lands: 'Images → CEVOC link' },
      { name: 'MyFines (fines.digital.revenue.nsw.gov.au)', owner: 'Revenue NSW', verified: 'assumed', note: 'Exists; screens not seen. Possibly replacing myPenalty', lands: 'To confirm' },
      { name: 'Link or QR code on the paper notice', owner: 'Revenue NSW → Transport', verified: 'proposed', note: 'Not on notices today as far as we know', lands: 'Straight to “Your fine, explained”' },
      { name: 'Web search → nsw.gov.au', owner: 'NSW Government', verified: 'documented', note: '“View a camera image of your offence” page', lands: 'nsw.gov.au → myPenalty or CEVOC' },
      { name: 'Straight to this site', owner: 'Transport (CEVOC)', verified: 'confirmed', note: 'Current CEVOC certificate site', lands: 'Lookup → “Your fine, explained”' },
    ],
    notices: ['3162457891', '3162457897'], try: [['Start at the lookup', '/']],
  },
  {
    id: 'fleet', name: 'Fleet or company', who: 'Fleet managers and registered operators of company vehicles',
    pain: 'A driver says the logbook disagrees. Needs timing and distance before nominating the driver or going to court.',
    job: 'When a vehicle in my fleet is fined, I want the evidence and how the average was worked out, so I can decide whether to contest.',
    steps: [['Company notice arrives', 'person'], ['Company image page or eNominations', 'ext'], ['CEVOC: your fine, explained', 'ours'], ['Nominate the driver or elect court', 'out']],
    doors: [{ name: 'Company and fleet fines', owner: 'Revenue NSW (eNominations)', verified: 'documented', note: 'Separate company image page and eNominations', lands: 'Fine → CEVOC link, then nominate' }],
    notices: ['3162457894'], try: [['Open a fleet vehicle fine', '/notice/3162457894']],
  },
  {
    id: 'assisted', name: 'Needs help', who: 'People who can’t or won’t go online and ring Revenue NSW',
    pain: 'Can’t read a screen, or doesn’t trust one. Needs someone to look at the evidence with them.',
    job: 'When I ring, I want the person helping me to see exactly what I would see, so we can talk it through.',
    steps: [['Rings 1300 138 118', 'person'], ['ID check', 'ext'], ['Agent opens the staff workspace', 'ours'], ['Copies of images sent after ID check', 'out']],
    doors: [{ name: 'Phone 1300 138 118', owner: 'Revenue NSW contact centre', verified: 'documented', note: 'Copies of images sent after ID check', lands: 'Agent uses the staff workspace' }],
    notices: [], try: [['Open as the agent', '/staff/queue/reviews?from=app&as=alex']],
  },
  {
    id: 'camera', name: 'Checking a camera', who: 'Lawyers, journalists and the curious, with no fine of their own',
    pain: 'Wants to know if a camera was certified on a given day, without needing a penalty notice.',
    job: 'When I question a camera, I want its certificates by date, so I can check the claim myself.',
    steps: [['Searches for a camera', 'person'], ['CEVOC: camera search', 'ours'], ['Reads certificates by date', 'person']],
    doors: [{ name: 'Checking a camera without a fine', owner: 'Transport (CEVOC)', verified: 'confirmed', note: 'What the current CEVOC site does today', lands: 'Camera search' }],
    notices: [], try: [['Search cameras', '/cameras']],
  },
  {
    id: 'staff', name: 'Transport and Revenue NSW staff', who: 'Review officers, prosecutions, camera operations and program managers',
    pain: 'Hunts through systems and emails Transport for footage. One wrong certificate can undermine every fine that relies on it.',
    job: 'When a case lands, I want the evidence and its validity on one screen, so I can decide and explain it quickly.',
    steps: [['Case system', 'ext'], ['Trusted SSO, no second login', 'ext'], ['CEVOC staff workspace', 'ours'], ['Decision back to the case system', 'out']],
    doors: [{ name: 'Revenue NSW and Transport case systems', owner: 'Revenue NSW, Transport', verified: 'proposed', note: 'Trusted single sign-on from the case system', lands: 'Staff workspace' }],
    notices: [], try: [['Open the staff workspace', '/staff']],
  },
];

export const JOURNEY = [
  ['Letter arrives', 'Weeks later. Confused, maybe angry.', -2],
  ['Finds the notice', 'From MyServiceNSW, myPenalty, or two details.', -1],
  ['Sees what happened', 'Time, place, plate. “OK, that’s my car.”', 0],
  ['Checks it’s fair', 'Measurement and certificates in plain words.', 1],
  ['Decides', 'Options with Revenue NSW, no pressure.', 1],
];

// Information architecture: what the person asks, and who answers it today.
export const QA = [
  ['What happened?', 'Offence, date and time, place, vehicle, how long ago', 'Penalty notice; camera site record', 'Revenue NSW + Transport', 'Split across the notice, myPenalty and CEVOC'],
  ['Was it me?', 'Photos, plate close-up, video (future)', 'Image store; video (future)', 'Revenue NSW today (myPenalty)', 'myPenalty only'],
  ['Is the evidence enough?', 'Photos + measurement + legal checks in one plain answer', 'Notice, images, security indicators, certificates', 'Nobody today', 'Not answered anywhere'],
  ['Was the camera certified at the time?', 'Each required certificate checked against the offence date', 'Certificate records (s137, s138, s132, s257)', 'Transport today (CEVOC)', 'CEVOC, but the person must find the camera and date themselves'],
  ['What can I do?', 'Pay, plan, review, nominate, court, with the due date', 'Revenue NSW case and payment systems', 'Revenue NSW / Service NSW', 'MyServiceNSW and myPenalty'],
];

export const IMPLICATIONS = [
  ['Moves into Revenue NSW territory', 'by showing incident images and, later, video next to the certificates. Needs agreement on who owns the combined page and on image access rules.'],
  ['Keeps the certificate role', 'now matched automatically to the fine’s camera and date instead of a manual search.'],
  ['Hands actions back', 'pay, review, nominate and court stay with Revenue NSW and Service NSW.'],
  ['Still serves people without a fine', 'through camera search.'],
];

export const STAFF_STORIES = [
  {
    title: 'A. Revenue NSW resolves it alone',
    who: 'Sam, Revenue NSW review officer',
    context: 'A routine review: the evidence is good and the camera’s certificates are current. Sam arrives from the Revenue NSW case system, sees the validation first, records a decision and returns.',
    pain: 'Hunting through systems and emailing Transport for something the evidence already answers.',
    job: 'When a review lands, I want the evidence and its validity on one screen, so I can decide and explain it quickly without involving anyone else.',
    links: [
      ['1. Start in the simulated Revenue NSW case system', '/source/revenue?case=RV-24026'],
      ['2. Open RV-24026 in CEVOC (validation shown first)', '/staff/case/RV-24026?from=external&src=revenue&ref=RCM-558026&as=sam'],
      ['3. Or work it from the queue', '/staff?as=sam&from=app'],
    ],
  },
  {
    title: 'B. A technical exception goes to Transport and back',
    who: 'Alex (Revenue NSW) asks, Jo (Transport) answers',
    context: 'RV-24017 is a red-light case where the camera inspection was 123 days old (limit 90). Alex requests technical advice. The case stays open at Revenue NSW. Jo answers in the technical inbox. Alex then decides.',
    pain: 'Referring the whole case away, losing context and ownership.',
    job: 'When I hit a technical question I can’t answer, I want to ask one specific question and get an answer back on my case, so I still make the decision.',
    links: [
      ['1. Alex requests technical advice on RV-24017', '/staff/queue/reviews?q=case%20%3D%20%22RV-24017%22&from=app&as=alex'],
      ['2. Jo answers in Technical requests', '/staff/requests?from=app&as=jo'],
      ['3. Alex finalises the case', '/staff/queue/reviews?view=advice&from=app&as=alex'],
      ['4. A similar enquiry, RV-24022, can reuse the advice', '/staff/queue/reviews?q=case%20%3D%20%22RV-24022%22&from=app&as=alex'],
      ['Also: reuse without a new referral (RV-24025, phone detection)', '/staff/queue/reviews?q=case%20%3D%20%22RV-24025%22&from=app&as=alex'],
    ],
  },
  {
    title: 'C. A certificate problem touches many notices',
    who: 'Jo requests, Morgan approves, Revenue NSW is notified',
    context: 'The speed device at Granville is found out of tolerance, so its test-and-seal certificate is withdrawn. That affects every notice relying on it, and Revenue NSW sees which of its open cases are touched.',
    pain: 'One wrong certificate can undermine every fine that relies on it, and Revenue NSW finds out by accident.',
    job: 'When a certificate is wrong, I want to see exactly what it affects, have a second person approve it, and have Revenue NSW told which of their cases are touched.',
    links: [
      ['1. Jo requests the withdrawal', '/staff/cert/S137-PAR001-2026?from=app&as=jo'],
      ['2. Morgan approves it', '/staff/queue/approvals?from=app&as=morgan'],
      ['3. Revenue NSW sees the affected cases', '/staff?from=app&as=sam'],
      ['4. The public page for the notice changes', '/notice/3162457890'],
    ],
  },
];

export const QUESTIONS = [
  ['Who owns the combined public page: Transport, Revenue NSW or Service NSW?', 'Revenue NSW, Transport'],
  ['Should the public see incident images and video here, or only in myPenalty?', 'Revenue NSW, Legal, Privacy'],
  ['Does CEVOC own certificate withdrawal, or only reflect a status set in the source system?', 'Transport, Legal'],
  ['How does a deep link from MyServiceNSW carry the notice securely?', 'Cyber, Service NSW'],
  ['Which identity platforms apply for Revenue NSW staff, and is federation acceptable?', 'Identity, Cyber'],
  ['Is notice number + date of offence enough to show images to the public?', 'Privacy, Revenue NSW'],
];

