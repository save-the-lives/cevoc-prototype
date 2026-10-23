// ALL DATA IN THIS FILE IS FICTITIOUS AND FOR DEMONSTRATION ONLY.
// Image `slot` values map to entries in public/assets/manifest.json (fetched/supplied assets).
// If no manifest image exists for a slot, the `fallback` placeholder in public/assets/placeholders is used.
// Publication `status`: published | restricted | withdrawn | future

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
];

export const NOTICES = [
  {
    number: '3162457890',
    rego: 'CEV123',
    offence: 'Exceed speed limit by 10 km/h or less',
    dateTime: '2026-09-18T07:42:13',
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
    offence: 'Proceed through red traffic light',
    dateTime: '2026-08-02T18:05:47',
    site: 'RYD-014',
    recordedSpeed: 54,
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
    offence: 'Exceed speed limit by more than 10 km/h',
    dateTime: '2026-10-01T13:20:05',
    site: 'LIV-207',
    recordedSpeed: 83,
    vehicle: 'Passenger vehicle',
    upstreamFailure: true, // demonstrates source-system unavailability for one record
    images: [],
    media: [],
  },
];

export const ROLES = [
  {
    id: 'rnsw',
    name: 'Revenue NSW adjudication officer',
    org: 'Revenue NSW',
    permissions: ['cert:search', 'cert:restricted'],
  },
  {
    id: 'tfnsw-ops',
    name: 'Transport camera operations officer',
    org: 'Transport for NSW',
    permissions: ['cert:search', 'cert:restricted', 'content:withdraw'],
  },
  {
    id: 'no-role',
    name: 'Transport staff member with no CEVOC role',
    org: 'Transport for NSW',
    permissions: [],
  },
];

export const SAMPLES = [
  { label: 'Speed offence (2 images, sample video)', number: '3162457890', rego: 'CEV123' },
  { label: 'Red-light offence (1 withdrawn image, sample video)', number: '3162457891', rego: 'RLC456' },
  { label: 'Source system unavailable', number: '3162457892', rego: 'ERR999' },
];
