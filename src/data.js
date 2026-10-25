// ALL PEOPLE, VEHICLES, SERIALS AND AMOUNTS ARE FICTITIOUS. Demonstration data only.

import SIZES from './media-sizes.json';

const M = (file) => `assets/media/${file}`;
const kb = (file) => `${SIZES[file] || 50} KB`;

export const PROGRAMS = {
  FIXED_SPEED: {
    label: 'Fixed digital speed camera',
    how: 'A fixed camera measured the vehicle’s speed as it passed one point on the road.',
    measureLabel: 'Speed at one point',
  },
  MOBILE_SPEED: {
    label: 'Mobile speed camera',
    how: 'A camera in a parked, signposted vehicle measured the speed as the vehicle passed. The operator checks the camera before every session.',
    measureLabel: 'Speed at one point',
  },
  RED_LIGHT_SPEED: {
    label: 'Red light speed camera',
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

const img = (id, file, caption) => ({ id, type: 'image', src: M(file), caption, size: kb(file), ext: 'JPG' });
const vid = (id, file, caption, description) => ({ id, type: 'video', description, src: M(`${file}.mp4`), poster: M(`${file}-poster.jpg`), caption, size: kb(`${file}.mp4`), ext: 'MP4' });

export const NOTICES = [
  {
    number: '3162457890', rego: 'CEV123', site: 'PAR-001', dateTime: '2026-09-18T07:42:13', issued: '2026-10-02', due: '2026-11-13',
    offence: 'Exceed speed limit by 10 km/h or less', speed: 68, vehicle: 'Passenger vehicle', holder: 'Mia Rossi', plateConfidence: 0.98,
    media: [img('IMG-0901', 'cev123-scene.jpg', 'Vehicle in the detection zone'), img('IMG-0902', 'cev123-plate.jpg', 'Number plate close-up'), img('IMG-0903', 'cev123-wide.jpg', 'Wider view of the road')],
  },
  {
    number: '3162457893', rego: 'MOB789', site: 'MOB-312', dateTime: '2026-09-04T22:16:40', issued: '2026-09-28', due: '2026-11-06',
    offence: 'Exceed speed limit by more than 10 km/h', speed: 81, vehicle: 'Passenger vehicle', holder: 'Liam Walsh', plateConfidence: 0.97,
    media: [img('IMG-3101', 'mob789-scene.jpg', 'Vehicle passing the mobile camera'), img('IMG-3102', 'mob789-plate.jpg', 'Number plate close-up'), img('IMG-3103', 'mob789-site.jpg', 'Camera set up at the site'), vid('VID-3101', 'mob789-video', 'Approach video, 8 seconds', 'No sound. The camera view slowly moves in on a dark station wagon driving towards the camera on a wet road at night, headlights on, with the number plate MOB789 visible.')],
  },
  {
    number: '3162457891', rego: 'RLC456', site: 'RYD-014', dateTime: '2026-08-02T18:05:47', issued: '2026-08-21', due: '2026-10-30',
    offence: 'Proceed through red traffic light', speed: 54, redFor: 3.2, vehicle: 'Passenger vehicle', holder: 'Thomas Kelly', plateConfidence: 0.95,
    media: [img('IMG-0811', 'rlc456-red1.jpg', 'Approaching the stop line, red for 2.1 seconds'), img('IMG-0812', 'rlc456-red2.jpg', 'Crossing the stop line, red for 3.2 seconds'), img('IMG-0813', 'rlc456-plate.jpg', 'Number plate close-up'), img('IMG-0814', 'rlc456-wide.jpg', 'Wider view of the intersection'), vid('VID-0811', 'rlc456-video', 'Signal sequence video, 8 seconds', 'No sound. Three camera frames, each shown for about three seconds with a slow zoom: two vehicles approaching the stop line, then mid-way, then past it. The time since the light turned red is shown at the top of each frame.')],
  },
  {
    number: '3162457894', rego: 'HVY321', site: 'AVG-HUM', dateTime: '2026-09-11T03:48:00', issued: '2026-10-01', due: '2026-11-12',
    offence: 'Commercial vehicle exceed average speed limit', speed: 108, vehicle: 'Light commercial vehicle (ute)', holder: 'Southern Ridge Contracting Pty Ltd', plateConfidence: 0.96,
    segment: { distanceKm: 18, timeA: '03:38:00', timeB: '03:48:00' },
    media: [img('IMG-HV01', 'hvy321-pointa.jpg', 'Point A, 3:38:00 am'), img('IMG-HV02', 'hvy321-pointb.jpg', 'Point B, 3:48:00 am'), img('IMG-HV03', 'hvy321-plate.jpg', 'Number plate close-up')],
  },
  {
    number: '3162457897', rego: 'PHN555', site: 'PHN-M4', dateTime: '2026-09-23T08:12:05', issued: '2026-10-09', due: '2026-11-20',
    offence: 'Use mobile phone while driving', vehicle: 'Passenger vehicle', holder: 'Hannah Okoro', plateConfidence: 0.99, personChecked: true,
    media: [img('IMG-PH01', 'phn555-driver.jpg', 'Driver area (passenger blurred)'), img('IMG-PH02', 'phn555-plate.jpg', 'Number plate close-up')],
  },
];

const NOTICE_BY = (n) => NOTICES.find((x) => x.number === n);
const clone = (from, over) => { const b = NOTICE_BY(from); NOTICES.push({ ...b, ...over, media: over.media || b.media.map((m) => ({ ...m, id: `${m.id}-${over.number.slice(-3)}` })) }); };
clone('3162457891', { number: '3162457898', rego: 'RED777', dateTime: '2026-09-02T17:20:11', issued: '2026-09-25', due: '2026-11-03', holder: 'Priya Nair', speed: 49, redFor: 1.4,
  media: [img('IMG-0821', 'red777-red1.jpg', 'Approaching the stop line, red for 0.6 seconds'), img('IMG-0822', 'red777-red2.jpg', 'Crossing the stop line, red for 1.4 seconds'), img('IMG-0823', 'red777-plate.jpg', 'Number plate close-up')] });
clone('3162457890', { number: '3162457899', rego: 'SPD404', dateTime: '2026-08-14T06:55:30', issued: '2026-09-02', due: '2026-10-28', holder: 'Ben Carter', speed: 71, offence: 'Exceed speed limit by more than 10 km/h',
  media: [img('IMG-0911', 'spd404-scene.jpg', 'Vehicle in the detection zone'), img('IMG-0912', 'spd404-plate.jpg', 'Number plate close-up'), img('IMG-0913', 'spd404-wide.jpg', 'Wider view of the road')] });
clone('3162457893', { number: '3162457900', rego: 'MOB205', dateTime: '2026-09-12T20:41:02', issued: '2026-10-05', due: '2026-11-16', holder: 'Sofia Marino', speed: 79,
  media: [img('IMG-3201', 'mob205-scene.jpg', 'Vehicle passing the mobile camera'), img('IMG-3202', 'mob205-plate.jpg', 'Number plate close-up'), img('IMG-3203', 'mob205-site.jpg', 'Camera set up at the site')] });
clone('3162457897', { number: '3162457901', rego: 'PHN808', dateTime: '2026-10-01T07:35:44', issued: '2026-10-15', due: '2026-11-26', holder: 'Daniel Park',
  media: [img('IMG-PH11', 'phn808-driver.jpg', 'Driver area (passenger blurred)'), img('IMG-PH12', 'phn808-plate.jpg', 'Number plate close-up')] });
clone('3162457894', { number: '3162457902', rego: 'HVY654', dateTime: '2026-09-25T02:12:00', issued: '2026-10-12', due: '2026-11-23', holder: 'Outback Freight Pty Ltd', speed: 104, vehicle: 'Light commercial vehicle (van)', segment: { distanceKm: 18, timeA: '02:02:00', timeB: '02:12:00' },
  media: [img('IMG-HV11', 'hvy654-pointa.jpg', 'Point A, 2:02:00 am'), img('IMG-HV12', 'hvy654-pointb.jpg', 'Point B, 2:12:00 am'), img('IMG-HV13', 'hvy654-plate.jpg', 'Number plate close-up')] });

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
    context: 'Red light speed camera at Ryde. Review already lodged.',
    pain: 'Believes he couldn’t stop safely. Wants the full sequence.',
    job: 'When I dispute a red-light fine, I want to watch what happened and check the camera, so my review is based on facts.',
    hasVideo: true, issue: 'Camera inspection was 123 days old (limit 90).',
  },
  {
    notice: '3162457894', title: 'Average speed, work vehicle', persona: 'Southern Ridge Contracting, fleet manager',
    context: 'Work ute on the Hume Highway at 3:48 am. The driver says the logbook shows otherwise.',
    pain: 'Livelihood at risk. Needs to know how the average was worked out before nominating or going to court.',
    job: 'When a vehicle in my fleet is fined, I want the timing and distance between the cameras, so I can decide whether to contest.',
  },
  {
    notice: '3162457897', title: 'Mobile phone detection', persona: 'Hannah, says she was holding a drink bottle',
    context: 'M4 at Homebush, morning peak.',
    pain: 'Feels watched. Unsure a person ever looked at the photo. Worried about passenger privacy.',
    job: 'When I’m fined for a phone offence, I want to see the image a person checked, so I know it wasn’t just a machine.',
  },
];

