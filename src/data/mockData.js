// ALL DATA IN THIS FILE IS FICTITIOUS AND FOR DEMONSTRATION ONLY.
// Image `slot` values map to entries in public/assets/manifest.json (fetched/supplied assets).
// If no manifest image exists for a slot, the `fallback` placeholder in public/assets/placeholders is used.
// Publication `status`: published | restricted | withdrawn | future
// `program` codes map to src/config/programs.js. Unknown codes fall back to the default program.

export const SITES = [
  {
    code: 'PAR-001',
    name: 'Parramatta Road, Granville',
    suburb: 'Granville',
    direction: 'Eastbound',
    type: 'Fixed speed camera',
    speedLimit: 60,
    lga: 'Cumberland',
    commissioned: '2019-05-14',
    photo: { slot: 3, fallback: 'site-par.svg' },
  },
  {
    code: 'RYD-014',
    name: 'Victoria Road, Ryde',
    suburb: 'Ryde',
    direction: 'Westbound',
    type: 'Red-light speed camera',
    speedLimit: 60,
    lga: 'City of Ryde',
    commissioned: '2017-11-02',
    photo: { slot: 4, fallback: 'site-ryd.svg' },
  },
  {
    code: 'LIV-207',
    name: 'Hume Highway, Liverpool',
    suburb: 'Liverpool',
    direction: 'Southbound',
    type: 'Fixed speed camera',
    speedLimit: 70,
    lga: 'Liverpool',
    commissioned: '2021-02-22',
    photo: { slot: 5, fallback: 'site-liv.svg' },
  },
  {
    code: 'MOB-312',
    name: 'Windsor Road, Kellyville (mobile site)',
    suburb: 'Kellyville',
    direction: 'Northbound',
    type: 'Mobile speed camera',
    speedLimit: 70,
    lga: 'The Hills Shire',
    commissioned: '2024-07-01',
    photo: { slot: 6, fallback: 'site-par.svg' },
  },
  {
    code: 'AVG-HUM',
    name: 'Hume Highway average speed zone (mock section)',
    suburb: 'Southern Highlands',
    direction: 'Southbound',
    type: 'Average speed camera',
    speedLimit: 100,
    lga: 'Wingecarribee',
    commissioned: '2020-03-30',
    photo: { slot: 7, fallback: 'site-liv.svg' },
  },
  {
    code: 'SCH-090',
    name: 'Old Northern Road, Castle Hill (pilot)',
    suburb: 'Castle Hill',
    direction: 'Northbound',
    type: 'Pilot camera (new program)',
    speedLimit: 40,
    lga: 'The Hills Shire',
    commissioned: '2026-07-01',
    photo: { slot: 8, fallback: 'site-ryd.svg' },
  },
];

const restricted = (serial, match, tester) => ({
  deviceSerial: serial,
  matchValue: match,
  testedBy: tester,
  speedAccuracy: 'Within tolerance',
  imageCapture: 'Pass',
  timeSource: 'Synchronised (pass)',
});

