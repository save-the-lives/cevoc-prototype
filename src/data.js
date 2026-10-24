// ALL PEOPLE, VEHICLES, SERIALS AND AMOUNTS ARE FICTITIOUS. Demonstration data only.

const M = (file) => `assets/media/${file}`;

export const PROGRAMS = {
  FIXED_SPEED: {
    label: 'Fixed speed camera',
    how: 'A fixed camera measured the vehicle’s speed as it passed one point on the road.',
    measureLabel: 'Speed at one point',
  },
  MOBILE_SPEED: {
    label: 'Mobile speed camera',
    how: 'A camera in a parked, signposted vehicle measured the speed as the vehicle passed. The operator checks the camera before every session.',
    measureLabel: 'Speed at one point',
  },
  RED_LIGHT_SPEED: {
    label: 'Red-light speed camera',
    how: 'This camera checks red lights and speed at an intersection. The photos show the signal and where the vehicle was at each moment.',
    measureLabel: 'Time the light had been red',
  },
  AVERAGE_SPEED: {
    label: 'Average speed camera',
    how: 'Cameras at two points recorded the vehicle. Average speed is the surveyed distance between the cameras divided by the time taken.',
    measureLabel: 'Average speed between two points',
  },
  MOBILE_PHONE: {
    label: 'Mobile phone detection camera',
    how: 'A camera photographed the driver’s area. A trained person checked the images before the notice was issued. Passengers are blurred.',
    measureLabel: 'Person-checked image',
  },
};

export const SITES = [
  { code: 'PAR-001', name: 'Parramatta Road, Granville', suburb: 'Granville', direction: 'Eastbound', program: 'FIXED_SPEED', limit: 60, serial: 'SC-88412-M' },
  { code: 'MOB-312', name: 'Windsor Road, Kellyville (mobile site)', suburb: 'Kellyville', direction: 'Northbound', program: 'MOBILE_SPEED', limit: 70, serial: 'MS-31204-V' },
  { code: 'RYD-014', name: 'Victoria Road, Ryde', suburb: 'Ryde', direction: 'Westbound', program: 'RED_LIGHT_SPEED', limit: 60, serial: 'RL-20577-K' },
  { code: 'AVG-HUM', name: 'Hume Highway average speed length', suburb: 'Southern Highlands', direction: 'Southbound', program: 'AVERAGE_SPEED', limit: 100, heavyLimit: 90, serial: 'AS-7710-A / AS-7711-B' },
  { code: 'PHN-M4', name: 'M4 Motorway, Homebush', suburb: 'Homebush', direction: 'Westbound', program: 'MOBILE_PHONE', limit: 90, serial: 'MP-40411-D' },
];

// Certificates (Road Transport Act 2013 ss132, 137, 138(2)). status: published | withdrawn
export const CERTS = [
  { id: 'S137-PAR001-2026', site: 'PAR-001', section: 's137', date: '2026-03-10', officer: 'Rebecca Hart (AIO-20417)', status: 'published' },
  { id: 'S138-PAR001-0830', site: 'PAR-001', section: 's138', date: '2026-08-30', officer: 'Daniel Okafor (AIO-31876)', status: 'published' },
  { id: 'S137-MOB312-2025', site: 'MOB-312', section: 's137', date: '2025-10-21', officer: 'Grace Lim (AIO-11209)', status: 'published' },
  { id: 'S138M-MOB312-0904', site: 'MOB-312', section: 's138', session: true, date: '2026-09-04', time: '21:05', officer: 'Callum Murray (mobile operator)', status: 'published' },
  { id: 'S137-RYD014-2026', site: 'RYD-014', section: 's137', date: '2026-01-20', officer: 'Grace Lim (AIO-11209)', status: 'published' },
  { id: 'S138-RYD014-0401', site: 'RYD-014', section: 's138', date: '2026-04-01', officer: 'Grace Lim (AIO-11209)', status: 'published' },
  { id: 'S132-AVGHUM-2020', site: 'AVG-HUM', section: 's132', date: '2020-03-02', officer: 'Michael Brennan, registered surveyor (mock)', status: 'published', distanceKm: 18 },
  { id: 'S138A-AVGHUM-0729', site: 'AVG-HUM', section: 's138', point: 'A', date: '2026-07-29', officer: 'Rebecca Hart (AIO-20417)', status: 'published' },
  { id: 'S138B-AVGHUM-0729', site: 'AVG-HUM', section: 's138', point: 'B', date: '2026-07-29', officer: 'Rebecca Hart (AIO-20417)', status: 'published' },
  { id: 'S138-PHNM4-0812', site: 'PHN-M4', section: 's138', date: '2026-08-12', officer: 'Daniel Okafor (AIO-31876)', status: 'published' },
];