// priority: high | normal | low. assignee is a STAFF id or null. SLA is worked out from lodged date and type.
export const CASES = [
  { id: 'RV-24017', category: 'Signal timing', type: 'review', notice: '3162457891', lodged: '2026-09-10', channel: 'Online form', priority: 'high', assignee: 'alex',
    grounds: 'The light turned amber as I got there and I couldn’t stop safely.' },
  { id: 'RV-24021', category: 'Image check by a person', type: 'review', notice: '3162457897', lodged: '2026-10-14', channel: 'Phone (contact centre note)', priority: 'normal', assignee: null,
    grounds: 'I was holding a drink bottle, not a phone. I want to see the photo a person checked.' },
  { id: 'RV-24022', category: 'Signal timing', type: 'review', notice: '3162457898', lodged: '2026-10-02', channel: 'Online form', priority: 'high', assignee: null,
    grounds: 'The signal was amber for barely a second. I think the timing is wrong.' },
  { id: 'RV-24023', category: 'Safety and overtaking', type: 'review', notice: '3162457899', lodged: '2026-09-29', channel: 'Letter', priority: 'normal', assignee: 'sam',
    grounds: 'I was overtaking a truck and had to speed up briefly to get back in lane.' },
  { id: 'RV-24024', category: 'Signage', type: 'review', notice: '3162457900', lodged: '2026-10-09', channel: 'Online form', priority: 'normal', assignee: 'jordan',
    grounds: 'I did not see a warning sign for a mobile camera on Windsor Road.' },
  { id: 'RV-24025', category: 'Phone use circumstances', type: 'review', notice: '3162457901', lodged: '2026-10-19', channel: 'Online form', priority: 'low', assignee: null,
    grounds: 'My phone was mounted in a cradle and I was using it for navigation.' },
  { id: 'RV-24026', category: 'Not the driver', type: 'review', notice: '3162457890', lodged: '2026-10-21', channel: 'Online form', priority: 'low', assignee: null,
    grounds: 'I was not driving. I have asked my brother to nominate himself.' },
  { id: 'CE-24019', category: 'Timing between cameras', type: 'court', notice: '3162457894', lodged: '2026-10-18', channel: 'Online form', priority: 'high', assignee: 'jordan',
    grounds: 'We run work vehicles on the highway. Our driver’s logbook shows they were within limits. The timing between the cameras must be wrong.' },
  { id: 'CE-24020', category: 'Surveyed distance', type: 'court', notice: '3162457902', lodged: '2026-10-05', channel: 'Letter', priority: 'normal', assignee: null,
    grounds: 'The company disputes the surveyed distance between the two cameras.' },
  { id: 'CE-24023', category: 'Camera certification', type: 'court', notice: '3162457899', lodged: '2026-10-16', channel: 'Online form', priority: 'low', assignee: 'alex',
    grounds: 'I want a magistrate to hear this. The camera was not certified on the day.' },
];

