// Dev-only fixtures, used when the page is opened with ?mock=1 (see api.js). All data is invented.
const notice = (over) => ({
  offenceDescription: 'Exceed speed limit by 10km/h or less',
  offenceDate: '2026-03-14', offenceTime: '11:12:00', location: 'SAMPLE ROAD, SAMPLETOWN',
  penaltyAmount: 277, amountOwing: 277, noticeStatus: 'PAYABLE', statusMessage: 'Payment is due.',
  enforcementMethod: 'CAMERA', ...over,
});

const IMG = (n, title) => ({ kind: 'IMAGE', title, url: `/samples/image-${n}.jpg`, previewUrl: `/samples/image-${n}-preview.jpg` });
const CERT = { kind: 'CERTIFICATE', title: 'Sample camera certificate', url: '/samples/cert-1.pdf' };
const CERTS = [
  { description: 'Sample speed camera - annual accuracy check', type: 'Annual certificate', periodText: '1 Jan 2025 to 31 Dec 2025',
    certifiedDate: '2024-12-20', expiryDate: '2025-12-31', coversOffence: false },
  { description: 'Sample speed camera - annual accuracy check', type: 'Annual certificate', periodText: '1 Jan 2026 to 31 Dec 2026',
    certifiedDate: '2025-12-18', expiryDate: '2026-12-31', coversOffence: true },
  { description: 'Sample speed camera - repair and recheck', type: 'Interim certificate', periodText: '1 Apr 2026 to 30 Jun 2026',
    certifiedDate: '2026-03-30', expiryDate: '2026-06-30', coversOffence: false },
  { description: 'Sample speed camera - earlier unit', type: 'Annual certificate', periodText: '1 Jan 2024 to 31 Dec 2024',
    certifiedDate: '2023-12-15', expiryDate: '2024-12-31', coversOffence: false },
];
const VIDEO = {
  kind: 'VIDEO', title: 'Sample video (adaptive)', url: '/samples/hls/master.m3u8',
  posterUrl: '/samples/video-1-poster.jpg', downloadUrl: '/samples/video-1.mp4',
};

export const SCENARIOS = [
  { number: '9000000001', label: 'Speed camera (images, video, certificate list)' },
  { number: '9000000002', label: 'Officer-issued caution (no evidence)' },
  { number: '9000000003', label: 'Ticketless camera (image, certificate)' },
  { number: '9000000009', label: 'Camera with a broken video' },
  { number: '9000000004', label: 'Images need a registration number' },
  { number: '9000000005', label: 'Camera offence, evidence not available yet' },
  { number: '9000000006', label: 'Not found' },
  { number: '9000000007', label: 'Service unavailable' },
];

// Dev scenarios beyond the first four. 9000000004 mimics the source that releases images only once a registration
// number is given (any non-empty value works here); 9000000005 is a camera offence with nothing to show yet;
// 9000000006 and 9000000007 are the not-found and unavailable cases.
export async function mockLookup({ infringementNumber, offenceDate, registration }) {
  await new Promise((r) => setTimeout(r, 250));
  const base = { status: 'FOUND', infringementNumber, summary: 'Prototype data only.', source: 'STUB' };
  switch (infringementNumber) {
    case '9000000004':
      return { ...base, notice: notice({ offenceDate }), certificates: registration ? CERTS : [], plateRequired: !registration, evidence: registration ? [IMG(1, 'Sample image 1'), IMG(2, 'Sample image 2')] : [] };
    case '9000000005':
      return { ...base, notice: notice({ offenceDate }), evidence: [] };
    case '9000000006':
      return { status: 'NOT_FOUND', infringementNumber, summary: 'We could not match that notice number and offence date.', evidence: [], certificates: [], source: 'STUB' };
    case '9000000007':
      return { status: 'UNAVAILABLE', infringementNumber, summary: 'We could not load this right now. Please try again.', evidence: [], certificates: [], source: 'ERROR' };
    case '9000000002':
      return { ...base, notice: notice({
        offenceDescription: 'Park continuously for longer than indicated', offenceDate, offenceTime: '14:47:00',
        location: 'SAMPLE STREET, SAMPLETOWN', penaltyAmount: 136, amountOwing: 0, noticeStatus: 'CAUTION',
        statusMessage: 'This penalty has been replaced with a caution. You no longer need to pay.',
        enforcementMethod: 'OFFICER_ISSUED' }), evidence: [] };
    case '9000000003':
      return { ...base, notice: notice({
        offenceDescription: 'Travel or attempt travel without valid ticket - adult', offenceDate, offenceTime: '08:05:00',
        location: 'SAMPLE STATION', penaltyAmount: 200, amountOwing: 200 }), evidence: [IMG(2, 'Sample image'), CERT] };
    case '9000000009':
      return { ...base, notice: notice({ offenceDate }), evidence: [
        IMG(1, 'Sample image'),
        { kind: 'VIDEO', title: 'Sample video (missing file)', url: '/samples/hls/missing.m3u8', posterUrl: '/samples/video-1-poster.jpg' },
        { ...VIDEO, title: 'Sample video (still works)' }, CERT] };
    default:
      return { ...base, notice: notice({ offenceDate }), certificates: CERTS, evidence: [IMG(1, 'Sample image 1'), IMG(2, 'Sample image 2'), VIDEO,
        { kind: 'VIDEO', title: 'Sample video (plain MP4)', url: '/samples/video-1.mp4', posterUrl: '/samples/video-1-poster.jpg' }, CERT] };
  }
}

/** Dev stand-in for the stream: the same parts as the backend, spread over a few seconds so the loading states can be seen. */
export async function mockStream({ infringementNumber, offenceDate, registration }, onEvent, signal) {
  const result = await mockLookup({ infringementNumber, offenceDate, registration });
  const wait = (ms) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
  });
  const { eventsFromResult } = await import('./lookupState.js');
  const delays = { details: 1500, evidence: 1200, certificates: 1200, done: 200 };
  for (const [name, data] of eventsFromResult(result)) {
    await wait(delays[name] ?? 0);
    onEvent(name, data);
  }
}
