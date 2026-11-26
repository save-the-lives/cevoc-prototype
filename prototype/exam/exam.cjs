// Browser + HTTP checks for exam/run-exam.sh. Invented data only.
// node exam/exam.cjs <base-url> part1|part2
const { chromium } = require('playwright');
const [base, part] = process.argv.slice(2);
const MARK = 'EXAM-MARKER shared question';
let failed = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) failed++; };
const api = (q = '', init) => fetch(`${base}api/state.php${q}`, init).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

async function page(browser, hash) {
  const ctx = await browser.newContext();            // fresh context = another person's browser, no localStorage
  const p = await ctx.newPage();
  const errors = [], external = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) external.push(r.url()); });
  await p.goto(base + hash, { waitUntil: 'networkidle' });
  return { p, ctx, errors, external };
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (part === 'part1') {
      const h = await api();
      ok(h.status === 200 && h.body?.storage === 'sqlite', `api/state.php answers with SQLite (${h.status})`);
      for (const path of ['data/cevoc.sqlite', 'data/', '.git/config', '.git/HEAD', 'data/README.txt']) {
        const r = await fetch(base + path); ok(r.status >= 400, `${path} is not served (${r.status})`);
      }
      for (const hash of ['#/uplift', '#/uplift/hub/', '#/uplift/hub/stories', '#/uplift/hub/adrs']) {
        const { ctx, errors, external } = await page(browser, hash);
        ok(errors.length === 0, `${hash} has no page errors ${errors.slice(0, 2).join(' | ')}`);
        ok(external.length === 0, `${hash} makes no external calls ${external.slice(0, 2).join(' ')}`);
        await ctx.close();
      }
      // Person A saves (same call the page makes); person B, in a fresh browser, must see it.
      const w = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'questions', set: { U900: { isNew: true, q: MARK, status: 'Open', phase: 'Backlog (Phase 2)', updatedAt: new Date().toISOString() } } }) });
      ok(w.status === 200 && w.body?.items?.U900?.q === MARK, `save accepted (${w.status} ${w.body?.error || ''})`);
      const ws = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'stories', set: { S901: { isNew: true, want: 'exam story', phase: 'Backlog (Phase 2)', updatedAt: new Date().toISOString() } } }) });
      ok(ws.status === 200 && ws.body?.items?.S901?.phase === 'Backlog (Phase 2)' && w.body?.items?.U900?.phase === 'Backlog (Phase 2)', `Phase saved for stories and questions (${ws.status} ${ws.body?.error || ''})`);
      await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'stories', set: { S901: null } }) });
      const bad = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'questions', set: { U901: { evil: 'x' } } }) });
      ok(bad.status === 400, `unknown field refused (${bad.status})`);
      const bad2 = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: '../x', set: {} }) });
      ok(bad2.status === 400, `unknown kind refused (${bad2.status})`);
      const db = await fetch(base + 'data/cevoc.sqlite'); ok(db.status >= 400, `database file is not downloadable once it exists (${db.status})`);
    }
    if (!process.env.EXAM_SKIP_UI) {
    // both parts: a fresh browser shows shared storage and the saved item
    const { p, ctx, errors } = await page(browser, '#/uplift/hub/questions');
    await p.waitForSelector('[data-storage="server"]', { timeout: 10000 }).catch(() => {});
    ok(await p.locator('[data-storage="server"]').count() > 0, 'Questions page says shared storage');
    ok(await p.getByText(MARK).count() > 0, 'a fresh browser sees the saved question');
    ok(errors.length === 0, `Questions page has no errors ${errors.slice(0, 2).join(' | ')}`);
    await ctx.close();
    }
    if (part === 'part2') {
      const g = await api('?kind=questions');
      ok(g.body?.items?.U900?.q === MARK, 'saved question still in the database after the pulls');
    }
  } finally { await browser.close(); }
  process.exit(failed ? 1 : 0);
})();
