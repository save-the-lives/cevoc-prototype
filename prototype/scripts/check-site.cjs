// Smoke check of a built, downloaded copy of the site (used by CI on the zip, and locally).
// Usage: node scripts/check-site.cjs http://127.0.0.1:4180/   (the folder must be served, not opened as file://)
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://127.0.0.1:4180/').replace(/\/?$/, '/');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  let ok = true;
  for (const [path, text] of [['#/uplift', 'Search'], ['#/uplift/hub', 'Certificate uplift hub'], ['#/uplift/hub/questions', 'Related'], ['#/uplift/hub/adr', 'ADR-001']]) {
    await p.goto(base + path, { waitUntil: 'load' });
    try { await p.getByText(text, { exact: false }).first().waitFor({ timeout: 10000 }); console.log(`ok   ${path}`); }
    catch { ok = false; console.log(`FAIL ${path}: "${text}" not shown`); }
  }
  if (errors.length) { ok = false; console.log('Page errors:', errors); }
  await b.close();
  process.exit(ok ? 0 : 1);
})();
