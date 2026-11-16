// Release gate, frontend half: proves in a real headless browser that the deployed site works for a person.
// A green deploy used to mean only "the upload finished". On 2026-11-17 that hid a blank page (JavaScript served
// with the wrong MIME type), a frontend whose API calls were blocked by CORS, and a frontend built for another backend.
// Invented data only: this touches the demo cases endpoint, never a real notice.
//
// Usage: FRONTEND_URL=https://... BACKEND_URL=https://... node scripts/release-gate.mjs
import { chromium } from 'playwright';

const frontend = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
const backend = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
if (!frontend || !backend) {
  console.log('::error::FRONTEND_URL and BACKEND_URL are both required');
  process.exit(1);
}

const problems = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText || 'unknown'})`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });

  // 1. The page loads and the app actually renders (a blank page still answers 200 with a title).
  const response = await page.goto(frontend, { timeout: 45000, waitUntil: 'networkidle' });
  console.log(`Frontend ${frontend} -> HTTP ${response?.status()}`);
  if (!response || response.status() !== 200) problems.push(`frontend answered HTTP ${response?.status()}`);
  const rendered = (await page.locator('#root').innerText({ timeout: 10000 }).catch(() => '')).trim();
  console.log(`Rendered text length: ${rendered.length}`);
  if (rendered.length < 100) problems.push(`the app did not render (#root has ${rendered.length} characters of text)`);

  // 2. Every script is served as JavaScript (the browser refuses module scripts with any other type).
  const scripts = await page.locator('script[src]').evaluateAll((els) => els.map((e) => e.src));
  let bundleNamesBackend = false;
  for (const src of scripts) {
    const r = await page.request.get(src);
    const type = r.headers()['content-type'] || '';
    console.log(`Script ${new URL(src).pathname} -> HTTP ${r.status()} ${type}`);
    if (!/javascript/.test(type)) problems.push(`script served as "${type}", not JavaScript: ${src}`);
    if ((await r.text()).includes(new URL(backend).host)) bundleNamesBackend = true;
  }

  // 3. The frontend was built for THIS backend (VITE_API_BASE_URL is baked in at build time).
  //    Skipped when both share one host (a single front door), where the bundle needs no backend address.
  if (new URL(frontend).host !== new URL(backend).host && !bundleNamesBackend) {
    problems.push(`the frontend bundle does not mention the backend host ${new URL(backend).host}: it was built for another backend`);
  }

  // 4. The browser may call the API from this origin (CORS). Run from inside the page, so the real origin is sent.
  const api = await page.evaluate(async (url) => {
    try {
      const r = await fetch(url);
      return { ok: r.ok, status: r.status };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, `${backend}/api/demo/cases`);
  console.log(`API call from the page: ${JSON.stringify(api)}`);
  if (!api.ok) problems.push(`the page cannot call the API (${api.error || 'HTTP ' + api.status}); check CEVOC_CORS_ALLOWED_ORIGINS on the backend`);
} catch (e) {
  problems.push(`gate crashed: ${e.message}`);
} finally {
  await browser.close();
}

if (problems.length) {
  for (const p of [...new Set(problems)]) console.log(`::error::${p}`);
  process.exit(1);
}
console.log('::notice::Frontend gate passed: renders, scripts are JavaScript, built for this backend, API reachable from the page');
