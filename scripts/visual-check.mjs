#!/usr/bin/env node
// Visual check of the result page. Builds the front end, serves it with a tiny mock API on 127.0.0.1, drives it in Chromium
// and writes screenshots (mobile 390 wide and desktop 1280 wide, device scale factor 2) plus a report of simple automated checks
// (horizontal scroll, small tap targets, images without alt text, axe-core colour contrast when axe-core is installed).
// If the original clickable mockup (prototype/) has its dependencies installed, its red light page is captured the same way.
//
// FICTITIOUS DATA ONLY. Every notice number, place, value and picture below is invented. No network access is needed after
// `npm ci`: every request that is not to 127.0.0.1 is blocked and listed in the report.
//
//   cd frontend && npm ci && cd ..           (once; add `cd prototype && npm ci` for the mockup)
//   node scripts/visual-check.mjs [--out DIR] [--skip-mockup] [--no-build] [--no-demo] [--only case,case]
//
// Demo data (docs/DEMO-DATA.md): the demo hub (/demo-cases) and EVERY listed demo case are captured too, mobile and desktop. The
// list, the stream events of each case and the sample images come from scripts/visual-check-demo-cases.json, which a backend test
// generates from the same scenario list the backend serves, so nothing is listed twice. `--only demo` runs just those.
//
// Output goes to DIR (default: visual-check-output/ in the repository root, which is git-ignored).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', process.env.VISUAL_OUT || path.join(ROOT, 'visual-check-output')));
const ONLY = opt('only', '') ? opt('only', '').split(',') : null;

// The demo hub list, the stream events of every demo case and its sample images (generated from the backend's scenario list).
const DEMO_FIXTURE = path.join(ROOT, 'scripts', 'visual-check-demo-cases.json');
const DEMO = flag('no-demo') || !fs.existsSync(DEMO_FIXTURE) ? null : JSON.parse(fs.readFileSync(DEMO_FIXTURE, 'utf8'));

const requireFrontend = createRequire(path.join(ROOT, 'frontend', 'package.json'));
const requirePrototype = createRequire(path.join(ROOT, 'prototype', 'package.json'));
const { chromium } = (() => { try { return requireFrontend('playwright'); } catch { return requireFrontend('@playwright/test'); } })();
const axeSource = (() => {
  for (const r of [requireFrontend, requirePrototype]) { try { return fs.readFileSync(r.resolve('axe-core/axe.min.js'), 'utf8'); } catch { /* try next */ } }
  return null;
})();

// ---------------------------------------------------------------------------------------------------------------------------
// Fictitious data. Numbers 9000000101 and up are invented for this tool (the README lists the other fictitious numbers).
// ---------------------------------------------------------------------------------------------------------------------------
const OFFENCE_DATE = '2026-03-14';
const FIXED_NOW = '2026-11-05T10:00:00';
const baseNotice = (over) => ({
  offenceDescription: 'Fail to stop at red traffic light', offenceDate: OFFENCE_DATE, offenceTime: '17:42:10',
  location: 'SAMPLE ROAD AT EXAMPLE STREET, SAMPLETOWN', penaltyAmount: 400, amountOwing: 400, noticeStatus: 'PAYABLE',
  statusMessage: 'Payment is due.', enforcementMethod: 'CAMERA', ...over,
});
const IMAGES = [1, 2, 3].map((n) => ({
  kind: 'IMAGE', title: ['Sample photo 1: approaching the stop line', 'Sample photo 2: crossing the stop line', 'Sample photo 3: number plate'][n - 1],
  url: `/samples/photo-${n}.svg`, previewUrl: `/samples/photo-${n}.svg`,
}));
const CERTS = [
  { description: 'Sample red light camera - annual check', type: 'Annual certificate', periodText: '1 Jan 2026 to 31 Dec 2026', certifiedDate: '2025-12-18', expiryDate: '2026-12-31', coversOffence: true },
  { description: 'Sample red light camera - earlier unit', type: 'Annual certificate', periodText: '1 Jan 2025 to 31 Dec 2025', certifiedDate: '2024-12-20', expiryDate: '2025-12-31', coversOffence: false },
];
const FULL_DETAILS = {
  timeSinceRed: 2.8, yellowLightDuration: 4.2, lane: 'Lane 2', direction: 'Westbound', operator: 'Sample Operator Ltd (fictitious)',
  incidentNumber: 'TEST-INC-000123', speedLimit: 60, offenceText: 'Fail to stop at red traffic light', bannerLocation: 'SAMPLE ROAD AT EXAMPLE STREET',
};

