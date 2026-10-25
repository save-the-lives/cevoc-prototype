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
    title: '1. Revenue: routine enquiry',
    who: 'Sam, Revenue NSW review officer',
    context: 'A customer has looked at the evidence and still asks about a penalty notice. Sam searches for it, checks the certification, and resolves it without Transport.',
    pain: 'Hunting across systems for something the evidence already answers.',
    job: 'When a customer asks, I want to find the notice and see the certification at once, so I can answer without involving anyone else.',
    links: [
      ['1. Search for the penalty notice', '/staff/search?q=3162457890&from=app&as=sam'],
      ['2. Open the review (certification and evidence together)', '/staff/queue/reviews?q=case%20%3D%20%22RV-24026%22&open=1&from=app&as=sam'],
      ['Optional: arrive from the Revenue case system instead', '/source/revenue?case=RV-24026'],
    ],
  },
  {
    title: '2. Revenue: complex review, refer to Transport',
    who: 'Alex, Revenue NSW review officer',
    context: 'RV-24017: the camera inspection was 123 days old against a 90 day limit. That is Transport’s call, so Alex refers it. Referring is not an outcome: the matter stays on Alex’s list.',
    pain: 'Handing a matter away and not knowing where it is.',
    job: 'When a question is beyond what I can resolve, I want to refer it with the evidence and see where it is.',
    links: [
      ['1. Open RV-24017 and refer to Transport', '/staff/queue/reviews?q=case%20%3D%20%22RV-24017%22&open=1&from=app&as=alex'],
      ['2. Alex’s dashboard shows it as referred', '/staff/overview?from=app&as=alex'],
    ],
  },
  {
    title: '3. Court-elected matter',
    who: 'Jordan (Revenue) notifies, Transport supports',
    context: 'CE-24019: the customer elected court. Prosecution and court steps are outside CEVOC. Revenue notifies Transport so the defence can be prepared.',
    pain: 'Court matters reaching Transport late or without the evidence.',
    job: 'When a customer elects court, I want Transport told with the evidence, without CEVOC pretending to run the court process.',
    links: [
      ['1. Jordan notifies Transport of the court election', '/staff/queue/reviews?q=case%20%3D%20%22CE-24019%22&open=1&from=app&as=jordan'],
      ['2. Transport sees it in Referrals', '/staff/requests?from=app&as=jo'],
    ],
  },
  {
    title: '4. Transport: technical assessment',
    who: 'Jo (customer inquiry officer) assesses',
    context: 'A specialist acknowledges a referral, starts the assessment and records a recommendation. A recommendation is not a determination.',
    pain: 'Having to work through a customer file to find the technical question.',
    job: 'When a matter is referred, I want the certification and evidence together and a clear place to record my assessment.',
    links: [
      ['1. Jo opens the referral', '/staff/requests?from=app&as=jo'],
      ['2. Acknowledge, start the assessment, record a recommendation', '/staff/request/TR-3001?from=app&as=jo'],
    ],
  },
  {
    title: '5. Transport: determination and withdrawal',
    who: 'Morgan (camera program manager) determines; Alex acts downstream',
    context: 'Only an authorised Transport role can determine whether enforcement stands or withdrawal is authorised. Revenue is informed and carries out its own downstream steps. Simulated: no evidence is changed and nothing is sent anywhere.',
    pain: 'Unclear who has the authority, and Revenue learning of the outcome late.',
    job: 'When withdrawal may be justified, I want the evidence, the assessment and my authority in one place, and Revenue told.',
    links: [
      ['1. Morgan issues the determination', '/staff/requests?view=determine&from=app&as=morgan'],
      ['2. Alex sees the determination and records downstream steps', '/staff/queue/reviews?view=advice&open=1&from=app&as=alex'],
    ],
  },
  {
    title: 'Also: a certificate problem touches many notices',
    who: 'Kai (technical systems advisor) requests, Morgan approves',
    context: 'The speed device at Granville is found out of tolerance, so its test-and-seal certificate is withdrawn. That affects every notice relying on it, and Revenue NSW sees which of its open matters are touched. (This is withdrawal of a certificate, not of enforcement.)',
    pain: 'One wrong certificate can undermine every fine that relies on it.',
    job: 'When a certificate is wrong, I want to see what it affects, have a second person approve, and have Revenue told.',
    links: [
      ['1. Kai requests the withdrawal', '/staff/cert/S137-PAR001-2026?from=app&as=kai'],
      ['2. Morgan approves it', '/staff/queue/approvals?from=app&as=morgan'],
      ['3. Revenue sees the alert', '/staff/overview?from=app&as=chris'],
    ],
  },
];

// Open questions now live in the validation register (./register.js).