const img = (id, file, caption) => ({ id, type: 'image', src: M(file), caption, size: '50 KB', ext: 'JPG' });
const vid = (id, file, caption) => ({ id, type: 'video', src: M(`${file}.mp4`), poster: M(`${file}-poster.jpg`), caption, size: '40 KB', ext: 'MP4' });

export const NOTICES = [
  {
    number: '3162457890', rego: 'CEV123', site: 'PAR-001', dateTime: '2026-09-18T07:42:13', issued: '2026-10-02', due: '2026-11-13',
    offence: 'Exceed speed limit by 10 km/h or less', speed: 68, vehicle: 'Passenger vehicle', holder: 'Mia Rossi', plateConfidence: 0.98,
    media: [img('IMG-0901', 'cev123-scene.jpg', 'Vehicle in the detection zone'), img('IMG-0902', 'cev123-plate.jpg', 'Number plate close-up')],
  },
  {
    number: '3162457893', rego: 'MOB789', site: 'MOB-312', dateTime: '2026-09-04T22:16:40', issued: '2026-09-28', due: '2026-11-06',
    offence: 'Exceed speed limit by more than 10 km/h', speed: 81, vehicle: 'Passenger vehicle', holder: 'Liam Walsh', plateConfidence: 0.97,
    media: [img('IMG-3101', 'mob789-scene.jpg', 'Vehicle passing the mobile camera'), img('IMG-3102', 'mob789-plate.jpg', 'Number plate close-up'), vid('VID-3101', 'mob789-video', 'Approach video, 8 seconds')],
  },
  {
    number: '3162457891', rego: 'RLC456', site: 'RYD-014', dateTime: '2026-08-02T18:05:47', issued: '2026-08-21', due: '2026-10-30',
    offence: 'Proceed through red traffic light', speed: 54, redFor: 3.2, vehicle: 'Passenger vehicle', holder: 'Thomas Kelly', plateConfidence: 0.95,
    media: [img('IMG-0811', 'rlc456-red1.jpg', 'Before the stop line, signal red'), img('IMG-0812', 'rlc456-red2.jpg', 'In the intersection'), img('IMG-0813', 'rlc456-plate.jpg', 'Number plate close-up'), vid('VID-0811', 'rlc456-video', 'Signal sequence video, 8 seconds')],
  },
  {
    number: '3162457894', rego: 'HVY321', site: 'AVG-HUM', dateTime: '2026-09-11T03:48:00', issued: '2026-10-01', due: '2026-11-12',
    offence: 'Heavy vehicle exceed average speed limit', speed: 108, vehicle: 'Heavy vehicle (prime mover)', holder: 'Southern Ridge Haulage Pty Ltd', plateConfidence: 0.96,
    segment: { distanceKm: 18, timeA: '03:38:00', timeB: '03:48:00' },
    media: [img('IMG-HV01', 'hvy321-pointa.jpg', 'Point A, 3:38:00 am'), img('IMG-HV02', 'hvy321-pointb.jpg', 'Point B, 3:48:00 am'), img('IMG-HV03', 'hvy321-plate.jpg', 'Number plate close-up')],
  },
  {
    number: '3162457897', rego: 'PHN555', site: 'PHN-M4', dateTime: '2026-09-23T08:12:05', issued: '2026-10-09', due: '2026-11-20',
    offence: 'Use mobile phone while driving', vehicle: 'Passenger vehicle', holder: 'Hannah Okoro', plateConfidence: 0.99, personChecked: true,
    media: [img('IMG-PH01', 'phn555-driver.jpg', 'Driver area (passenger blurred)'), img('IMG-PH02', 'phn555-plate.jpg', 'Number plate close-up')],
  },
];