// Staff personas. No passwords. Permissions drive what each can do; everything else is a hand-off.
export const STAFF = [
  // Transport for NSW
  { id: 'jo', name: 'Jo Nguyen', org: 'Transport for NSW', agency: 'tfnsw', role: 'Customer inquiry officer', perms: ['inspect:request'] },
  { id: 'kai', name: 'Kai Okoro', org: 'Transport for NSW', agency: 'tfnsw', role: 'Technical systems advisor', perms: ['withdraw:request', 'inspect:request'] },
  { id: 'dana', name: 'Dana Whitfield', org: 'Transport for NSW', agency: 'tfnsw', role: 'Adjudication officer', perms: ['inspect:request'] },
  { id: 'morgan', name: 'Morgan Smith', org: 'Transport for NSW', agency: 'tfnsw', role: 'Camera program manager', perms: ['withdraw:request', 'withdraw:approve', 'withdraw:determine', 'inspect:request', 'team:manage'] },
  { id: 'sasha', name: 'Sasha Ivanov', org: 'Transport for NSW', agency: 'tfnsw', role: 'Technical assurance manager', perms: ['withdraw:request', 'withdraw:approve', 'withdraw:determine', 'inspect:request', 'team:manage'] },
  // Revenue NSW. Managers (team:manage) can assign work to others and see team workload.
  { id: 'alex', name: 'Alex Chen', org: 'Revenue NSW', agency: 'rnsw', role: 'Review officer', perms: ['case:decide'] },
  { id: 'sam', name: 'Sam Patel', org: 'Revenue NSW', agency: 'rnsw', role: 'Review officer', perms: ['case:decide'] },
  { id: 'jordan', name: 'Jordan Lee', org: 'Revenue NSW', agency: 'rnsw', role: 'Prosecutions officer', perms: ['case:decide'] },
  { id: 'priya', name: 'Priya Raman', org: 'Revenue NSW', agency: 'rnsw', role: 'Review manager', perms: ['case:decide', 'team:manage'] },
  { id: 'chris', name: 'Chris Walker', org: 'Revenue NSW', agency: 'rnsw', role: 'Operations manager', perms: ['team:manage'] },
];
export const agencyShort = (u) => (u.agency === 'rnsw' ? 'Revenue' : 'Transport');