/** parts: which events the stream sends. `fail` sends an error event in place of the certificates (a technical failure). */
export const CASES = [
  { id: 'a-red-light-with-certificate', title: 'Red light notice, details, 3 photos, certificate present', number: '9000000101',
    result: { notice: baseNotice(), evidence: IMAGES, certificates: CERTS, details: FULL_DETAILS } },
  { id: 'b-red-light-no-certificate', title: 'Same, no certificate (by-design not available)', number: '9000000102',
    result: { notice: baseNotice(), evidence: IMAGES, certificates: [], details: FULL_DETAILS } },
  { id: 'c-red-light-missing-fields', title: 'Details lack seconds-after-red (only speed limit returned)', number: '9000000103',
    result: { notice: baseNotice(), evidence: IMAGES, certificates: CERTS, details: { speedLimit: 60, lane: 'Lane 2', offenceText: 'Fail to stop at red traffic light' } } },
  { id: 'c2-red-light-no-details', title: 'Red light notice, no details returned at all', number: '9000000106',
    result: { notice: baseNotice(), evidence: IMAGES, certificates: CERTS, details: {} } },
  { id: 'd-certificate-technical-failure', title: 'Certificates failed technically (distinct from not available)', number: '9000000104',
    result: { notice: baseNotice(), evidence: IMAGES, certificates: null, details: FULL_DETAILS }, failCertificates: true },
  { id: 'e-speed-camera-not-red-light', title: 'Non-red-light program (speed camera)', number: '9000000105',
    result: { notice: baseNotice({ offenceDescription: 'Exceed speed limit by 10km/h or less', offenceTime: '11:12:00', location: 'SAMPLE HIGHWAY, SAMPLETOWN', penaltyAmount: 277, amountOwing: 277 }),
      evidence: IMAGES.slice(0, 2), certificates: CERTS.map((c) => ({ ...c, description: c.description.replace('red light', 'speed')})), details: { speedLimit: 60 } } },
];

