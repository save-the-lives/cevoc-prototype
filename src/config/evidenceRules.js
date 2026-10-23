// Statutory evidence rules for camera-detected offences in NSW.
// Summary for prototyping only, NOT legal advice. Check current legislation before relying on it.
// Sources: Road Transport Act 2013 (NSW) ss 132, 137, 137A, 138, 257;
//          Road Transport (General) Regulation 2021 (NSW) cl 29.

export const RULES = {
  s137: {
    section: 's137',
    title: 'Speed measuring device certificate',
    law: 'Road Transport Act 2013 s137; Road Transport (General) Regulation 2021 cl 29(1)',
    windowDays: 365,
    windowText: 'within 12 months before the offence',
    plain: 'The device that measured the speed is approved, was tested and sealed, and was accurate and working properly.',
    publicLabel: 'Speed device tested and sealed',
  },
  s138: {
    section: 's138(2)',
    title: 'Camera inspection certificate',
    law: 'Road Transport Act 2013 s138(2); Road Transport (General) Regulation 2021 cl 29(4)',
    windowDays: 90,
    windowText: 'within 90 days before the photograph',
    plain: 'An appropriate inspection officer inspected the camera and found it operating correctly.',
    publicLabel: 'Camera inspected',
  },
  s138session: {
    section: 's138(2)',
    title: 'Pre-session camera inspection (mobile)',
    law: 'Road Transport Act 2013 s138(2); TfNSW operating practice for mobile cameras',
    sameDay: true,
    windowText: 'before the enforcement session on the day',
    plain: 'The operator inspected and tested the mobile camera before starting the enforcement session.',
    publicLabel: 'Camera checked before the session',
  },
  s132: {
    section: 's132',
    title: 'Average speed distance certificate',
    law: 'Road Transport Act 2013 s132',
    windowText: 'issued before the offence',
    plain: 'A registered surveyor certified the shortest practicable distance between the two cameras and the average speed limit.',
    publicLabel: 'Distance between cameras surveyed',
  },
  s257: {
    section: 's257',
    title: 'Certificate of Transport records',
    law: 'Road Transport Act 2013 s257',
    onRequest: true,
    windowText: 'prepared if the matter goes to court',
    plain: 'A certified extract of Transport records, such as signage, video or security-indicator records.',
    publicLabel: 'Supporting records',
  },
};

// Image security indicator (s138(1), cl 29(3)): a fixed-length hash printed on digital photographs.
export const SECURITY_INDICATOR = {
  law: 'Road Transport Act 2013 s138(1); Road Transport (General) Regulation 2021 cl 29(3)',
  plain: 'Each digital photograph carries a code calculated from the image file (for example a 64-character SHA-256 value). Any change to the image would change the code.',
};

const DEFAULT_REQUIRED = [{ rule: 's137' }, { rule: 's138' }];

// What each enforcement program needs. Unknown programs get the default and are flagged.
export const REQUIRED = {
  FIXED_SPEED: [{ rule: 's137' }, { rule: 's138' }],
  MOBILE_SPEED: [{ rule: 's137' }, { rule: 's138session' }],
  AVERAGE_SPEED: [
    { rule: 's132' },
    { rule: 's138', point: 'A', label: 'Point A' },
    { rule: 's138', point: 'B', label: 'Point B' },
    { rule: 's257', purpose: 'signage', label: 'signage' },
  ],
  RED_LIGHT: [{ rule: 's138', purpose: 'redlight', label: 'red light' }],
  RED_LIGHT_SPEED: [
    { rule: 's137' },
    { rule: 's138', purpose: 'speed', label: 'speed' },
    { rule: 's138', purpose: 'redlight', label: 'red light' },
    { rule: 's257', purpose: 'video', label: 'video' },
  ],
  MOBILE_PHONE: [{ rule: 's138' }, { rule: 's257', purpose: 'security', label: 'security indicator' }],
};

export const requiredFor = (code) => ({ list: REQUIRED[code] || DEFAULT_REQUIRED, known: !!REQUIRED[code] });