export const CERTIFICATES = [
  // PAR-001: current, previous, and a withdrawn + reissued pair
  { id: 'CEV-PAR001-2026', site: 'PAR-001', type: 'Speed measuring device accuracy certificate', testedOn: '2026-03-10', validFrom: '2026-03-10', validTo: '2027-03-09', status: 'published', restricted: restricted('SC-88412-M', '7F3A-91C2-MOCK', 'Authorised tester A-4471 (mock)') },
  { id: 'CEV-PAR001-2025R', site: 'PAR-001', type: 'Speed measuring device accuracy certificate (reissued)', testedOn: '2025-03-12', validFrom: '2025-03-12', validTo: '2026-03-09', status: 'published', restricted: restricted('SC-88412-M', '2B90-44D1-MOCK', 'Authorised tester A-4471 (mock)') },
  { id: 'CEV-PAR001-2025', site: 'PAR-001', type: 'Speed measuring device accuracy certificate', testedOn: '2025-03-11', validFrom: '2025-03-11', validTo: '2026-03-09', status: 'withdrawn', withdrawnReason: 'Superseded by a reissued certificate (mock scenario).', restricted: restricted('SC-88412-M', '0C11-9AE0-MOCK', 'Authorised tester B-1022 (mock)') },
  // RYD-014: current + previous, one restricted engineering record
  { id: 'CEV-RYD014-2026', site: 'RYD-014', type: 'Red-light and speed device accuracy certificate', testedOn: '2026-01-20', validFrom: '2026-01-20', validTo: '2027-01-19', status: 'published', restricted: restricted('RL-20577-K', 'D4E8-1F06-MOCK', 'Authorised tester C-3390 (mock)') },
  { id: 'CEV-RYD014-2025', site: 'RYD-014', type: 'Red-light and speed device accuracy certificate', testedOn: '2025-01-21', validFrom: '2025-01-21', validTo: '2026-01-19', status: 'published', restricted: restricted('RL-20577-K', '8A2C-77B3-MOCK', 'Authorised tester C-3390 (mock)') },
  { id: 'CEV-RYD014-ENG', site: 'RYD-014', type: 'Engineering inspection record', testedOn: '2026-06-03', validFrom: '2026-06-03', validTo: '2026-06-03', status: 'restricted', restricted: restricted('RL-20577-K', 'n/a', 'Field engineer E-5512 (mock)') },
  // LIV-207: deliberate gap between certificates (2025-10-02 to 2025-11-01)
  { id: 'CEV-LIV207-2025', site: 'LIV-207', type: 'Speed measuring device accuracy certificate', testedOn: '2025-11-02', validFrom: '2025-11-02', validTo: '2026-11-01', status: 'published', restricted: restricted('SC-90155-P', '5E7B-0A93-MOCK', 'Authorised tester A-4471 (mock)') },
  { id: 'CEV-LIV207-2024', site: 'LIV-207', type: 'Speed measuring device accuracy certificate', testedOn: '2024-10-02', validFrom: '2024-10-02', validTo: '2025-10-01', status: 'published', restricted: restricted('SC-90155-P', '93F0-6C2E-MOCK', 'Authorised tester B-1022 (mock)') },
  // MOB-312: certificate lapsed on 20 Oct 2026 (adjudication must block newer detections)
  { id: 'CEV-MOB312-2025', site: 'MOB-312', type: 'Mobile speed device accuracy certificate', testedOn: '2025-10-21', validFrom: '2025-10-21', validTo: '2026-10-20', status: 'published', restricted: restricted('MS-31204-V', '41AC-7D20-MOCK', 'Authorised tester C-3390 (mock)') },
  // AVG-HUM: one certificate covering both points
  { id: 'CEV-AVGHUM-2026', site: 'AVG-HUM', type: 'Average speed system accuracy certificate (points A and B)', testedOn: '2026-04-15', validFrom: '2026-04-15', validTo: '2027-04-14', status: 'published', restricted: restricted('AS-7710-A / AS-7711-B', '9D3E-02B8-MOCK', 'Authorised tester A-4471 (mock)') },
  // SCH-090: pilot program camera
  { id: 'CEV-SCH090-2026', site: 'SCH-090', type: 'Pilot device accuracy certificate', testedOn: '2026-07-01', validFrom: '2026-07-01', validTo: '2027-06-30', status: 'published', restricted: restricted('PL-00090-X', '1A2B-3C4D-MOCK', 'Authorised tester B-1022 (mock)') },
];