function photoSvg(n) {
  const labels = ['Approaching the stop line', 'Crossing the stop line', 'Number plate close-up'];
  const car = n === 1 ? 420 : n === 2 ? 800 : 640;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000">
<rect width="1600" height="1000" fill="#59636e"/><rect y="520" width="1600" height="480" fill="#3b4048"/>
<rect x="0" y="640" width="1600" height="14" fill="#f2f2f2"/><rect x="1180" y="120" width="60" height="220" rx="10" fill="#222"/>
<circle cx="1210" cy="170" r="20" fill="${n === 1 ? '#555' : '#e02424'}"/><circle cx="1210" cy="230" r="20" fill="#555"/><circle cx="1210" cy="290" r="20" fill="#555"/>
<rect x="${car}" y="${n === 3 ? 380 : 540}" width="${n === 3 ? 520 : 340}" height="${n === 3 ? 300 : 190}" rx="22" fill="#9aa5b1"/>
<rect x="${car + (n === 3 ? 150 : 100)}" y="${n === 3 ? 520 : 650}" width="${n === 3 ? 220 : 140}" height="${n === 3 ? 90 : 56}" fill="#fff" stroke="#111" stroke-width="3"/>
<text x="${car + (n === 3 ? 260 : 170)}" y="${n === 3 ? 585 : 692}" font-family="monospace" font-size="${n === 3 ? 52 : 34}" text-anchor="middle" fill="#111">TEST000</text>
<rect x="0" y="0" width="1600" height="84" fill="#000" fill-opacity=".72"/>
<text x="24" y="54" font-family="monospace" font-size="34" fill="#fff">FICTITIOUS SAMPLE IMAGE ${n} OF 3 - ${labels[n - 1].toUpperCase()}</text>
<rect x="0" y="916" width="1600" height="84" fill="#b00020" fill-opacity=".85"/>
<text x="24" y="970" font-family="monospace" font-size="34" fill="#fff">SAMPLE ONLY - NOT A REAL NOTICE - NOT A REAL PHOTO</text></svg>`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Build and serve
// ---------------------------------------------------------------------------------------------------------------------------
function build(dir, outDir, label) {
  if (flag('no-build') && fs.existsSync(path.join(outDir, 'index.html'))) return true;
  console.log(`building ${label}...`);
  const r = spawnSync('npx', ['--no-install', 'vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: dir, stdio: 'inherit' });
  return r.status === 0;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };

function serve(staticDir, withApi) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (withApi && req.method === 'POST' && url.pathname.startsWith('/api/penalty-lookups')) {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => handleApi(url.pathname, raw, res));
      return;
    }
    if (withApi && DEMO && req.method === 'GET' && url.pathname === '/api/demo/cases') {
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(DEMO.catalog)); return;
    }
    if (withApi && DEMO) {
      const dm = /^\/api\/demo\/media\/(\d{10})\/([a-z0-9.-]+)$/.exec(url.pathname);
      if (dm) {
        const svg = DEMO.cases[dm[1]]?.media?.[dm[2]];
        if (svg) { res.writeHead(200, { 'Content-Type': TYPES['.svg'] }); res.end(svg); } else res.writeHead(404).end();
        return;
      }
    }
    if (withApi) {
      const m = /^\/samples\/photo-(\d)\.svg$/.exec(url.pathname);
      if (m) { res.writeHead(200, { 'Content-Type': TYPES['.svg'] }); res.end(photoSvg(Number(m[1]))); return; }
    }
    let file = path.join(staticDir, decodeURIComponent(url.pathname));
    if (!file.startsWith(staticDir)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { if (withApi && !path.extname(url.pathname)) file = path.join(staticDir, 'index.html'); else { res.writeHead(404).end(); return; } }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

function handleApi(pathname, raw, res) {
  let body = {};
  try { body = JSON.parse(raw || '{}'); } catch { /* handled below */ }
  const demoCase = DEMO?.cases?.[body.infringementNumber];
  if (demoCase && pathname.endsWith('/stream')) {
    // The events the backend's demo adapter produces for this case (with the plate the case needs, when one was given).
    const events = body.registration && demoCase.eventsWithPlate ? demoCase.eventsWithPlate : demoCase.events;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write(': open\n\n');
    for (const [name, data] of events) res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    res.end();
    return;
  }
  const c = CASES.find((x) => x.number === body.infringementNumber);
  if (!c) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'NOT_FOUND', infringementNumber: body.infringementNumber, summary: 'No match.', evidence: [], certificates: [], source: 'STUB' })); return; }
  const r = c.result;
  const details = { status: 'FOUND', infringementNumber: c.number, summary: 'Prototype data only.', notice: r.notice, source: 'STUB' };
  if (pathname.endsWith('/stream')) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    const send = (name, data) => res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    res.write(': open\n\n');
    send('details', details);
    send('evidence', { evidence: r.evidence, plateRequired: false });
    if (r.details && Object.keys(r.details).length) send('extra', { details: r.details });
    if (c.failCertificates) send('error', { cause: 'source-failed' });
    else { send('certificates', { certificates: r.certificates || [] }); send('done', { ok: true }); }
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ...details, evidence: r.evidence, certificates: r.certificates || [], ...(r.details && Object.keys(r.details).length ? { details: r.details } : {}) }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Page checks
// ---------------------------------------------------------------------------------------------------------------------------
const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 },
};

/** Runs inside the page. Returns plain data only (no personal data exists on these pages: all content is invented). */
function pageChecks() {
  const vw = window.innerWidth;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('.sr-only, .skip'); };
  const label = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''} "${(el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
  const overflow = [...document.querySelectorAll('body *')].filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1 && !el.closest('.zp-viewport')).slice(0, 8).map(label);
  const targets = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button]')].filter(visible).map((el) => {
    const r = el.getBoundingClientRect();
    const inline = el.tagName === 'A' && !!el.closest('p, li') && getComputedStyle(el).display === 'inline';
    return { el: label(el), w: Math.round(r.width), h: Math.round(r.height), inline };
  });
  const imgs = [...document.querySelectorAll('img')].filter(visible).map((el) => ({ el: label(el), alt: el.getAttribute('alt'), loaded: el.complete && el.naturalWidth > 0 }));
  return {
    scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, horizontalScroll: document.documentElement.scrollWidth > vw + 1, overflowing: overflow,
    targetsUnder24: targets.filter((t) => (t.w < 24 || t.h < 24) && !t.inline), targetsUnder44: targets.filter((t) => (t.w < 44 || t.h < 44) && !t.inline).length, targetCount: targets.length,
    imagesWithoutAlt: imgs.filter((i) => i.alt === null || i.alt.trim() === '').map((i) => i.el), imagesNotLoaded: imgs.filter((i) => !i.loaded).map((i) => i.el), imageCount: imgs.length,
  };
}

async function settle(page) {
  // scroll through once so lazy images load, then come back to the top
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function runAxe(page) {
  if (!axeSource) return null;
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
}

async function newContext(browser, vp, guard, blocked) {
  const ctx = await browser.newContext({ ...VIEWPORTS[vp], reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(new Date(FIXED_NOW));
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(guard) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    blocked.push(u.split('?')[0]);
    return route.abort();
  });
  return ctx;
}

async function capture(page, outFile, textFile) {
  await settle(page);
  const checks = await page.evaluate(pageChecks);
  checks.axe = await runAxe(page);
  await page.screenshot({ path: outFile, fullPage: true });
  fs.writeFileSync(textFile, `${await page.evaluate(() => document.body.innerText)}\n`);
  return checks;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const buildDir = path.join(OUT, '.build');
  const appDir = path.join(buildDir, 'app');
  if (!build(path.join(ROOT, 'frontend'), appDir, 'front end')) throw new Error('front end build failed');
  let mockDir = null;
  if (!flag('skip-mockup')) {
    if (fs.existsSync(path.join(ROOT, 'prototype', 'node_modules', 'vite'))) {
      const d = path.join(buildDir, 'mockup');
      if (build(path.join(ROOT, 'prototype'), d, 'mockup')) mockDir = d; else console.log('mockup build failed; skipping the mockup');
    } else console.log('mockup skipped: run `npm ci` in prototype/ to include it');
  }

  const app = await serve(appDir, true);
  const mock = mockDir ? await serve(mockDir, false) : null;
  const browser = await chromium.launch();
  const report = { generatedFor: 'fictitious data only', axe: !!axeSource, cases: [], mockup: [], blockedExternalRequests: [] };
  let failed = false;
  for (const dir of ['prototype', 'mockup', 'text']) fs.mkdirSync(path.join(OUT, dir), { recursive: true });

  try {
    for (const c of CASES.filter((x) => !ONLY || ONLY.includes(x.id) || ONLY.includes(x.id.split('-')[0]))) {
      for (const vp of Object.keys(VIEWPORTS)) {
        const ctx = await newContext(browser, vp, app.base, report.blockedExternalRequests);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
        try {
          await page.goto(app.base);
          await page.fill('#pn', c.number);
          await page.fill('#od-d', '14'); await page.fill('#od-m', '03'); await page.fill('#od-y', '2026');
          await page.click('button[type=submit]');
          await page.waitForSelector('#step-camera .q-answer, #step-evidence .q-answer', { timeout: 20000 });
          await page.waitForFunction(() => !document.querySelector('[aria-busy="true"], .skel'), null, { timeout: 20000 });
          const name = `${c.id}-${vp}`;
          const checks = await capture(page, path.join(OUT, 'prototype', `${name}.png`), path.join(OUT, 'text', `prototype-${name}.txt`));
          report.cases.push({ id: c.id, title: c.title, viewport: vp, screenshot: `prototype/${name}.png`, consoleErrors: errors, ...checks });
          console.log(`ok  ${name}`);
        } catch (err) {
          failed = true;
          console.log(`FAIL ${c.id}-${vp}: ${err.message.split('\n')[0]}`);
          report.cases.push({ id: c.id, viewport: vp, error: err.message.split('\n')[0] });
        }
        await ctx.close();
      }
    }
    if (DEMO && (!ONLY || ONLY.includes('demo'))) {
      const numbers = Object.keys(DEMO.cases);
      for (const vp of Object.keys(VIEWPORTS)) {
        // the hub, then every listed case opened the way the hub's link opens it
        const hubCtx = await newContext(browser, vp, app.base, report.blockedExternalRequests);
        const hub = await hubCtx.newPage();
        const hubErrors = [];
        hub.on('pageerror', (e) => hubErrors.push(e.message));
        try {
          await hub.goto(`${app.base}/demo-cases`);
          await hub.waitForSelector('.demo-case', { timeout: 20000 });
          const checks = await capture(hub, path.join(OUT, 'prototype', `demo-hub-${vp}.png`), path.join(OUT, 'text', `prototype-demo-hub-${vp}.txt`));
          report.cases.push({ id: 'demo-hub', title: 'Demo hub', viewport: vp, screenshot: `prototype/demo-hub-${vp}.png`, consoleErrors: hubErrors, ...checks });
          console.log(`ok  demo-hub-${vp}`);
        } catch (err) {
          failed = true;
          console.log(`FAIL demo-hub-${vp}: ${err.message.split('\n')[0]}`);
          report.cases.push({ id: 'demo-hub', viewport: vp, error: err.message.split('\n')[0] });
        }
        await hubCtx.close();
        for (const number of numbers) {
          const ctx = await newContext(browser, vp, app.base, report.blockedExternalRequests);
          const page = await ctx.newPage();
          const errors = [];
          page.on('pageerror', (e) => errors.push(e.message));
          const id = `demo-${number}`;
          try {
            await page.goto(`${app.base}/?demo=${number}`);
            await page.waitForSelector('.demo-banner', { timeout: 20000 });
            await page.waitForFunction(() => !document.querySelector('[aria-busy="true"], .skel'), null, { timeout: 20000 });
            const checks = await capture(page, path.join(OUT, 'prototype', `${id}-${vp}.png`), path.join(OUT, 'text', `prototype-${id}-${vp}.txt`));
            report.cases.push({ id, title: `Demo case ${number}`, viewport: vp, screenshot: `prototype/${id}-${vp}.png`, consoleErrors: errors, ...checks });
            console.log(`ok  ${id}-${vp}`);
            if (DEMO.cases[number].eventsWithPlate) {
              // held-back images: give the plate the case needs (a wrong one for the always-refused case) and capture the answer
              const plate = DEMO.catalog.programs.flatMap((p) => p.groups.flatMap((g) => g.cases)).find((x) => x.number === number)?.plate || 'WRONG1';
              await page.fill('#rego2', plate);
              await page.click('.plate-ask button[type=submit]');
              await page.waitForFunction(() => !document.querySelector('[aria-busy="true"], .skel'), null, { timeout: 20000 });
              const after = await capture(page, path.join(OUT, 'prototype', `${id}-plate-${vp}.png`), path.join(OUT, 'text', `prototype-${id}-plate-${vp}.txt`));
              report.cases.push({ id: `${id}-plate`, title: `Demo case ${number} after the plate`, viewport: vp, screenshot: `prototype/${id}-plate-${vp}.png`, consoleErrors: errors, ...after });
              console.log(`ok  ${id}-plate-${vp}`);
            }
          } catch (err) {
            failed = true;
            console.log(`FAIL ${id}-${vp}: ${err.message.split('\n')[0]}`);
            report.cases.push({ id, viewport: vp, error: err.message.split('\n')[0] });
          }
          await ctx.close();
        }
      }
    }
    if (mock) {
      for (const vp of Object.keys(VIEWPORTS)) {
        const ctx = await newContext(browser, vp, mock.base, report.blockedExternalRequests);
        const page = await ctx.newPage();
        try {
          await page.goto(`${mock.base}/#/notice/3162457891?clean=1`);
          await page.waitForSelector('#q1, h1', { timeout: 20000 });
          await page.waitForTimeout(1500);
          const name = `red-light-${vp}`;
          const checks = await capture(page, path.join(OUT, 'mockup', `${name}.png`), path.join(OUT, 'text', `mockup-${name}.txt`));
          report.mockup.push({ viewport: vp, screenshot: `mockup/${name}.png`, ...checks });
          console.log(`ok  mockup ${name}`);
        } catch (err) {
          failed = true;
          console.log(`FAIL mockup ${vp}: ${err.message.split('\n')[0]}`);
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    app.server.close();
    mock?.server.close();
  }
  report.blockedExternalRequests = [...new Set(report.blockedExternalRequests)];
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, 'report.md'), summary(report));
  console.log(`\nscreenshots and report: ${OUT}`);
  if (failed) process.exit(1);
}

function summary(report) {
  const rows = [...report.cases.map((c) => ({ ...c, name: `${c.id} (${c.viewport})` })), ...report.mockup.map((c) => ({ ...c, name: `mockup red light (${c.viewport})` }))];
  const lines = ['# Visual check report (fictitious data)', '', '| Page | h-scroll | targets <24px | targets <44px | images w/o alt | axe violations |', '|---|---|---|---|---|---|'];
  for (const r of rows) {
    if (r.error) { lines.push(`| ${r.name} | ERROR: ${r.error} | | | | |`); continue; }
    const axe = r.axe ? (r.axe.length ? r.axe.map((v) => `${v.id}:${v.nodes}`).join(', ') : 'none') : 'axe-core not installed';
    lines.push(`| ${r.name} | ${r.horizontalScroll ? `YES (${r.scrollWidth} > ${r.innerWidth})` : 'no'} | ${r.targetsUnder24.length} | ${r.targetsUnder44} | ${r.imagesWithoutAlt.length} | ${axe} |`);
  }
  lines.push('', `External requests blocked: ${report.blockedExternalRequests.length ? report.blockedExternalRequests.join(', ') : 'none'}`, '');
  return lines.join('\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