// Scenarios: one per camera program, framed for design conversations.
export const SCENARIOS = [
  {
    notice: '3162457890', title: 'I don’t remember this trip', persona: 'Mia, office worker, first fine in years',
    context: 'Letter arrived two weeks after a morning commute through Granville.',
    pain: 'Can’t remember the trip. Worried it’s a mistake or a scam.',
    job: 'When a fine arrives for a trip I can’t recall, I want to see exactly when, where and which car, so I can decide whether it’s fair.',
  },
  {
    notice: '3162457893', title: 'Caught at night by a mobile camera', persona: 'Liam, tradie, needs his licence for work',
    context: 'Mobile camera on Windsor Road late on a Friday.',
    pain: 'Thinks mobile cameras are hidden revenue raisers. Wants proof it was set up properly.',
    job: 'When I’m fined by a mobile camera, I want to see the camera was checked that night, so I can trust the result.',
    hasVideo: true,
  },
  {
    notice: '3162457891', title: 'Was the camera even certified?', persona: 'Thomas, says the light turned amber as he arrived',
    context: 'Red-light speed camera at Ryde. Review already lodged.',
    pain: 'Believes he couldn’t stop safely. Wants the full sequence.',
    job: 'When I dispute a red-light fine, I want to watch what happened and check the camera, so my review is based on facts.',
    hasVideo: true, issue: 'Camera inspection was 123 days old (limit 90).',
  },
  {
    notice: '3162457894', title: 'Average speed, heavy vehicle', persona: 'Southern Ridge Haulage, fleet manager',
    context: 'Prime mover on the Hume Highway at 3:48 am. Driver says logbook shows otherwise.',
    pain: 'Livelihood at risk. Needs to know how the average was worked out before nominating or going to court.',
    job: 'When a truck in my fleet is fined, I want the timing and distance between the cameras, so I can decide whether to contest.',
  },
  {
    notice: '3162457897', title: 'Mobile phone detection', persona: 'Hannah, says she was holding a drink bottle',
    context: 'M4 at Homebush, morning peak.',
    pain: 'Feels watched. Unsure a person ever looked at the photo. Worried about passenger privacy.',
    job: 'When I’m fined for a phone offence, I want to see the image a person checked, so I know it wasn’t just a machine.',
  },
];

export const CASES = [
  { id: 'RV-24017', type: 'review', notice: '3162457891', lodged: '2026-09-10', channel: 'Online form',
    grounds: 'The light turned amber as I got there and I couldn’t stop safely.' },
  { id: 'RV-24021', type: 'review', notice: '3162457897', lodged: '2026-10-14', channel: 'Phone (contact centre note)',
    grounds: 'I was holding a drink bottle, not a phone. I want to see the photo a person checked.' },
  { id: 'CE-24019', type: 'court', notice: '3162457894', lodged: '2026-10-18', channel: 'Online form',
    grounds: 'I drive trucks for a living. My logbook shows I was within limits. The timing between the cameras must be wrong.' },
];

// Staff personas. No passwords. Permissions drive what each can do; everything else is a hand-off.
export const STAFF = [
  { id: 'jo', name: 'Jo Nguyen', org: 'Transport for NSW', agency: 'tfnsw', role: 'Camera operations officer', perms: ['withdraw:request', 'inspect:request'] },
  { id: 'morgan', name: 'Morgan Smith', org: 'Transport for NSW', agency: 'tfnsw', role: 'Camera program manager', perms: ['withdraw:request', 'withdraw:approve', 'inspect:request'] },
  { id: 'alex', name: 'Alex Chen', org: 'Revenue NSW', agency: 'rnsw', role: 'Review officer', perms: ['case:decide'] },
  { id: 'jordan', name: 'Jordan Lee', org: 'Revenue NSW', agency: 'rnsw', role: 'Prosecutions officer', perms: ['case:decide'] },
];

export const WITHDRAW_REASONS = ['Calibration fault found after inspection', 'Certificate issued in error', 'Superseded by a reissued certificate', 'Legal direction', 'Other'];

export const site = (code) => SITES.find((s) => s.code === code);
export const notice = (n) => NOTICES.find((x) => x.number === n);
export const cert = (id) => CERTS.find((c) => c.id === id);
export const kase = (id) => CASES.find((c) => c.id === id);
export const staff = (id) => STAFF.find((p) => p.id === id);
