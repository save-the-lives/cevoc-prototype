/* eslint-disable */
// Named acceptance checks for the uplift stories and cross-cutting criteria (src/uplift/acceptance.js).
// Usage: npm run build && npm run test:acceptance   (serves dist itself; needs Playwright with Chromium)
// Each check prints PASS/FAIL with its name; the run fails if any check fails or if a check named in
// acceptance.js has no implementation here. Writes tests/acceptance/results.json.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.AC_PORT || 4191);
const ROOT = `http://127.0.0.1:${PORT}/`;
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const sydToday = () => new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: '2-digit', year: 'numeric' });

(async () => {
  const D = await import(path.join(__dirname, '..', '..', 'src', 'uplift', 'data.js'));
  const A = await import(path.join(__dirname, '..', '..', 'src', 'uplift', 'acceptance.js'));
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: path.join(__dirname, '..', '..'), stdio: 'ignore', detached: true });
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch();
  const sample = (label) => D.SAMPLES.find((s) => s.label === label);
  const search = (s) => `#${D.searchLink(s)}`;
  const recordAt = (s) => `#${D.recordLink ? D.recordLink(s) : `/uplift/record?loc=${s.loc}&at=${encodeURIComponent(s.at)}`}`;
  const rec = (label) => recordAt(D.RECORD_SAMPLES.find((s) => s.label === label));
  const signed = (o, r) => `#${D.signedLink(o, r)}`;

  async function page(route, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
    const p = await ctx.newPage();
    p.errors = []; p.logs = []; p.external = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    p.on('console', (m) => p.logs.push(m.text()));
    p.on('request', (r) => { if (!r.url().startsWith(ROOT) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) p.external.push(r.url()); });
    if (route !== null) { await p.goto(ROOT + route); await p.waitForTimeout(600); }
    return p;
  }
  const must = (c, msg) => { if (!c) throw new Error(msg); };
  const txt = async (p, sel) => (await p.locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  const axe = async (p) => { await p.evaluate(axeSrc); const r = await p.evaluate(() => axe.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })); return r.violations.map((v) => `${v.id}:${v.nodes.length}`); };
  const tourOn = async (p) => { await p.click('button:has-text("Tour")'); await p.waitForTimeout(200); };

  const C = {
    'search.location-suggestions': async () => { const p = await page('#/uplift'); await p.fill('#uh-loc', '12'); await p.waitForTimeout(300); must(await p.locator('[role=option]').count() > 0, 'no suggestions'); },
    'search.location-chip': async () => { const p = await page('#/uplift'); await p.fill('#uh-loc', '1234'); await p.waitForTimeout(300); await p.locator('[role=option]').first().click(); await p.fill('#uh-loc', '2345'); await p.waitForTimeout(300); await p.locator('[role=option]').first().click();
      must(await p.locator('button[aria-label^="Remove 1234"]').count() === 1 && await p.locator('button[aria-label^="Remove 2345"]').count() === 1, 'two removable chips expected'); },
    'search.multi-location-results': async () => { const p = await page(search(sample('Two cameras, missing and withdrawn'))); const t = await txt(p, '.uh-table'); must(/Location/i.test(await txt(p, '.uh-table thead')) && t.includes('1234') && t.includes('4567'), 'rows for both locations with a Location column'); },
    'search.default-range': async () => { const p = await page('#/uplift'); must(await p.isChecked(`input[name=uh-preset][value="${D.APP_SETTINGS.find((x) => x.key === 'search.defaultPreset').value}"]`), 'default preset not selected'); must(await p.inputValue('#dr-to') === sydToday(), 'To is not today (Sydney)'); },
    'search.preset-sets-range': async () => { const p = await page('#/uplift'); await p.check('input[name=uh-preset][value="Last 7 days"]', { force: true }); const t = new Date(); const f = new Date(t.getTime() - 6 * 864e5);
      must(await p.inputValue('#dr-to') === sydToday(), 'To not today'); must(await p.inputValue('#dr-from') !== '', 'From empty'); },
    'search.edit-makes-custom': async () => { const p = await page('#/uplift'); await p.fill('#dr-from', '01/01/2026'); must(await p.isChecked('input[name=uh-preset][value="Custom"]'), 'Custom not selected'); },
    'search.date-validation': async () => { const p = await page('#/uplift?locs=1234'); await p.fill('#dr-from', '31/02/2026'); await p.fill('#dr-to', '01/01/2026'); await p.click('button[type=submit]'); await p.waitForTimeout(200);
      const s = await txt(p, '.pub-errsum'); must(/real date/.test(s), 'bad date not reported'); },
    'search.sort-toggle': async () => { const p = await page(search(sample('One camera, a year'))); const th = p.locator('th:has(button.up-sort)').nth(1); await th.locator('button').click(); must(await th.getAttribute('aria-sort') === 'ascending', 'not ascending'); await th.locator('button').click(); must(await th.getAttribute('aria-sort') === 'descending', 'not descending'); },
    'search.sort-dates': async () => { const p = await page(search(sample('One camera, a year'))); const th = p.locator('th:has(button:has-text("Certified")), th:has(button:has-text("certified"))').first(); await th.locator('button').click();
      const idx = await p.evaluate(() => [...document.querySelectorAll('.uh-table thead th')].findIndex((h) => h.getAttribute('aria-sort')));
      const ds = await p.$$eval(`.uh-table tbody tr.uh-row td:nth-child(${idx + 1})`, (tds) => tds.map((t) => t.innerText.trim()));
      const n = ds.map((d) => { const [a, b, c] = d.split('/'); return +`${c}${b}${a}`; }); must(n.every((v, i) => !i || n[i - 1] <= v), `not date order: ${ds.join(',')}`); must(await th.getAttribute('aria-sort') === 'ascending', 'sort not announced'); },
    'search.expand-row': async () => { const p = await page(search(sample('One camera, a year'))); const b = p.locator('.uh-exp').first(); await b.click(); must(await b.getAttribute('aria-expanded') === 'true' && await p.locator('.uh-detail').count() === 1, 'details not shown'); },
    'search.collapse-row': async () => { const p = await page(search(sample('One camera, a year'))); const b = p.locator('.uh-exp').first(); await b.click(); await b.click(); must(await b.getAttribute('aria-expanded') === 'false' && await p.locator('.uh-detail').count() === 0, 'not collapsed'); },
    'search.expand-several': async () => { const p = await page(search(sample('One camera, a year'))); await p.locator('.uh-exp').nth(0).click(); await p.locator('.uh-exp').nth(1).click(); must(await p.locator('.uh-detail').count() === 2, 'two rows should stay open'); },
    'labels.switch': async () => { const p = await page('#/uplift'); const before = await txt(p, 'h1'); await tourOn(p); await p.check('input[name=uh-labels][value=legacy]', { force: true }); await p.waitForTimeout(150); const after = await txt(p, 'h1'); must(before !== after && after === 'Search', `h1 ${before} -> ${after}`); },
    'labels.kept': async () => { const p = await page('#/uplift'); await tourOn(p); await p.check('input[name=uh-labels][value=legacy]', { force: true }); await p.goto(ROOT + '#/uplift/hub'); await p.goto(ROOT + '#/uplift'); await p.waitForTimeout(400); must(await txt(p, 'h1') === 'Search', 'legacy labels not kept'); },
    'search.empty-state': async () => { const p = await page(search(sample('Nothing in range'))); const t = await txt(p, '.uh-empty'); must(/No certificates found/.test(t) && t.includes('2345') && await p.locator('.uh-empty button:has-text("Change the dates")').count() === 1, 'empty state incomplete'); must(await p.locator('.uh-table').count() === 0, 'table shown'); },
    'search.fault': async () => { const p = await page(search(sample('System fault'))); const t = await txt(p, '[role=alert]'); must(/system/i.test(t) && /not a missing certificate/.test(t), 'fault wording'); must(await p.locator('.uh-table, .uh-empty').count() === 0, 'table or empty state shown on fault'); },
    'search.fault-retry': async () => { const p = await page(search(sample('System fault'))); await p.click('button:has-text("Try again")'); await p.waitForTimeout(200); must(await p.locator('[role=alert]:has-text("system")').count() === 1, 'retry did not run the search'); },
    'search.gap-warning': async () => { const p = await page(search(sample('Two cameras, missing and withdrawn'))); const t = await txt(p, '.uh-gaps'); must(/Location 4567: no quarterly .*certificate from \d\d\/\d\d\/\d{4} to \d\d\/\d\d\/\d{4}/.test(t), `gap line: ${t}`); },
    'search.withdrawn-tag': async () => { const p = await page(search(sample('Two cameras, missing and withdrawn'))); must(/Withdrawn \d\d\/\d\d\/\d{4}/.test(await txt(p, '.uh-table')), 'withdrawn tag with date'); },
    'search.reissue-details': async () => { const p = await page(search(sample('Two cameras, missing and withdrawn'))); const row = p.locator('tr.uh-row:has(.st-tag:has-text("Re-issued"))').first(); await row.locator('.uh-exp').click(); must(/Re-issue of/.test(await txt(p, '.uh-detail')), 'details do not name the replaced certificate'); },
    'record.signed-link': async () => { const o = D.OFFENCES[0]; const p = await page(signed(o)); const t = await txt(p, 'main'); must(t.includes(o.p) && t.includes(o.s) && /Camera certificate details for this offence/.test(t), 'offence or certificate missing'); },
    'record.no-download': async () => { const p = await page(signed(D.OFFENCES[0])); must(await p.locator('main a[download], main button:has-text("Download"), main button:has-text("Print"), main button:has-text("Save")').count() === 0, 'download/print/save offered'); },
    'record.missing-warning': async () => { const p = await page(rec('Genuinely missing')); must(/No image capture \(red light\) certificate was in force on/.test(await txt(p, 'main')) && /13 22 13/.test(await txt(p, '.cd-states')), 'missing warning'); },
    'lifecycle.draft-hidden': async () => {
      const p = await page(search({ locs: ['4567'], from: '01/06/2026', to: '30/09/2026' })); const rows = await txt(p, '.uh-table'); must(!rows.includes('13/06/2026') && !/Draft/.test(rows), 'Draft certificate listed in search'); must(/no quarterly .*certificate from 13\/06\/2026/.test(await txt(p, 'main')), 'Draft period not reported as a gap');
      const r = await page(recordAt({ loc: '4567', at: '20/06/2026' })); const u = await txt(r, 'main'); must(!u.includes('13/06/2026') && !/Draft/.test(u), 'Draft certificate shown on record'); },
    'record.disclaimer-gipa': async () => { const p = await page(rec('Certified on the day')); const t = await txt(p, '.cd-disclaimer'); must(/not a legal document/i.test(t), 'no not-a-legal-document notice'); must(/access-to-information\/access-application/.test(await p.locator('.cd-disclaimer a').getAttribute('href')), 'no GIPA link'); },
    'record.withdrawn-notice': async () => { const p = await page(rec('Withdrawn, then re-issued')); must(/withdrawn on \d\d\/\d\d\/\d{4} and does not count/.test(await txt(p, '.cd-states')), 'withdrawn notice'); },
    // S23: every copy variant (legacy, A, B, C) lists one line per certificate type, for one type and for several.
    'record.copy-variants-cert-types': async () => {
      const longDay = (s) => D.parseDay(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
      const cases = [['three types', rec('Red light speed: three types'), 'RLSC', '1234', '14/03/2026'], ['two types (average speed)', signed(D.OFFENCES[2]), 'ASC', '3456', '20/04/2026'], ['one type', rec('One type in force, two missing'), 'RLSC', '1234', '05/09/2025']];
      const bad = [];
      for (const [name, route, program, site, at] of cases) {
        const present = D.certificatesAt(site, D.parseDay(at)).present;
        for (const [i, k] of ['legacy', 'A', 'B', 'C'].entries()) {
          const p = await page(route + '&tour=1'); await p.locator('.tr-copy input').nth(i).check({ force: true }); await p.waitForTimeout(150);
          const lead = await txt(p, '.cd-lead > p:first-child'); const lis = await p.$$eval('.cd-lead li', (xs) => xs.map((x) => x.innerText.replace(/\s+/g, ' ').trim())); const all = await txt(p, '.cd-lead');
          const at_ = `${k}, ${name}`;
          if (lis.length !== present.length) { bad.push(`${at_}: ${lis.length} lines, expected ${present.length}`); continue; }
          present.forEach((x, j) => { const label = D.typeOf(program, x.kind).label; if (!lis[j].includes(label) || !lis[j].includes(longDay(x.certified)) || !lis[j].includes(longDay(x.expiry))) bad.push(`${at_}: line ${j + 1} lacks type or dates: ${lis[j]}`); });
          if (present.length === 1 ? !/this certificate/.test(lead) || /these certificates/.test(lead) : !/these certificates/.test(lead)) bad.push(`${at_}: lead-in number wrong: ${lead}`);
          if ((k === 'legacy' || k === 'C') && present.length > 1 && lead !== 'On the day of your offence, these certificates were in force:') bad.push(`${at_}: lead ${lead}`);
          if (/[{}]|undefined|null/.test(all)) bad.push(`${at_}: leftover placeholder: ${all}`);
          if (k === 'C' && !/ask for a review/.test(all)) bad.push(`${at_}: tail missing`);
          if (k === 'A' && !all.includes(longDay(at))) bad.push(`${at_}: offence date missing`);
        }
      }
      must(!bad.length, bad.join(' | '));
    },
    // S12.3 / S23.3: one type has none in force: the existing warning names it, the other types are still listed.
    'record.cert-type-gap': async () => { const p = await page(rec('Speed measurement in force, image capture missing')); const w = await txt(p, '.cd-states'); const lis = await p.$$eval('.cd-lead li', (xs) => xs.map((x) => x.innerText));
      must(/No image capture \(red light\) certificate was in force on/.test(w), `warning: ${w}`); must(lis.length === 2 && lis.some((l) => /Speed measurement device/.test(l)) && lis.some((l) => /Image capture \(speed\)/.test(l)) && !lis.some((l) => /red light/.test(l)), `lines: ${lis.join(' / ')}`); },
    // S24: offence type is the one new field of phase 1, in Offence Details after Program type.
    'record.offence-type': async () => { const o = D.OFFENCES[1]; const p = await page(signed(o)); const dts = await p.$$eval('.cd-dl dt', (xs) => xs.map((x) => x.innerText.trim())); const dd = await txt(p, '.cd-dl dd:nth-of-type(3)');
      must(dts.indexOf('Offence type') === dts.indexOf('Program type') + 1, `order: ${dts}`); must(dd === o.offenceType && o.offenceType === 'Red light offence', `value ${dd}`); },
    'record.offence-type-per-offence': async () => { const a = D.OFFENCES[1]; const b = D.OFFENCES[3]; must(a.program === b.program && a.offenceType !== b.offenceType, 'sample offences should share a program and differ in type');
      const got = []; for (const o of [a, b]) { const p = await page(signed(o)); got.push(await txt(p, '.cd-dl dd:nth-of-type(3)')); } must(got[0] === a.offenceType && got[1] === b.offenceType, `got ${got}`); },
    'record.offence-type-unknown': async () => { const p = await page(rec('Certified on the day')); must(await txt(p, '.cd-dl dd:nth-of-type(3)') === 'Not in this link', 'unknown offence type not stated'); must(/Camera certificate details for this offence/.test(await txt(p, 'main')), 'rest of the page changed'); },
    'record.phase1-no-extra-fields': async () => { const want = ['Penalty notice number', 'Program type', 'Offence type', 'Site, zone or camera number', 'Site location', 'Date of offence', 'Time of offence']; const bad = [];
      for (const o of D.OFFENCES) { const p = await page(signed(o)); const dts = await p.$$eval('.cd-dl dt', (xs) => xs.map((x) => x.innerText.trim())); const t = await txt(p, 'main');
        if (dts.join('|') !== want.join('|')) bad.push(`${o.p}: ${dts}`); if (/Gazette|Device model|Approved for|Approval scope|Inspection (date|time|details)/i.test(t)) bad.push(`${o.p}: a Phase 2 field is shown`); }
      must(!bad.length, bad.join(' | ')); },
    'record.fault': async () => { const p = await page(rec('System fault')); must(/problem with our system/.test(await txt(p, '[role=alert]')) && await p.locator('button:has-text("Try again")').count() === 1, 'fault alert with Try again'); },
    'record.bad-link': async () => { const p = await page('#/uplift/record?loc=0000&at=99/99/2026'); must(/couldn’t open the certificate details from this link/.test(await txt(p, 'main')) && /13 22 13/.test(await txt(p, 'main')), 'bad link message'); },
    'search.error-summary': async () => { const p = await page('#/uplift'); await p.fill('#dr-from', ''); await p.click('button[type=submit]'); await p.waitForTimeout(200); const links = await p.$$eval('.pub-errsum a', (as) => as.map((a) => a.getAttribute('href'))); must(links.includes('#uh-loc') && links.includes('#dr-from'), `summary links ${links}`); must(await p.locator('.uh-results').count() === 0, 'search ran'); },
    'search.clear': async () => { const p = await page(search(sample('One camera, a year'))); await p.click('button:has-text("Clear")'); await p.waitForTimeout(200); must(await p.locator('.uh-results').count() === 0 && await p.locator('button[aria-label^="Remove "]').count() === 0, 'not cleared'); },
    'a11y.axe': async () => { const routes = ['#/uplift', search(sample('Two cameras, missing and withdrawn')), search(sample('Nothing in range')), search(sample('System fault')), signed(D.OFFENCES[0]), signed(D.OFFENCES[1]), signed(D.OFFENCES[2]), rec('Red light speed: three types'), rec('Speed measurement in force, image capture missing'), rec('Withdrawn, then re-issued'), rec('System fault'), '#/uplift/record?loc=0000&at=x'];
      const bad = []; for (const r of routes) { const p = await page(r); const v = await axe(p); if (v.length) bad.push(`${r}: ${v.join(' ')}`); } must(!bad.length, bad.join(' | ')); },
    'a11y.keyboard': async () => { const p = await page('#/uplift'); const seen = []; for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); const f = await p.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { tag: e.tagName, outline: s.outlineStyle !== 'none' || s.boxShadow !== 'none' }; }); seen.push(f); }
      must(seen.some((s) => s.tag === 'BUTTON') && seen.some((s) => s.tag === 'INPUT'), 'inputs and buttons not reachable'); must(seen.filter((s) => s.tag !== 'BODY').every((s) => s.outline), 'a focused control has no visible focus style'); },
    'a11y.status-in-words': async () => { const p = await page(search(sample('Two cameras, missing and withdrawn'))); const tags = await p.$$eval('.st-tag', (xs) => xs.map((x) => x.innerText.trim())); must(tags.length && tags.every((t) => /^(Current|Expired|Withdrawn|Re-issued|Not yet in force|Data error)/.test(t)), `tags ${tags}`); },
    'layout.phone-no-hscroll': async () => { const bad = []; for (const r of ['#/uplift', search(sample('Many locations')), signed(D.OFFENCES[0]), rec('Red light speed: three types'), rec('Withdrawn, then re-issued')]) for (const w of [320, 390]) { const p = await page(r, { viewport: { width: w, height: 800 } }); const sw = await p.evaluate(() => document.documentElement.scrollWidth); if (sw > w) bad.push(`${r}@${w}:${sw}`); } must(!bad.length, bad.join(' ')); },
    'record.return-link': async () => { const o = D.OFFENCES[0]; const p = await page(signed(o)); const a = p.locator('a.cd-return'); must((await a.innerText()).replace(/\s+/g, ' ') === `Return to ${D.SOURCES[o.r].name}` && await a.getAttribute('href') === D.SOURCES[o.r].url, 'return link'); },
    'record.close-tab': async () => { const p = await page(signed(D.OFFENCES[0], null)); must(await p.locator('a.cd-return').count() === 0 && /You can close this tab/.test(await txt(p, 'main')), 'close-tab text'); },
    'record.tampered-source': async () => { const o = D.OFFENCES[0]; const p = await page(signed(o, o.r === 'SNSW' ? 'RNSW' : 'SNSW')); must(/couldn’t open the certificate details/.test(await txt(p, 'main')) && !(await txt(p, 'main')).includes(o.p), 'changed source accepted'); },
    'record.tampered': async () => { const o = D.OFFENCES[0]; const p = await page(signed(o).replace(/m=[^&]+/, 'm=tampered')); const t = await txt(p, 'main'); must(/couldn’t open the certificate details/.test(t) && !t.includes(o.p) && !/Offence Details/.test(t), 'tampered link showed data'); },
    'record.missing-field': async () => { const o = D.OFFENCES[0]; const p = await page(signed(o).replace(/&d=[^&]+/, '')); must(/couldn’t open the certificate details/.test(await txt(p, 'main')), 'missing field accepted'); },
    'privacy.url-fields': async () => { const p = await page(signed(D.OFFENCES[0])); const u = new URL(p.url().replace('#/uplift/record', '')); const keys = [...new URLSearchParams(p.url().split('?')[1]).keys()]; must(keys.every((k) => ['p', 'd', 's', 'i', 'r', 'm'].includes(k)), `extra fields ${keys}`); },
    'privacy.no-console-data': async () => { const o = D.OFFENCES[0]; const p = await page(signed(o)); must(!p.logs.some((l) => l.includes(o.p) || l.includes(o.d)), 'console carries link values'); },
    'privacy.gipa-disclaimer': async () => { const p = await page(signed(D.OFFENCES[0])); must(/not a legal document/.test(await txt(p, '.cd-disclaimer')) && /access-application/.test(await p.getAttribute('.cd-disclaimer a', 'href')), 'disclaimer'); },
    'privacy.no-external-calls': async () => { const ext = []; for (const r of ['#/uplift', search(sample('One camera, a year')), signed(D.OFFENCES[0])]) { const p = await page(r); ext.push(...p.external); } must(!ext.length, ext.join(' ')); },
    'perf.record-phone': async () => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8 * 1.6, uploadThroughput: 750e3 / 8 });
      const t0 = Date.now(); await p.goto(ROOT + signed(D.OFFENCES[0])); await p.waitForSelector('.cd-lead .tr-dynv', { timeout: 10000 }); const ms = Date.now() - t0; console.log(`      record page on a throttled phone: ${ms} ms`); must(ms <= 3000, `${ms} ms`); },
    'hosting.subfolder': async () => { const routes = ['#/uplift', '#/uplift/hub', signed(D.OFFENCES[0])]; const bad = []; for (const r of routes) { const ctx = await browser.newContext(); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('requestfailed', (q) => errs.push(`failed ${q.url()}`));
      await p.route((u) => !u.href.startsWith(ROOT), (route) => route.abort()); await p.goto(`${ROOT}copy-test/../${r}`); await p.waitForTimeout(500); if (errs.length || !(await p.locator('h1').count())) bad.push(`${r}: ${errs.join(' ')}`); } must(!bad.length, bad.join(' | ')); },
  };

  const results = []; let fail = 0;
  const missing = A.ALL_CHECKS.filter((n) => !C[n]);
  for (const n of missing) { console.log(`FAIL  ${n}: named in acceptance.js but not implemented`); fail++; results.push({ check: n, ok: false, detail: 'not implemented' }); }
  for (const [n, fn] of Object.entries(C)) {
    try { await fn(); console.log(`PASS  ${n}`); results.push({ check: n, ok: true }); }
    catch (e) { console.log(`FAIL  ${n}: ${e.message.split('\n')[0]}`); results.push({ check: n, ok: false, detail: e.message.split('\n')[0] }); fail++; }
  }
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ ran: new Date().toISOString(), results }, null, 1));
  console.log(fail ? `${fail} FAILED of ${results.length}` : `ALL ${results.length} PASSED`);
  await browser.close(); try { process.kill(-server.pid); } catch {}
  process.exit(fail ? 1 : 0);
})();