export const NOTICES = [
  {
    number: '3162457890',
    rego: 'CEV123',
    program: 'FIXED_SPEED',
    offence: 'Exceed speed limit by 10 km/h or less',
    dateTime: '2026-09-18T07:42:13',
    issued: '2026-10-02',
    due: '2026-10-30',
    site: 'PAR-001',
    recordedSpeed: 68,
    vehicle: 'Passenger vehicle',
    images: [
      { id: 'IMG-0901', caption: 'Primary image: vehicle in detection zone', slot: 0, fallback: 'offence-1.svg', status: 'published' },
      { id: 'IMG-0902', caption: 'Number plate detail', slot: 1, fallback: 'offence-2.svg', status: 'published' },
    ],
    media: [{ id: 'VID-0901', title: 'Speed detection sequence (8 seconds)', slot: 0, fallback: 'sample-speed.mp4', poster: 'sample-speed-poster.jpg', status: 'future' }],
  },
  {
    number: '3162457891',
    rego: 'RLC456',
    program: 'RED_LIGHT_SPEED',
    offence: 'Proceed through red traffic light',
    dateTime: '2026-08-02T18:05:47',
    issued: '2026-08-21',
    due: '2026-09-18',
    status: 'review',
    reviewLodged: '2026-09-10',
    site: 'RYD-014',
    recordedSpeed: 54,
    redFor: 3.2,
    vehicle: 'Passenger vehicle',
    images: [
      { id: 'IMG-0811', caption: 'Image 1: vehicle behind stop line, signal red', slot: 2, fallback: 'offence-3.svg', status: 'published' },
      { id: 'IMG-0812', caption: 'Image 2: vehicle in intersection', slot: 0, fallback: 'offence-1.svg', status: 'published' },
      { id: 'IMG-0813', caption: 'Image 3: number plate detail', slot: 1, fallback: 'offence-2.svg', status: 'withdrawn' },
    ],
    media: [{ id: 'VID-0811', title: 'Red-light sequence (8 seconds)', slot: 1, fallback: 'sample-redlight.mp4', poster: 'sample-redlight-poster.jpg', status: 'future' }],
  },
  {
    number: '3162457892',
    rego: 'ERR999',
    program: 'FIXED_SPEED',
    offence: 'Exceed speed limit by more than 10 km/h',
    dateTime: '2026-10-01T13:20:05',
    issued: '2026-10-14',
    due: '2026-11-11',
    site: 'LIV-207',
    recordedSpeed: 83,
    vehicle: 'Passenger vehicle',
    upstreamFailure: true, // demonstrates source-system unavailability for one record
    images: [],
    media: [],
  },
  {
    number: '3162457893',
    rego: 'MOB789',
    program: 'MOBILE_SPEED',
    offence: 'Exceed speed limit by more than 10 km/h',
    dateTime: '2026-09-04T22:16:40',
    issued: '2026-09-28',
    due: '2026-10-28',
    site: 'MOB-312',
    recordedSpeed: 81,
    vehicle: 'Passenger vehicle',
    images: [
      { id: 'IMG-3101', caption: 'Primary image: vehicle passing mobile camera', slot: 9, fallback: 'offence-1.svg', status: 'published' },
      { id: 'IMG-3102', caption: 'Number plate detail', slot: 1, fallback: 'offence-2.svg', status: 'published' },
    ],
    media: [],
  },
  {
    number: '3162457894',
    rego: 'HVY321',
    program: 'AVERAGE_SPEED',
    offence: 'Heavy vehicle exceed average speed limit',
    dateTime: '2026-09-11T03:48:00',
    issued: '2026-10-01',
    due: '2026-10-29',
    site: 'AVG-HUM',
    recordedSpeed: 108,
    vehicle: 'Heavy vehicle (prime mover)',
    segment: { pointA: 'Point A (northern camera)', pointB: 'Point B (southern camera)', distanceKm: 18, timeA: '03:38:00', timeB: '03:48:00' },
    images: [
      { id: 'IMG-HV01', caption: 'Point A: vehicle and plate at 3:38:00 am', slot: 10, fallback: 'offence-1.svg', status: 'published' },
      { id: 'IMG-HV02', caption: 'Point B: vehicle and plate at 3:48:00 am', slot: 11, fallback: 'offence-2.svg', status: 'published' },
    ],
    media: [],
  },
  {
    number: '3162457895',
    rego: 'NEW001',
    program: 'POINT_TO_POINT_PILOT_X', // deliberately not configured: shows default fallback
    offence: 'Exceed speed limit (pilot program)',
    dateTime: '2026-10-06T08:31:10',
    issued: '2026-10-16',
    due: '2026-11-13',
    site: 'SCH-090',
    recordedSpeed: 47,
    vehicle: 'Passenger vehicle',
    images: [{ id: 'IMG-PX01', caption: 'Primary image', slot: 12, fallback: 'offence-1.svg', status: 'published' }],
    media: [],
  },
  {
    number: '3162457896',
    rego: 'IMG404',
    program: 'FIXED_SPEED',
    offence: 'Exceed speed limit by more than 10 km/h',
    dateTime: '2026-09-29T16:02:51',
    issued: '2026-10-13',
    due: '2026-11-10',
    site: 'PAR-001',
    recordedSpeed: 71,
    vehicle: 'Passenger vehicle',
    imagesUnavailable: true, // demonstrates the image service failing while everything else works
    images: [{ id: 'IMG-0961', caption: 'Primary image', slot: 0, fallback: 'offence-1.svg', status: 'published' }],
    media: [],
  },
];

