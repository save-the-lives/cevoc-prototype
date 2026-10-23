// ALL PEOPLE, ADDRESSES, BUSINESSES, SERIALS, SEALS AND AMOUNTS ARE FICTITIOUS.
// Structure follows the statutory certificates; content is invented for demonstration.

const AIO = {
  hart: { name: 'Rebecca Hart', id: 'AIO-20417' },
  okafor: { name: 'Daniel Okafor', id: 'AIO-31876' },
  lim: { name: 'Grace Lim', id: 'AIO-11209' },
  murray: { name: 'Callum Murray', id: 'AIO-40552 (mobile operator)' },
};

const GAZETTE = {
  speed: 'Government Gazette No 00 of 1 January 2013 (MOCK REFERENCE): approved for speed measurement',
  redlight: 'Government Gazette No 00 of 1 January 2013 (MOCK REFERENCE): approved for red traffic light detection',
  average: 'Government Gazette No 00 of 1 January 2013 (MOCK REFERENCE): approved for average speed detection',
};

const S138_CHECKS = [
  'Seals intact and serial numbers match the device record',
  'System clock synchronised to the time source',
  'Camera alignment and field of view correct',
  'Test photograph taken and reviewed',
  'Security indicator generated on the test photograph',
  'Data plate details legible on the test photograph',
];

const MOBILE_CHECKS = [
  'Seals intact and serial numbers match the device record',
  'GPS time synchronised',
  'Vehicle and camera positioned at approved site',
  'Radar alignment checked',
  'Tuning-fork / internal self-test passed',
  'Test photograph taken and reviewed',
  'Security indicator generated on the test photograph',
  'Site signage in place',
  'Operator log started',
];

export const LEGAL_CERTS = [
  // PAR-001 fixed speed
  { id: 'S137-PAR001-2026', rule: 's137', site: 'PAR-001', date: '2026-03-10', officer: AIO.hart, deviceSerial: 'SC-88412-M', sealNo: 'SEAL-774120', gazette: GAZETTE.speed },
  { id: 'S138-PAR001-0505', rule: 's138', site: 'PAR-001', date: '2026-05-05', officer: AIO.okafor, deviceSerial: 'SC-88412-M', checks: S138_CHECKS },
  { id: 'S138-PAR001-0830', rule: 's138', site: 'PAR-001', date: '2026-08-30', officer: AIO.okafor, deviceSerial: 'SC-88412-M', checks: S138_CHECKS },

  // RYD-014 red-light speed: separate speed and red-light inspections, video record
  { id: 'S137-RYD014-2026', rule: 's137', site: 'RYD-014', date: '2026-01-20', officer: AIO.lim, deviceSerial: 'RL-20577-K', sealNo: 'SEAL-551903', gazette: GAZETTE.speed },
  { id: 'S138S-RYD014-0714', rule: 's138', purpose: 'speed', site: 'RYD-014', date: '2026-07-14', officer: AIO.lim, deviceSerial: 'RL-20577-K', checks: S138_CHECKS, gazette: GAZETTE.speed },
  { id: 'S138R-RYD014-0714', rule: 's138', purpose: 'redlight', site: 'RYD-014', date: '2026-07-14', officer: AIO.lim, deviceSerial: 'RL-20577-K', checks: [...S138_CHECKS, 'Signal phase input verified against controller'], gazette: GAZETTE.redlight },
  { id: 'S257V-RYD014-0802', rule: 's257', purpose: 'video', site: 'RYD-014', date: '2026-08-02', officer: AIO.lim, description: 'Video recording of the incident retrieved from the camera system, with its security indicator.' },

  // LIV-207 fixed speed
  { id: 'S137-LIV207-2025', rule: 's137', site: 'LIV-207', date: '2025-11-02', officer: AIO.hart, deviceSerial: 'SC-90155-P', sealNo: 'SEAL-660218', gazette: GAZETTE.speed },
  { id: 'S138-LIV207-0820', rule: 's138', site: 'LIV-207', date: '2026-08-20', officer: AIO.okafor, deviceSerial: 'SC-90155-P', checks: S138_CHECKS },

  // MOB-312 mobile speed: pre-session inspection on the night of the offence
  { id: 'S137-MOB312-2025', rule: 's137', site: 'MOB-312', date: '2025-10-21', officer: AIO.lim, deviceSerial: 'MS-31204-V', sealNo: 'SEAL-902317', gazette: GAZETTE.speed },
  { id: 'S138M-MOB312-0904', rule: 's138', session: true, site: 'MOB-312', date: '2026-09-04', time: '21:05', officer: AIO.murray, deviceSerial: 'MS-31204-V', checks: MOBILE_CHECKS, sessionText: 'Enforcement session 21:05 to 23:30' },

  // AVG-HUM average speed: surveyor certificate plus inspections at both points
  { id: 'S132-AVGHUM-2020', rule: 's132', site: 'AVG-HUM', date: '2020-03-02', officer: { name: 'Michael Brennan', id: 'Registered Surveyor No 0000 (MOCK)' }, distanceKm: 18.0, limit: 100, heavyLimit: 90, description: 'Shortest practicable distance between Point A (northern camera) and Point B (southern camera).' },
  { id: 'S138A-AVGHUM-0729', rule: 's138', point: 'A', site: 'AVG-HUM', date: '2026-07-29', officer: AIO.hart, deviceSerial: 'AS-7710-A', checks: S138_CHECKS, gazette: GAZETTE.average },
  { id: 'S138B-AVGHUM-0729', rule: 's138', point: 'B', site: 'AVG-HUM', date: '2026-07-29', officer: AIO.hart, deviceSerial: 'AS-7711-B', checks: S138_CHECKS, gazette: GAZETTE.average },
  { id: 'S257S-AVGHUM-2026', rule: 's257', purpose: 'signage', site: 'AVG-HUM', date: '2026-04-15', officer: AIO.hart, description: 'Average speed zone signage at both points, as recorded on Transport’s sign register.' },

  // SCH-090 pilot: inspection deliberately LAPSED (97 days before the offence)
  { id: 'S137-SCH090-2026', rule: 's137', site: 'SCH-090', date: '2026-07-01', officer: AIO.okafor, deviceSerial: 'PL-00090-X', sealNo: 'SEAL-130090', gazette: GAZETTE.speed },
  { id: 'S138-SCH090-0701', rule: 's138', site: 'SCH-090', date: '2026-07-01', officer: AIO.okafor, deviceSerial: 'PL-00090-X', checks: S138_CHECKS },
];

