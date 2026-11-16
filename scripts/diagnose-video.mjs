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
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/api/')) console.log(`  page request: HTTP ${r.status()} ${r.request().method()} ${new URL(u).pathname.replace(/[A-Za-z0-9_-]{16,}/g, '<token>')}`);
  });
  page.on('console', (m) => { if (m.type() === 'error') console.log(`  console error: ${m.text()}`); });
  await page.goto(`${frontend}/?demo=${demoCase}`, { waitUntil: 'networkidle', timeout: 60000 });
  const video = page.locator('video');
  await video.first().waitFor({ state: 'attached', timeout: 90000 }).catch(() => {});
  for (let i = 0; i < 30 && !videoSrc; i++) {
    videoSrc = (await video.first().getAttribute('src').catch(() => '')) || '';
    if (!videoSrc) { await video.first().scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(2000); }
  }
  console.log(`Video elements on the page: ${await video.count()}; src found: ${videoSrc ? 'yes' : 'no'}`);
} finally {
  await browser.close();
}
if (!videoSrc) { console.log('::error::The page never gave the video element an address'); process.exit(1); }
if (videoSrc.startsWith('/')) videoSrc = backend + videoSrc;
console.log(`Video path: ${new URL(videoSrc).pathname.replace(/[A-Za-z0-9_-]{16,}/g, '<token>')}`);

let ok = false;
for (const attempt of [1, 2]) {
  const started = Date.now();
  try {
    const res = await fetch(videoSrc, { headers: { Origin: frontend }, signal: AbortSignal.timeout(300000) });
    const buf = Buffer.from(await res.arrayBuffer());
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`Attempt ${attempt}: HTTP ${res.status} in ${secs}s, type=${res.headers.get('content-type')}, bytes=${buf.length}, ` +
      `cors=${res.headers.get('access-control-allow-origin')}`);
    if (res.status !== 200) console.log(`  body: ${buf.toString('utf8').slice(0, 300)}`);
    if (res.status === 200 && buf.length > 1000) ok = true;
  } catch (e) {
    console.log(`Attempt ${attempt}: failed after ${((Date.now() - started) / 1000).toFixed(1)}s: ${e.message}`);
  }
}
if (!ok) { console.log('::error::The blurred video was not served'); process.exit(1); }
console.log('::notice::The blurred video was served');