export const WITHDRAW_REASONS = ['Calibration fault found after inspection', 'Certificate issued in error', 'Superseded by a reissued certificate', 'Legal direction', 'Other'];

export const site = (code) => SITES.find((s) => s.code === code);
export const notice = (n) => NOTICES.find((x) => x.number === n);
export const cert = (id) => CERTS.find((c) => c.id === id);
export const kase = (id) => CASES.find((c) => c.id === id);
export const staff = (id) => STAFF.find((p) => p.id === id);

// Technical requests: Revenue NSW asks Transport a specific technical question about a camera. Revenue keeps the
// customer case and makes the final decision; Transport only advises. These are simulated seed items.
// status: AWAITING_TRANSPORT | MORE_INFORMATION_REQUIRED | ADVICE_RECEIVED | CANCELLED
export const TECH_CATEGORIES = [
  ['certification', 'Certification'], ['evidence', 'Image or evidence'], ['operation', 'Camera operation'],
  ['site', 'Site configuration'], ['timing', 'Timing or calculation'], ['court', 'Court election: defence preparation'], ['other', 'Other'],
];
const HOUR = 3600e3;
const ago = (h) => Date.now() - h * HOUR;
const dateOf = (ms) => new Date(ms).toISOString().slice(0, 10);
export const TECH_SEED = [
  { id: 'TR-3002', caseId: 'CE-24020', notice: '3162457902', site: 'AVG-HUM', category: 'timing', by: 'jordan', assignee: null, at: dateOf(ago(72)),
    summary: 'Is the 18 km surveyed distance the one in force for this notice?',
    question: 'The company disputes the surveyed distance between the two cameras. Please confirm the surveyed distance in force on 25 September 2026 and how the average speed was calculated.',
    status: 'AWAITING_TRANSPORT', thread: [], log: [{ at: ago(72), type: 'requested', by: 'jordan' }] },
  { id: 'TR-3001', caseId: 'CE-24023', notice: '3162457899', site: 'PAR-001', category: 'certification', by: 'alex', assignee: 'jo', at: dateOf(ago(50)),
    summary: 'Was the inspection certificate in force on 14 August?',
    question: 'The customer says the camera was not certified on the day. Please confirm which inspection certificate applied at 06:55 on 14 August 2026.',
    status: 'INVESTIGATING', thread: [], log: [{ at: ago(50), type: 'requested', by: 'alex' }, { at: ago(47), type: 'acknowledged', by: 'jo' }, { at: ago(20), type: 'investigating', by: 'jo' }] },
  { id: 'TR-2991', caseId: 'RV-23988', notice: '3162457897', site: 'PHN-M4', category: 'evidence', by: 'alex', assignee: 'jo', at: '2026-09-18',
    summary: 'Was a person involved in checking the phone-detection image?',
    question: 'The customer asks whether a person ever looked at the image. Is the person-check recorded, and can it be shown to the customer?',
    status: 'ADVICE_RECEIVED', thread: [], actioned: { by: 'alex', at: '2026-09-24' },
    log: [{ at: ago(24 * 36), type: 'requested', by: 'alex' }, { at: ago(24 * 36 - 2), type: 'acknowledged', by: 'jo' }, { at: ago(24 * 35), type: 'investigating', by: 'jo' }, { at: ago(24 * 33), type: 'assessed', by: 'jo' }, { at: ago(24 * 32), type: 'determination', by: 'morgan' }, { at: ago(24 * 31), type: 'actioned', by: 'alex' }],
    response: { by: 'morgan', at: '2026-09-22', recommendation: 'valid', outcome: 'supportable', rationale: 'The person-check record is held and matches the notice.',
      advice: 'Every phone-detection image is checked by an authorised adjudicator before a notice is issued. The adjudicator ID and check time are recorded in the evidence metadata (“Person check”), and that record can be quoted to the customer.',
      scope: 'Applies to any notice from camera PHN-M4 where the metadata shows a person check. It does not apply if the person-check record is missing.' } },
];