// Mock penalty notice letters, keyed by notice number.
export const NOTICE_DOCS = {
  '3162457890': {
    to: ['Mia Rossi', '14 Kurrajong Close', 'MERRYLANDS NSW 2160'],
    offenceCode: '74703 (MOCK)', amount: 'XXX.00', demerits: 'X',
  },
  '3162457891': {
    to: ['Peter Nguyen', 'Unit 6, 22 Banksia Parade', 'RYDE NSW 2112'],
    offenceCode: '74726 (MOCK)', amount: 'XXX.00', demerits: 'X',
  },
  '3162457892': {
    to: ['Aisha Rahman', '3 Tallowwood Street', 'LIVERPOOL NSW 2170'],
    offenceCode: '74704 (MOCK)', amount: 'XXX.00', demerits: 'X',
  },
  '3162457893': {
    to: ['Thomas Kelly', '58 Wattlebird Crescent', 'KELLYVILLE NSW 2155'],
    offenceCode: '74704 (MOCK)', amount: 'XXX.00', demerits: 'X',
  },
  '3162457894': {
    to: ['The Registered Operator', 'Southern Ridge Haulage Pty Ltd', 'PO Box 000', 'GOULBURN NSW 2580'],
    note: 'Company-registered heavy vehicle. The operator can nominate the driver (in this scenario, Dave Morrison).',
    offenceCode: '74811 (MOCK)', amount: 'XXXX.00', demerits: 'X',
  },
  '3162457895': {
    to: ['Priya Sharma', '9 Lillypilly Lane', 'CASTLE HILL NSW 2154'],
    offenceCode: '74999 (MOCK)', amount: 'XXX.00', demerits: 'X',
  },
  '3162457896': {
    to: ['The Registered Operator', 'Fleetwise Rentals Pty Ltd', 'Attn: Lena Fischer, Fleet Coordinator', 'PO Box 000', 'PARRAMATTA NSW 2150'],
    note: 'Rental fleet vehicle. The operator can nominate the hirer.',
    offenceCode: '74704 (MOCK)', amount: 'XXX.00', demerits: 'X',
  },
};

// Deterministic MOCK security indicator (looks like SHA-256; not calculated from the image).
export function mockIndicator(seed) {
  let h = 0x811c9dc5;
  let out = '';
  for (let round = 0; out.length < 64; round++) {
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i) + round * 31;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return out.slice(0, 64).toUpperCase();
}