// Evidence held by Transport that is NOT on the notice (prima facie) evidence. Reviewer access is an open question.
export const ADDITIONAL_EVIDENCE = {
  '3162457891': [
    { kind: 'image', id: 'IMG-0814', caption: 'Wide-angle context image (Transport-held)', slot: 13, fallback: 'site-ryd.svg', status: 'published' },
    { kind: 'video', id: 'VID-0812', title: 'Approach camera, 8 seconds (Transport-held)', slot: 0, fallback: 'sample-speed.mp4', poster: 'sample-speed-poster.jpg' },
  ],
  '3162457890': [
    { kind: 'image', id: 'IMG-0903', caption: 'Driver-side detail (Transport-held, privacy review needed)', slot: 14, fallback: 'offence-1.svg', status: 'published' },
  ],
  '3162457894': [
    { kind: 'image', id: 'IMG-HV03', caption: 'Point B wide image (Transport-held)', slot: 15, fallback: 'site-liv.svg', status: 'published' },
  ],
};

export const REVIEW_CASES = [
  {
    id: 'RV-24017',
    notice: '3162457891',
    type: 'Review request',
    lodged: '2026-09-10',
    channel: 'Online form',
    grounds: 'The light turned amber as I got there and I couldn’t stop safely. I’ve never had a red-light fine in 20 years.',
    mood: 'Frustrated, feels the camera was unfair',
  },
  {
    id: 'RV-24018',
    notice: '3162457890',
    type: 'Review request',
    lodged: '2026-10-15',
    channel: 'Phone (contact centre note)',
    grounds: 'Caller says the car was sold in August and it wasn’t them. Very upset; asked to see the photo of the driver.',
    mood: 'Angry, worried about being blamed',
  },
  {
    id: 'RV-24019',
    notice: '3162457894',
    type: 'Court election',
    lodged: '2026-10-18',
    channel: 'Online form',
    grounds: 'I drive trucks for a living. My logbook shows I was within limits. The timing between the cameras must be wrong.',
    mood: 'Anxious, livelihood at risk',
  },
];

