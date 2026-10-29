// Dev-only fixtures, used when the page is opened with ?mock=1 (see api.js). All data is invented.
const notice = (over) => ({
  offenceDescription: 'Exceed speed limit by 10km/h or less',
  offenceDate: '2026-03-14', offenceTime: '11:12:00', location: 'SAMPLE ROAD, SAMPLETOWN',
  penaltyAmount: 277, amountOwing: 277, status: 'PAYABLE', statusMessage: 'Payment is due.',
  enforcementMethod: 'CAMERA', ...over,
});

const IMG = (n, title) => ({ kind: 'IMAGE', title, url: `/samples/image-${n}.jpg`, previewUrl: `/samples/image-${n}-preview.jpg` });
const CERT = { kind: 'CERTIFICATE', title: 'Sample camera certificate', url: '/samples/cert-1.pdf' };
const VIDEO = {
  kind: 'VIDEO', title: 'Sample video (adaptive)', url: '/samples/hls/master.m3u8',
  posterUrl: '/samples/video-1-poster.jpg', downloadUrl: '/samples/video-1.mp4',
};

export const SCENARIOS = [
  { number: '9000000001', label: 'Speed camera (images, video, certificate)' },
  { number: '9000000002', label: 'Officer-issued caution (no evidence)' },
  { number: '9000000003', label: 'Ticketless camera (image, certificate)' },
  { number: '9000000009', label: 'Camera with a broken video' },
];

export async function mockLookup({ infringementNumber, offenceDate }) {
  await new Promise((r) => setTimeout(r, 250));
  const base = { status: 'FOUND', infringementNumber, summary: 'Prototype data only.', source: 'STUB' };
  switch (infringementNumber) {
    case '9000000002':
      return { ...base, notice: notice({
        offenceDescription: 'Park continuously for longer than indicated', offenceDate, offenceTime: '14:47:00',
        location: 'SAMPLE STREET, SAMPLETOWN', penaltyAmount: 136, amountOwing: 0, status: 'CAUTION',
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
      return { ...base, notice: notice({ offenceDate }), evidence: [IMG(1, 'Sample image 1'), IMG(2, 'Sample image 2'), VIDEO,
        { kind: 'VIDEO', title: 'Sample video (plain MP4)', url: '/samples/video-1.mp4', posterUrl: '/samples/video-1-poster.jpg' }, CERT] };
  }
}
