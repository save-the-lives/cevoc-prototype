// Enforcement program configuration. ILLUSTRATIVE ONLY: the program list, wording and rules
// must be validated with program owners and Revenue NSW before any real use.
//
// Rule: the DEFAULT applies unless a program explicitly overrides a setting.
// A notice with an unknown program code still works: it gets the default layout,
// evidence and actions, and is flagged as unconfigured.

export const DEFAULT_PROGRAM = {
  code: 'DEFAULT',
  label: 'Camera-detected offence',
  explainer:
    'A camera recorded your vehicle. This page shows when and where it happened, the images, and whether the camera was certified on that day.',
  measurement: 'none', // none | spot | average | signal
  evidence: { images: true, video: false, certificate: true },
  actions: ['pay', 'review', 'nominate', 'paymentPlan', 'court'],
  memoryJog: true,
  reviewChecklist: [
    'Camera certificate in force on the offence date',
    'Number plate in the image matches the registration',
    'Images are clear and complete',
  ],
};

export const PROGRAMS = {
  FIXED_SPEED: {
    label: 'Fixed speed camera',
    measurement: 'spot',
    explainer: 'A fixed camera measured your vehicle’s speed as it passed one point on the road.',
    reviewChecklist: [...DEFAULT_PROGRAM.reviewChecklist, 'Measured speed within device tolerance'],
  },
  MOBILE_SPEED: {
    label: 'Mobile speed camera',
    measurement: 'spot',
    explainer:
      'A mobile speed camera, operated from a vehicle parked beside the road, measured your speed as you passed one point.',
    reviewChecklist: [...DEFAULT_PROGRAM.reviewChecklist, 'Measured speed within device tolerance', 'Site was an approved mobile location on the day'],
  },
  AVERAGE_SPEED: {
    label: 'Average speed camera',
    measurement: 'average',
    explainer:
      'Cameras at two points recorded your vehicle. Your average speed was worked out from the distance between the cameras and the time you took to travel between them.',
    reviewChecklist: [
      'Both cameras certified on the offence date',
      'Clocks at both points synchronised',
      'Distance between points verified',
      'Number plate matches at both points',
    ],
  },
  RED_LIGHT: {
    label: 'Red-light camera',
    measurement: 'signal',
    explainer: 'This camera checks whether vehicles enter the intersection after the light has turned red.',
    reviewChecklist: [...DEFAULT_PROGRAM.reviewChecklist, 'Signal phase and timing recorded'],
  },
  RED_LIGHT_SPEED: {
    label: 'Red-light speed camera',
    measurement: 'signal',
    evidence: { video: true },
    explainer:
      'This camera checks both red lights and speed at an intersection. The images show the signal and where your vehicle was at each moment.',
    reviewChecklist: [...DEFAULT_PROGRAM.reviewChecklist, 'Signal phase and timing recorded', 'Measured speed within device tolerance'],
  },
  MOBILE_PHONE: {
    label: 'Mobile phone detection camera',
    measurement: 'none',
    explainer: 'A camera photographed the driver’s area of the vehicle. The images were checked by a person before this notice was issued.',
    reviewChecklist: [...DEFAULT_PROGRAM.reviewChecklist, 'Images reviewed by an authorised person', 'Privacy controls applied to occupants'],
  },
};

export const ACTIONS = {
  pay: { title: 'Pay the fine', text: 'Pay online with Revenue NSW. You can’t pay on this page.' },
  review: {
    title: 'Ask for a review',
    text: 'If you think the fine is wrong, or there were special circumstances, you can ask Revenue NSW to review it before the due date.',
  },
  nominate: {
    title: 'You weren’t driving',
    text: 'If someone else was driving, or you’d sold the vehicle, you can nominate the driver or tell Revenue NSW.',
  },
  paymentPlan: {
    title: 'Can’t pay it all now',
    text: 'Ask Revenue NSW about a payment plan, more time to pay, or hardship help. Doing this before the due date can stop extra fees.',
  },
  court: {
    title: 'Have a court decide',
    text: 'You can choose to have the matter heard in court. If the court finds against you, the penalty and costs can be higher.',
  },
};

export function programFor(code) {
  const p = PROGRAMS[code];
  return {
    ...DEFAULT_PROGRAM,
    ...(p || {}),
    evidence: { ...DEFAULT_PROGRAM.evidence, ...((p && p.evidence) || {}) },
    code: code || 'DEFAULT',
    known: !!p,
  };
}

// Keys a program changes compared with the default (used in the design studio).
export function overriddenKeys(code) {
  const p = PROGRAMS[code];
  return p ? Object.keys(p) : [];
}