export const DETECTIONS = [
  { id: 'DET-55101', site: 'PAR-001', program: 'FIXED_SPEED', at: '2026-10-22T08:14:02', speed: 72, plateRead: 'BXT42Q', confidence: 0.98, slot: 0, fallback: 'offence-1.svg', flags: [] },
  { id: 'DET-55102', site: 'RYD-014', program: 'RED_LIGHT_SPEED', at: '2026-10-22T08:20:51', speed: 48, plateRead: 'C?K18', confidence: 0.41, slot: 2, fallback: 'offence-3.svg', flags: ['Low plate-read confidence'] },
  { id: 'DET-55103', site: 'AVG-HUM', program: 'AVERAGE_SPEED', at: '2026-10-22T02:51:30', speed: 112, plateRead: 'HV88TT', confidence: 0.95, slot: 10, fallback: 'offence-2.svg', flags: [] },
  { id: 'DET-55104', site: 'MOB-312', program: 'MOBILE_SPEED', at: '2026-10-22T09:02:17', speed: 84, plateRead: 'DLQ55M', confidence: 0.97, slot: 9, fallback: 'offence-1.svg', flags: ['Device certificate lapsed 20 Oct 2026'] },
  { id: 'DET-55105', site: 'LIV-207', program: 'FIXED_SPEED', at: '2026-10-22T10:40:09', speed: 91, plateRead: 'AMB000', confidence: 0.93, slot: 3, fallback: 'offence-1.svg', flags: ['Possible emergency vehicle (lights visible)'] },
  { id: 'DET-55106', site: 'SCH-090', program: 'POINT_TO_POINT_PILOT_X', at: '2026-10-22T08:33:44', speed: 49, plateRead: 'KLP21A', confidence: 0.9, slot: 12, fallback: 'offence-1.svg', flags: ['Program not configured: default checks applied'] },
];

export const REJECT_REASONS = ['Plate unreadable', 'Emergency or exempt vehicle', 'Image obscured', 'No certificate in force', 'Duplicate detection', 'Other'];

// Mock organisational identity providers (home realm discovery by email domain). ASSUMPTIONS, to be confirmed.
export const IDPS = {
  transport: {
    id: 'transport',
    domain: 'transport.nsw.gov.au',
    org: 'Transport for NSW',
    colour: '#002664',
    platform: 'Assumed: Microsoft Entra ID (Transport tenant)',
  },
  revenue: {
    id: 'revenue',
    domain: 'revenue.nsw.gov.au',
    org: 'Revenue NSW',
    colour: '#00405e',
    platform: 'Assumed: Revenue NSW’s own tenant, federated with Transport (B2B). To be confirmed.',
  },
};

export const ROLES = [
  {
    id: 'rnsw',
    name: 'Revenue NSW review officer',
    org: 'Revenue NSW',
    email: 'alex.chen@revenue.nsw.gov.au',
    idp: 'revenue',
    permissions: ['cert:search', 'cert:restricted', 'review'],
  },
  {
    id: 'tfnsw-adj',
    name: 'Transport adjudication officer',
    org: 'Transport for NSW',
    email: 'sam.patel@transport.nsw.gov.au',
    idp: 'transport',
    permissions: ['cert:search', 'cert:restricted', 'adjudicate'],
  },
  {
    id: 'tfnsw-ops',
    name: 'Transport camera operations officer',
    org: 'Transport for NSW',
    email: 'jo.nguyen@transport.nsw.gov.au',
    idp: 'transport',
    permissions: ['cert:search', 'cert:restricted', 'content:withdraw'],
  },
  {
    id: 'no-role',
    name: 'Transport staff member with no CEVOC role',
    org: 'Transport for NSW',
    email: 'riley.smith@transport.nsw.gov.au',
    idp: 'transport',
    permissions: [],
  },
];

export const SAMPLES = [
  { label: 'Fixed speed, 2 images, sample video', number: '3162457890', rego: 'CEV123' },
  { label: 'Red-light, withdrawn image, under review', number: '3162457891', rego: 'RLC456' },
  { label: 'Mobile speed, due in a few days', number: '3162457893', rego: 'MOB789' },
  { label: 'Heavy vehicle average speed', number: '3162457894', rego: 'HVY321' },
  { label: 'Unknown program (default view)', number: '3162457895', rego: 'NEW001' },
  { label: 'Image service down', number: '3162457896', rego: 'IMG404' },
  { label: 'Source system unavailable', number: '3162457892', rego: 'ERR999' },
];
