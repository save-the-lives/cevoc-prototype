// Plain-English teaching content for the "How it was measured" section, one set per camera program.
// ILLUSTRATIVE copy for the prototype: wording needs sign-off from the program owners and Legal.

export const CARDS = {
  FIXED_SPEED: [
    { icon: 'pin', title: 'It never moves', text: 'A fixed camera is mounted at one spot, so the road, the lane and the limit are always the same.' },
    { icon: 'check', title: 'Tested and sealed', text: 'The speed device is tested and sealed before it can be used for fines, and again within 12 months.', link: 'q4', linkText: 'See this camera’s certificates' },
    { icon: 'eye', title: 'Inspected regularly', text: 'The whole camera is inspected within 90 days of any offence it records.' },
  ],
  MOBILE_SPEED: [
    { icon: 'sign', title: 'Signposted', text: 'Mobile cameras work from a parked, signposted vehicle, so drivers are told they may be in a camera zone.' },
    { icon: 'check', title: 'Checked before every session', text: 'The operator checks the camera before every session. That check is recorded, and a reading is only used if it was done.', link: 'q4', linkText: 'See the check for this session' },
    { icon: 'person', title: 'A person is there', text: 'An operator sets up and runs the camera, and can be asked about what they did.' },
  ],
  RED_LIGHT_SPEED: [
    { icon: 'light', title: 'Two checks in one', text: 'This camera looks for vehicles crossing the stop line on red, and for speed through the intersection.' },
    { icon: 'camera', title: 'Photos at each moment', text: 'The pictures show the signal and where the vehicle was at each moment, so you can see the order of events.', link: 'q2', linkText: 'See the photos' },
    { icon: 'clock', title: 'Amber is not red', text: 'An offence is only recorded after the light has turned red. The time since it turned red is on the notice.' },
  ],
  AVERAGE_SPEED: [
    { icon: 'route', title: 'Speed over a distance', text: 'Cameras at two points record the vehicle. The average is the distance between them divided by the time taken.' },
    { icon: 'ruler', title: 'The distance is surveyed', text: 'A registered surveyor measures the length between the cameras, and it is certified before any fine relies on it.', link: 'q4', linkText: 'See the survey certificate' },
    { icon: 'slow', title: 'Slowing near a camera doesn’t help', text: 'Only the whole trip counts, so speeding up between cameras and slowing at each one still shows in the average.' },
  ],
  MOBILE_PHONE: [
    { icon: 'person', title: 'A person always checks', text: 'Software flags possible phone use, but a trained person looks at every image before a notice is issued.' },
    { icon: 'blur', title: 'Passengers are blurred', text: 'Other people in the vehicle are blurred, so their privacy is protected.' },
    { icon: 'camera', title: 'You can see the same image', text: 'The image the person checked is the one shown to you.', link: 'q2', linkText: 'See the image' },
  ],
};

// Speeding bands, as the notice describes them (how far over the limit).
export const BANDS = [
  { id: 0, label: 'Within the limit', short: 'Within', tone: '#cfe0f2' },
  { id: 1, label: 'Up to 10 km/h over', short: '≤ 10 over', tone: '#f3cf8e' },
  { id: 2, label: '10 to 20 km/h over', short: '10–20 over', tone: '#e8923f' },
  { id: 3, label: '20 to 30 km/h over', short: '20–30 over', tone: '#c95000' },
  { id: 4, label: 'More than 30 km/h over', short: '30+ over', tone: '#8a2a08' },
];
