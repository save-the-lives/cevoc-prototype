// Diagnostic: opens a demo case on the deployed frontend, finds the video address the page was given, and requests it
// directly with timing. Prints status, type, size and how long the server took. Demo data only.
// Usage: FRONTEND_URL=... BACKEND_URL=... [DEMO_CASE=0000000001] node scripts/diagnose-video.mjs
import { chromium } from 'playwright';

const frontend = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
const backend = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
const demoCase = process.env.DEMO_CASE || '0000000001';
if (!frontend || !backend) { console.log('::error::FRONTEND_URL and BACKEND_URL are required'); process.exit(1); }

const browser = await chromium.launch();
let videoSrc = '';
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000); // no single page call may hang the check
  let mediaUrl = '';
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/api/')) console.log(`  page request: HTTP ${r.status()} ${r.request().method()} ${new URL(u).pathname.replace(/[A-Za-z0-9_-]{16,}/g, '<token>')}`);
    // The video's address is the media request the page makes for it: 503 (still blurring), 451 (failed) or a video.
    if (!mediaUrl && u.includes('/api/media/') && (r.status() === 503 || r.status() === 451 || /^video\//.test(r.headers()['content-type'] || ''))) {
      mediaUrl = u;
    }
  });
  page.on('console', (m) => { if (m.type() === 'error') console.log(`  console error: ${m.text()}`); });
  await page.goto(`${frontend}/?demo=${demoCase}`, { waitUntil: 'networkidle', timeout: 60000 });
  const video = page.locator('video');
  await video.first().waitFor({ state: 'attached', timeout: 60000 }).catch(() => {});
  await video.first().scrollIntoViewIfNeeded().catch(() => {});
  for (let i = 0; i < 30 && !mediaUrl; i++) await page.waitForTimeout(2000);
  videoSrc = mediaUrl;
  console.log(`Video elements on the page: ${await video.count()}; video request seen: ${videoSrc ? 'yes' : 'no'}`);
  // Video evidence is never downloadable: no download link on the page may point at the video, and the browser's own
  // download control must be switched off on every video element.
  const dl = await page.locator('a[download]').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''));
  const videoPath = videoSrc ? new URL(videoSrc, frontend).pathname : '';
  if (videoPath && dl.some((h) => h && new URL(h, frontend).pathname === videoPath)) {
    console.log('::error::A download link points at the video');
    process.exitCode = 1;
  }
  const lists = await video.evaluateAll((vs) => vs.map((v) => v.getAttribute('controlslist') || ''));
  if (lists.some((l) => !/nodownload/.test(l))) {
    console.log('::error::A video element allows the browser download control');
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
if (!videoSrc) { console.log('::error::The page never requested the video'); process.exit(1); }
if (videoSrc.startsWith('/')) videoSrc = backend + videoSrc;
console.log(`Video path: ${new URL(videoSrc).pathname.replace(/[A-Za-z0-9_-]{16,}/g, '<token>')}`);

// The server answers 503 with Retry-After while it is still blurring, 200 with the blurred video when done, 451 when
// blurring failed (it will not send the unblurred video). Poll like the page does, for up to 5 minutes.
let ok = false;
const started = Date.now();
for (let attempt = 1; Date.now() - started < 300000; attempt++) {
  try {
    const res = await fetch(videoSrc, { signal: AbortSignal.timeout(60000) });
    const buf = Buffer.from(await res.arrayBuffer());
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`Attempt ${attempt} at ${secs}s: HTTP ${res.status}, type=${res.headers.get('content-type')}, bytes=${buf.length}`);
    if (res.status === 200 && /^video\//.test(res.headers.get('content-type') || '') && buf.length > 1000) { ok = true; break; }
    if (res.status === 451) { console.log(`  ${buf.toString('utf8').slice(0, 200)}`); break; }
    if (res.status !== 503) { console.log(`  unexpected answer: ${buf.toString('utf8').slice(0, 200)}`); break; }
  } catch (e) {
    console.log(`Attempt ${attempt} failed: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
if (!ok) { console.log('::error::The blurred video was not served'); process.exit(1); }
// The blurred video is always served inline, never as an attachment, whatever is asked.
const asked = await fetch(videoSrc + (videoSrc.includes('?') ? '&' : '?') + 'dl=1', { signal: AbortSignal.timeout(60000) });
const disposition = asked.headers.get('content-disposition') || '';
await asked.arrayBuffer();
console.log(`With ?dl=1: HTTP ${asked.status}, content-disposition=${disposition}`);
if (/attachment/i.test(disposition)) { console.log('::error::The video was offered as a download'); process.exit(1); }
if (process.exitCode) process.exit(process.exitCode);
console.log(`::notice::The blurred video was served after ${((Date.now() - started) / 1000).toFixed(0)}s`);
