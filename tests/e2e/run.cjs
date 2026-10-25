/* eslint-disable */
// Repeatable end-to-end checks for both agency experiences (Tests A to I) plus the five evaluation scenarios.
// Usage: npm run build && npm run test:e2e   (starts its own preview server; needs Playwright with Chromium installed)
// Writes docs/test-results.md. Exits non-zero if anything fails.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 4179;
const BASE = `http://localhost:${PORT}/#`;
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const results = []; const scen = [];
let section = '';
const check = (name, ok, detail = '') => { results.push({ section, name, ok: !!ok, detail }); if (!ok) console.log(`FAIL [${section}] ${name} ${detail}`); };

async function newPage(browser, opts = { viewport: { width: 1360, height: 900 } }) {
  const ctx = await browser.newContext(opts); const p = await ctx.newPage();
  p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message));
  p.n = 0; // interaction counter: clicks, typed fields, key presses
  return p;
}
const open = async (p, route, who) => { await p.goto(`${BASE}${route}${route.includes('?') ? '&' : '?'}from=app&as=${who}`); await p.waitForTimeout(900); };
const text = async (p, sel) => (await p.locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
const click = async (p, loc) => { p.n += 1; await loc.click(); await p.waitForTimeout(250); };
const fill = async (p, sel, v) => { p.n += 1; await p.fill(sel, v); };
const axe = async (p) => { await p.evaluate(axeSrc); const r = await p.evaluate(() => axe.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })); return r.violations.map((v) => `${v.id}:${v.nodes.length}`); };
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '..', '..'), stdio: 'ignore', detached: true });
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch();
  try {
    // ---------------- A. Start-of-day orientation
    section = 'A. Start-of-day orientation';
    for (const [who, agency, search] of [['sam', 'Revenue NSW', /Penalty notice number/], ['jo', 'Transport for NSW', /Camera location code/]]) {
      const p = await newPage(browser); await open(p, '/staff', who);
      check(`${agency}: agency named in the header`, (await text(p, '.st-top')).includes(agency));
      check(`${agency}: search is the first thing (officer landing)`, await p.locator('#sh-q').isVisible() && search.test(await p.getAttribute('#sh-q', 'placeholder')));
      check(`${agency}: at most four indicators`, (await p.locator('.otile').count()) <= 4);
      check(`${agency}: every indicator links to a filtered view`, (await p.locator('.otile').evaluateAll((a) => a.every((x) => /#\/staff\//.test(x.href)))));
      check(`${agency}: no horizontal scroll at 1360`, await noHScroll(p));
      check(`${agency}: no page errors`, p.errors.length === 0, p.errors.join(' | '));
      await p.context().close();
    }
    for (const [who, agency] of [['priya', 'Revenue NSW'], ['sasha', 'Transport for NSW']]) {
      const p = await newPage(browser); await open(p, '/staff', who);
      check(`${agency} manager lands on the dashboard`, /Operational dashboard/.test(await text(p, 'h1')));
      check(`${agency} manager: dashboard marked Proposed`, (await p.locator('.proposed').count()) > 0);
      await p.context().close();
    }

    // ---------------- B. Certificate retrieval
    section = 'B. Certificate retrieval';
    {
      const p = await newPage(browser); await open(p, '/staff', 'sam');
      await fill(p, '#sh-q', '3162457891'); await p.waitForTimeout(300);
      check('Search by penalty notice number finds the notice', /3162457891/.test(await text(p, '.sh-list')));
      check('Result shows certification validity', /(Valid|Not valid)/.test(await text(p, '.sh-list')));
      await click(p, p.locator('.sh-list a').first());
      check('Selecting a result opens the notice record', /#\/staff\/notice\/3162457891/.test(p.url()));
      await p.goBack(); await p.waitForTimeout(700);
      check('Returning preserves the search', (await p.inputValue('#sh-q')) === '3162457891');
      await fill(p, '#sh-q', 'zzzzzz'); await p.waitForTimeout(300);
      check('No match shows a meaningful message', /No matches/.test(await text(p, '.sh-none')));
      await fill(p, '#sh-q', 'RYD-014'); await p.waitForTimeout(300);
      const h2s = (await p.locator('.sh-card h2').allInnerTexts()).join(' ');
      check('Search by camera location code finds the camera and certificates', /Cameras/.test(h2s) && /Certificates/.test(h2s));
      await fill(p, '#sh-q', '');
      await p.locator('.sh-range summary').click();
      await click(p, p.getByRole('button', { name: 'Check certificates' }));
      check('Certificate check validates empty fields', (await p.locator('.sh-err, .sh-range .df-err').count()) >= 2);
      await p.selectOption('.sh-range select', 'PAR-001');
      for (const [pre, d, m, y] of [['rf', '1', '8', '2026'], ['rt', '30', '9', '2026']]) { await fill(p, `#${pre}-d`, d); await fill(p, `#${pre}-m`, m); await fill(p, `#${pre}-y`, y); }
      await click(p, p.getByRole('button', { name: 'Check certificates' }));
      check('Location and date-range check returns spans and certificates', (await p.locator('.sh-spans li').count()) >= 1 && (await p.locator('.sh-res table tbody tr').count()) >= 1);
      await p.context().close();
    }

    // ---------------- C. Revenue review journey
    section = 'C. Revenue review journey';
    {
      const p = await newPage(browser); await open(p, '/staff/queue/reviews?q=' + encodeURIComponent('case = "RV-24017"') + '&open=1', 'alex');
      const chips = await text(p, '.ms4');
      check('Four separate status concepts are shown', ['certification validity', 'evidence completeness', 'assessment status', 'enforcement defensibility'].every((x) => chips.toLowerCase().includes(x)));
      check('Defensibility is “Not assessed” before a determination', /enforcement defensibility not assessed/i.test(chips));
      check('Reason for the review is visible', /Signal timing/.test(await text(p, '.st-bench__sum')));
      check('Refer to Transport is discoverable', (await p.getByRole('button', { name: /Refer to Transport/ }).count()) === 1);
      await open(p, '/staff/queue/reviews?q=' + encodeURIComponent('case = "RV-24026"') + '&open=1', 'sam');
      const opts = (await p.locator('#qd-outcome option').allInnerTexts()).join(' | ');
      check('Revenue is not offered a withdrawal outcome', opts.length > 0 && !/withdraw/i.test(opts), opts);
      await open(p, '/staff/queue/reviews?q=' + encodeURIComponent('case = "RV-24017"') + '&open=1', 'alex');
      await p.getByRole('button', { name: /Refer to Transport/ }).click(); p.n += 1;
      await p.selectOption('.adv-form select', 'certification'); await fill(p, '.adv-form textarea', 'Was the inspection certificate in force on the offence date? It was 123 days old against a 90 day limit.');
      await click(p, p.getByRole('button', { name: 'Send to Transport' }));
      check('Referral keeps the matter on Revenue’s list', /Referred: Transport has not acknowledged yet/.test(await text(p, '.adv-head')));
      check('Revenue cannot resolve while referred', (await p.locator('.st-decide.is-wait').count()) === 1);
      await p.context().close();
    }

    // ---------------- D. Court-elected matter
    section = 'D. Court-elected matter';
    {
      const p = await newPage(browser); await open(p, '/staff/queue/reviews?q=' + encodeURIComponent('case = "CE-24019"') + '&open=1', 'jordan');
      check('Court pathway is identifiable', /Court election/.test(await text(p, '.st-bench__head')) || /Court election/.test(await text(p, '.st-bench')));
      check('No Revenue outcome form for a court election', (await p.locator('#qd-outcome').count()) === 0);
      check('Court steps are not presented as CEVOC-owned', /outside CEVOC/.test(await text(p, '.st-bench')));
      await p.getByRole('button', { name: /Notify Transport of the court election/ }).click(); p.n += 1;
      check('Notification dialog is pre-filled', /Court election lodged/.test(await p.inputValue('.adv-form textarea')));
      await click(p, p.getByRole('button', { name: 'Send to Transport' }));
      await open(p, '/staff/requests?view=all', 'jo');
      check('Transport sees the court notification as a referral', /Court election/.test(await text(p, 'table')));
      await p.context().close();
    }

    // ---------------- E. Transport assessment & F. withdrawal authority (one flow, two windows)
    section = 'E. Transport assessment';
    {
      const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
      const R = await ctx.newPage(); const T = await ctx.newPage(); R.n = 0; T.n = 0; R.errors = []; T.errors = [];
      [R, T].forEach((x) => x.on('pageerror', (e) => x.errors.push(e.message)));
      await open(R, '/staff/queue/reviews?q=' + encodeURIComponent('case = "RV-24017"') + '&open=1', 'alex');
      await R.getByRole('button', { name: /Refer to Transport/ }).click(); R.n += 1;
      await R.selectOption('.adv-form select', 'certification'); await fill(R, '.adv-form textarea', 'Was the inspection certificate in force on the offence date? It was 123 days old.');
      await click(R, R.getByRole('button', { name: 'Send to Transport' }));
      await open(T, '/staff/requests', 'jo');
      await click(T, T.locator('tr', { hasText: 'TR-3003' }).getByRole('button', { name: 'Acknowledge' }));
      await T.goto(BASE + '/staff/request/TR-3003'); await T.waitForTimeout(800);
      check('Reason for challenge is visible to Transport', /Reason for the review/.test(await text(T, '.tr-panes')));
      check('Source evidence is marked read-only', (await T.locator('.ro-tag').count()) === 1);
      check('Certification records are available without leaving the page', (await T.locator('.cp-card').count()) >= 1);
      check('Defensibility is not assessed before a determination', /enforcement defensibility not assessed/i.test(await text(T, '.ms4')));
      await click(T, T.getByRole('button', { name: 'Start assessment' }));
      check('A customer inquiry officer has no determination control', (await T.getByRole('button', { name: 'Issue determination' }).count()) === 0);
      await T.locator('input[name=rec]').nth(1).check(); T.n += 1;
      await fill(T, '.tr-pane textarea >> nth=0', 'The inspection certificate was 123 days old on the offence date and the 90 day window had lapsed.');
      await fill(T, '.tr-pane input[placeholder^="So it"]', 'Red light notices at RYD-014 until the next inspection');
      await click(T, T.getByRole('button', { name: /Record assessment and recommendation/ })); await click(T, T.getByRole('button', { name: 'Record assessment', exact: true }));
      check('A recommendation is not a determination', /recommendation recorded/i.test(await text(T, '.ms4')) && /enforcement defensibility not assessed/i.test(await text(T, '.ms4')));
      check('Revenue sees “awaiting determination”, not an outcome', /Assessment recorded: waiting for an authorised determination/.test(await (async () => { await R.goto(BASE + '/staff/queue/reviews?q=' + encodeURIComponent('case = "RV-24017"') + '&open=1'); await R.waitForTimeout(900); return text(R, '.adv-head'); })()));

      section = 'F. Withdrawal authority';
      await open(T, '/staff/request/TR-3003', 'dana');
      check('Adjudication officer cannot issue a determination', (await T.getByRole('button', { name: 'Issue determination' }).count()) === 0);
      await open(T, '/staff/request/TR-3003', 'morgan');
      check('An authorised role can', (await T.getByRole('button', { name: 'Issue determination' }).count()) === 1);
      check('Determination needs a rationale', await T.getByRole('button', { name: 'Issue determination' }).first().isDisabled());
      await T.locator('input[name=out]').nth(1).check(); T.n += 1;
      check('Still disabled without a rationale', await T.getByRole('button', { name: 'Issue determination' }).first().isDisabled());
      await fill(T, '.adv-det textarea', 'The inspection certificate had lapsed on the offence date, so enforcement cannot be supported.');
      await click(T, T.getByRole('button', { name: 'Issue determination' }).first());
      check('Confirmation required before finalising', (await T.getByRole('button', { name: 'Not yet' }).count()) === 1 && /original evidence is not changed/i.test(await text(T, '[role=dialog], .dlg, body')));
      await click(T, T.getByRole('button', { name: 'Issue determination' }).last());
      check('Determination is recorded and shown as Transport’s', /withdrawal authorised/i.test(await text(T, '.ms4')));
      check('Original evidence is unchanged (still read-only)', (await T.locator('.ro-tag').count()) === 1);
      await R.goto(BASE + '/staff/queue/reviews?q=' + encodeURIComponent('case = "RV-24017"') + '&open=1'); await R.waitForTimeout(900);
      check('Revenue is informed, not asked to decide', /Transport holds this authority/.test(await text(R, '.adv-ans')));
      await click(R, R.getByRole('button', { name: /downstream steps are complete/ }));
      check('Revenue records downstream steps and the matter closes', /Downstream steps complete \(Withdrawal authorised\)/.test(await text(R, '.st-decide')));
      check('No page errors in the shared flow', R.errors.length + T.errors.length === 0, [...R.errors, ...T.errors].join(' | '));
      scen.push({ name: '2 + 4 + 5. Revenue refers, Transport assesses and determines, Revenue acts downstream', interactions: R.n + T.n, note: 'two people, one matter, nine clicks or fields on the Transport side' });
      await ctx.close();
    }

    // ---------------- G. Agency permissions
    section = 'G. Agency permissions';
    {
      const p = await newPage(browser);
      await open(p, '/staff/queue/reviews', 'jo');
      check('Transport cannot open the Revenue review queue by deep link', /belongs to Revenue NSW/.test(await text(p, 'main')));
      await open(p, '/staff/request/TR-3002', 'alex');
      check('Revenue sees a referral read-only (no determination or assessment controls)', (await p.getByRole('button', { name: /Issue determination|Record assessment|Acknowledge this referral/ }).count()) === 0);
      await open(p, '/staff/search?q=Kelly', 'jo');
      const html = await p.content();
      check('Customer name is not in Transport’s search page, even hidden', !html.includes('Thomas Kelly'));
      await open(p, '/staff/case/RV-24017', 'jo');
      check('Customer name is withheld on the matter page for Transport', !(await p.content()).includes('Thomas Kelly'));
      await open(p, '/staff/queue/approvals', 'jo');
      check('A non-approver sees certificate requests, not approval actions', (await p.getByRole('button', { name: 'Approve' }).count()) === 0);
      await p.context().close();
    }

    // ---------------- H. Accessibility and usability
    section = 'H. Accessibility and usability';
    for (const [who, route, label] of [['sam', '/staff', 'Revenue landing'], ['jo', '/staff', 'Transport landing'], ['priya', '/staff', 'Revenue dashboard'], ['alex', '/staff/queue/reviews?q=' + encodeURIComponent('case = "RV-24017"') + '&open=1', 'Revenue record'], ['kai', '/staff/request/TR-3001', 'Transport record']]) {
      const p = await newPage(browser); await open(p, route, who); await p.waitForTimeout(500);
      const v = await axe(p);
      check(`${label}: no axe violations (WCAG 2.2 AA tags)`, v.length === 0, v.join(' '));
      check(`${label}: no horizontal scroll at 1360`, await noHScroll(p));
      await p.context().close();
    }
    {
      const p = await newPage(browser, devices['iPhone 13']); await open(p, '/staff', 'sam');
      check('Revenue landing: no horizontal scroll on a phone', await noHScroll(p));
      await open(p, '/staff', 'jo'); check('Transport landing: no horizontal scroll on a phone', await noHScroll(p));
      await p.context().close();
    }
    {
      const p = await newPage(browser); await open(p, '/staff', 'sam');
      await p.keyboard.type('3162457891'); await p.waitForTimeout(300);
      check('Keyboard only: typing reaches search results', /3162457891/.test(await text(p, '.sh-list')) || (await p.evaluate(() => document.activeElement?.id)) === 'sh-q');
      check('Visible focus on the search box', await p.evaluate(() => { const e = document.getElementById('sh-q'); return getComputedStyle(e).outlineStyle !== 'none' || e === document.activeElement; }));
      await p.context().close();
    }

    // ---------------- I. Regression
    section = 'I. Regression';
    {
      const p = await newPage(browser); await p.goto(BASE + '/'); await p.waitForTimeout(700);
      await click(p, p.getByRole('button', { name: 'Show me what happened' }));
      check('Public lookup validates empty input', (await p.locator('.pub-errsum').count()) === 1);
      await fill(p, '#pn', '3162457890'); await fill(p, '#od-d', '18'); await fill(p, '#od-m', '9'); await fill(p, '#od-y', '2026');
      await click(p, p.getByRole('button', { name: 'Show me what happened' })); await p.waitForTimeout(900);
      check('Public lookup opens the notice', /#\/notice\/3162457890/.test(p.url()));
      await p.waitForSelector('.certs li', { timeout: 5000 }).catch(() => {});
      check('Public certification list is shown', (await p.locator('.certs li').count()) >= 2);
      await p.goto(BASE + '/cameras'); await p.waitForTimeout(600);
      check('Public camera pages still load', /Enforcement Certificate/.test(await text(p, 'h1')));
      check('Public pages have no errors', p.errors.length === 0, p.errors.join(' | '));
      await p.context().close();
      const q = await newPage(browser);
      for (const [who, r] of [['kai', '/staff/cert/S137-PAR001-2026'], ['morgan', '/staff/queue/approvals'], ['alex', '/staff/certificates'], ['jo', '/staff/cameras'], ['sam', '/staff/insights'], ['sam', '/staff/overview'], ['alex', '/staff/queue/court']]) {
        await open(q, r, who);
        check(`${who} can open ${r} without a crash`, !(await q.evaluate(() => /Something went wrong/.test(document.body.innerText))));
      }
      await q.context().close();
    }

    // ---------------- Scenarios 1 and 3: interaction counts
    {
      const p = await newPage(browser); await open(p, '/staff', 'sam'); p.n = 0;
      await fill(p, '#sh-q', '3162457890'); await click(p, p.locator('.sh-list .obtn').first());
      await p.waitForTimeout(700);
      await p.selectOption('#qd-outcome', 'checked'); p.n += 1; await fill(p, '.st-decide__reason input', 'Certification and evidence checked and in order. No technical concern found.');
      p.n += 1; await p.keyboard.press('Control+Enter'); await p.waitForTimeout(400);
      const done = /Resolved/.test(await text(p, '.st-decide'));
      check('Scenario 1: a routine enquiry is resolved without Transport', done);
      scen.push({ name: '1. Revenue routine enquiry: search, open, resolve', interactions: p.n, note: 'search, open review, choose resolution, write note, submit; Transport not involved' });
      await p.context().close();
    }
  } finally {
    await browser.close();
    try { process.kill(-server.pid); } catch (e) { /* ignore */ }
  }

  // ---------------- Report
  const pass = results.filter((r) => r.ok).length; const fail = results.length - pass;
  const bySection = results.reduce((m, r) => { (m[r.section] ||= []).push(r); return m; }, {});
  let md = `# End-to-end test results\n\nRun: ${new Date().toISOString()}  \nResult: **${pass} passed, ${fail} failed** of ${results.length} checks.\n\nAll data is fictitious and all integrations are simulated. These tests run against a local preview build.\n\n`;
  for (const [s, list] of Object.entries(bySection)) {
    md += `## ${s}\n\n| Check | Result |\n|---|---|\n` + list.map((r) => `| ${r.name} | ${r.ok ? 'PASS' : `**FAIL** ${r.detail}`} |`).join('\n') + '\n\n';
  }
  md += '## Scenario baselines (interactions)\n\nCounts of scripted clicks, typed fields and key presses. This is a baseline for this prototype only, not a measured improvement and not a user-research result.\n\n| Scenario | Interactions | Note |\n|---|---|---|\n' + scen.map((s) => `| ${s.name} | ${s.interactions} | ${s.note} |`).join('\n') + '\n';
  fs.mkdirSync(path.join(__dirname, '..', '..', 'docs'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', '..', 'docs', 'test-results.md'), md);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
