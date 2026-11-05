// One-page load of the certificates search page from a GitHub runner. Prints field NAMES only (no page text).
import { chromium } from 'playwright';
const url = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  const resp = await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
  const names = await page.$$eval('input,select,textarea,button', els =>
    els.map(e => `${e.tagName.toLowerCase()}:${(e.getAttribute('name') || e.id || '').replace(/[^A-Za-z0-9_:.\-]/g, '_').slice(0, 60)}`));
  console.log(`playwright: status=${resp ? resp.status() : 'none'} fields=${names.length}`);
  console.log(`playwright: field names: ${names.join(' ')}`);
} catch (e) {
  const m = String(e.message || e).match(/net::ERR_[A-Z_]+/);
  console.log(`playwright: failed ${m ? m[0] : e.name}`);
} finally {
  await browser.close();
}
