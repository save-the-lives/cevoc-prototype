import { TODAY } from '../../lib/format.js';
import { STAFF, PROGRAMS } from '../../data.js';

// A small Jira-style query language for the work queues.
//   assignee = me AND waiting > 14 AND certification = "not current" ORDER BY waiting DESC
// Plain words with no operators fall back to a free-text search across the row.

const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const staffName = (id) => STAFF.find((p) => p.id === id)?.name || '';

// type: text | enum | number | date | user
export const FIELDS = {
  priority: { type: 'enum', values: ['high', 'normal', 'low'], get: (r) => r.c.priority, sortVal: (r) => ({ high: 0, normal: 1, low: 2 })[r.c.priority], help: 'high, normal or low' },
  case: { type: 'text', alias: ['id'], get: (r) => r.c.id, help: 'Case number, e.g. RV-24017' },
  customer: { type: 'text', alias: ['holder'], get: (r) => r.n.holder, help: 'Name on the notice' },
  plate: { type: 'text', alias: ['rego'], get: (r) => r.n.rego, help: 'Number plate' },
  notice: { type: 'text', get: (r) => r.c.notice, help: 'Penalty notice number' },
  program: { type: 'text', get: (r) => r.program, help: 'Camera program', values: Object.values(PROGRAMS).map((p) => p.label) },
  camera: { type: 'text', get: (r) => r.n.site, help: 'Camera site code, e.g. RYD-014' },
  offence: { type: 'text', get: (r) => r.n.offence, help: 'Offence wording' },
  channel: { type: 'text', get: (r) => r.c.channel, help: 'How they asked: online form, letter, phone' },
  type: { type: 'enum', values: ['review', 'court'], get: (r) => r.c.type, help: 'review or court' },
  waiting: { type: 'number', alias: ['days', 'waited'], get: (r) => r.sla.waited, help: 'Days since they asked' },
  left: { type: 'number', get: (r) => r.sla.left, help: 'Days left to the target reply (negative = past it)' },
  asked: { type: 'date', alias: ['lodged'], get: (r) => r.c.lodged, help: 'Date they asked, e.g. 2026-10-01 or -14d' },
  target: { type: 'date', get: (r) => r.sla.due, help: 'Target reply date' },
  certification: { type: 'enum', alias: ['cert'], values: ['current', 'not current'], get: (r) => (r.ev.current ? 'current' : 'not current'), sortVal: (r) => -r.ev.notCurrent, help: 'current or "not current"' },
  notcurrent: { type: 'number', get: (r) => r.ev.notCurrent, help: 'How many certificates are not current' },
  assignee: { type: 'user', sortVal: (r) => (r.assignee ? staffName(r.assignee) : '~'), values: ['me', 'unassigned', ...STAFF.filter((p) => p.perms.includes('case:decide')).map((p) => p.name)], get: (r) => r.assignee, help: 'Who has it: me, a name, or unassigned' },
  status: { type: 'enum', values: ['open', 'decided'], get: (r) => (r.decision ? 'decided' : 'open'), help: 'open or decided' },
  decision: { type: 'text', get: (r) => r.decision?.label || '', help: 'Decision made' },
};
const ALIAS = Object.fromEntries(Object.entries(FIELDS).flatMap(([k, f]) => [[k, k], ...(f.alias || []).map((a) => [a, k])]));
export const FIELD_NAMES = Object.keys(FIELDS);

export const OPERATORS = ['=', '!=', '~', '!~', '>', '>=', '<', '<=', 'IN', 'NOT IN', 'IS EMPTY', 'IS NOT EMPTY'];
const KEYWORDS = new Set(['and', 'or', 'not', 'in', 'is', 'order', 'by', 'asc', 'desc', 'empty']);

export class QueryError extends Error { constructor(message, pos = 0, end = pos + 1) { super(message); this.pos = pos; this.end = end; } }

// ---------- tokens ----------
export function tokenize(text, loose = false) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    const two = text.slice(i, i + 2);
    if (['!=', '>=', '<=', '!~'].includes(two)) { out.push({ t: 'op', v: two, pos: i, end: i + 2 }); i += 2; continue; }
    if ('=<>~'.includes(ch)) { out.push({ t: 'op', v: ch, pos: i, end: i + 1 }); i += 1; continue; }
    if (ch === '(') { out.push({ t: 'lp', v: ch, pos: i, end: i + 1 }); i += 1; continue; }
    if (ch === ')') { out.push({ t: 'rp', v: ch, pos: i, end: i + 1 }); i += 1; continue; }
    if (ch === ',') { out.push({ t: 'comma', v: ch, pos: i, end: i + 1 }); i += 1; continue; }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== ch) j += 1;
      if (j >= text.length) { if (!loose) throw new QueryError('Missing closing quote', i, text.length); out.push({ t: 'str', v: text.slice(i + 1), pos: i, end: text.length, open: true }); i = text.length; continue; }
      out.push({ t: 'str', v: text.slice(i + 1, j), pos: i, end: j + 1 }); i = j + 1; continue;
    }
    let j = i;
    while (j < text.length && !/[\s=<>~!(),"']/.test(text[j])) j += 1;
    if (j === i) { if (!loose) throw new QueryError(`Unexpected "${ch}"`, i); i += 1; continue; }
    const v = text.slice(i, j);
    out.push({ t: KEYWORDS.has(v.toLowerCase()) ? 'kw' : 'word', v, pos: i, end: j });
    i = j;
  }
  return out;
}

// ---------- parser ----------
export function parse(text) {
  const toks = tokenize(text);
  let k = 0;
  const peek = () => toks[k];
  const next = () => toks[k++];
  const isKw = (t, w) => t && t.t === 'kw' && t.v.toLowerCase() === w;
  const endPos = text.length;

  function field() {
    const t = next();
    if (!t || (t.t !== 'word' && t.t !== 'kw')) throw new QueryError('Expected a field, for example assignee or waiting', t ? t.pos : endPos, t ? t.end : endPos);
    const key = ALIAS[t.v.toLowerCase()];
    if (!key) throw new QueryError(`Unknown field "${t.v}". Try ${FIELD_NAMES.slice(0, 6).join(', ')}…`, t.pos, t.end);
    return { key, tok: t };
  }

  function value(f) {
    const t = next();
    if (!t) throw new QueryError(`Expected a value for ${f.key}`, endPos);
    if (t.t === 'str') return { v: t.v, tok: t };
    if (t.t === 'word' || (t.t === 'kw' && t.v.toLowerCase() === 'empty')) {
      if (t.v.toLowerCase() === 'currentuser' && peek()?.t === 'lp') { next(); if (next()?.t !== 'rp') throw new QueryError('Expected ")"', t.end); return { v: 'me', tok: t }; }
      return { v: t.v, tok: t };
    }
    throw new QueryError(`Expected a value for ${f.key}`, t.pos, t.end);
  }

  function clause() {
    const { key, tok } = field();
    const f = FIELDS[key];
    const o = next();
    if (!o) throw new QueryError(`Expected an operator after ${key}, for example =`, endPos);
    let op;
    let values = [];
    if (o.t === 'op') {
      op = o.v;
      if (['>', '>=', '<', '<='].includes(op) && !['number', 'date'].includes(f.type)) throw new QueryError(`${key} is not a number or date, so ${op} won't work. Use = or ~`, o.pos, o.end);
      values = [value({ key })];
    } else if (isKw(o, 'in') || (isKw(o, 'not') && isKw(peek(), 'in'))) {
      op = 'IN';
      if (isKw(o, 'not')) { next(); op = 'NOT IN'; }
      if (next()?.t !== 'lp') throw new QueryError('Expected "(" after IN', o.end);
      for (;;) { values.push(value({ key })); const n = next(); if (n?.t === 'comma') continue; if (n?.t === 'rp') break; throw new QueryError('Expected "," or ")"', n ? n.pos : endPos); }
    } else if (isKw(o, 'is')) {
      op = 'IS EMPTY';
      if (isKw(peek(), 'not')) { next(); op = 'IS NOT EMPTY'; }
      if (!isKw(next(), 'empty')) throw new QueryError('Expected EMPTY after IS', o.end);
    } else throw new QueryError(`Expected an operator after ${key}, for example =`, o.pos, o.end);
    return { kind: 'clause', key, op, values, tok };
  }

  function primary() {
    if (peek()?.t === 'lp') { next(); const e = or(); if (next()?.t !== 'rp') throw new QueryError('Missing ")"', endPos); return e; }
    return clause();
  }
  function not() { if (isKw(peek(), 'not')) { next(); return { kind: 'not', e: not() }; } return primary(); }
  function and() { let l = not(); while (isKw(peek(), 'and')) { next(); l = { kind: 'and', l, r: not() }; } return l; }
  function or() { let l = and(); while (isKw(peek(), 'or')) { next(); l = { kind: 'or', l, r: and() }; } return l; }

  let expr = null;
  if (toks.length && !isKw(peek(), 'order')) expr = or();
  let order = [];
  if (isKw(peek(), 'order')) {
    next();
    if (!isKw(next(), 'by')) throw new QueryError('Expected BY after ORDER', endPos);
    for (;;) {
      const { key } = field();
      let dir = 'asc';
      if (isKw(peek(), 'asc') || isKw(peek(), 'desc')) dir = next().v.toLowerCase();
      order.push({ key, dir });
      if (peek()?.t === 'comma') { next(); continue; }
      break;
    }
  }
  if (peek()) { const t = peek(); throw new QueryError(`Unexpected "${t.v}". Join conditions with AND or OR`, t.pos, t.end); }
  return { expr, order };
}

// ---------- evaluation ----------
function resolve(f, raw, ctx) {
  const s = String(raw).trim();
  const low = s.toLowerCase();
  if (f.type === 'user') {
    if (low === 'me') return ctx.me;
    if (['unassigned', 'empty', 'none', 'nobody'].includes(low)) return null;
    const byName = STAFF.find((p) => p.name.toLowerCase() === low || p.name.toLowerCase().startsWith(low) || p.id === low);
    return byName ? byName.id : `?${low}`;
  }
  if (f.type === 'number') { const n = Number(s); if (Number.isNaN(n)) throw new QueryError(`"${s}" is not a number`); return n; }
  if (f.type === 'date') {
    const rel = /^([+-]?\d+)d$/i.exec(s);
    if (rel) return addDays(TODAY, Number(rel[1]));
    if (low === 'today') return TODAY;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new QueryError(`"${s}" is not a date. Use 2026-10-01, today or -14d`);
    return s;
  }
  return low;
}

function test(c, row, ctx) {
  const f = FIELDS[c.key];
  const actual = f.get(row);
  const isEmpty = actual === null || actual === undefined || actual === '';
  if (c.op === 'IS EMPTY') return isEmpty;
  if (c.op === 'IS NOT EMPTY') return !isEmpty;
  const vals = c.values.map((v) => resolve(f, v.v, ctx));
  const a = f.type === 'user' ? actual : typeof actual === 'string' ? actual.toLowerCase() : actual;
  const eq = (v) => (v === null ? isEmpty : a === v);
  switch (c.op) {
    case '=': return eq(vals[0]);
    case '!=': return !eq(vals[0]);
    case 'IN': return vals.some(eq);
    case 'NOT IN': return !vals.some(eq);
    case '~': return f.type === 'user' ? (staffName(actual).toLowerCase().includes(String(c.values[0].v).toLowerCase())) : String(a ?? '').includes(String(vals[0]));
    case '!~': return f.type === 'user' ? !(staffName(actual).toLowerCase().includes(String(c.values[0].v).toLowerCase())) : !String(a ?? '').includes(String(vals[0]));
    case '>': return a > vals[0];
    case '>=': return a >= vals[0];
    case '<': return a < vals[0];
    case '<=': return a <= vals[0];
    default: return false;
  }
}

function build(e, ctx) {
  if (!e) return () => true;
  if (e.kind === 'clause') { const resolved = e.values.forEach((v) => resolve(FIELDS[e.key], v.v, ctx)); void resolved; return (row) => test(e, row, ctx); }
  if (e.kind === 'not') { const f = build(e.e, ctx); return (row) => !f(row); }
  const l = build(e.l, ctx); const r = build(e.r, ctx);
  return e.kind === 'and' ? (row) => l(row) && r(row) : (row) => l(row) || r(row);
}

const looksLikeQuery = (t) => /[=<>~!]|\b(and|or|not|in|is|order)\b/i.test(t);

// Returns { ok, test(row), order, text, error }. Never throws.
export function compile(text, ctx) {
  const t = text.trim();
  if (!t) return { ok: true, test: () => true, order: [], text: '' };
  if (!looksLikeQuery(t)) {
    const needle = t.toLowerCase();
    return { ok: true, order: [], text: t, test: (row) => `${row.c.id} ${row.c.notice} ${row.n.holder} ${row.n.rego} ${row.program} ${row.n.offence}`.toLowerCase().includes(needle) };
  }
  try {
    const { expr, order } = parse(t);
    return { ok: true, order, text: '', test: build(expr, ctx) };
  } catch (e) {
    if (e instanceof QueryError) return { ok: false, error: { message: e.message, pos: e.pos, end: e.end }, test: () => true, order: [], text: '' };
    throw e;
  }
}

// ---------- suggestions ----------
const quoteIf = (s) => (/\s/.test(s) ? `"${s}"` : s);

// What can come next at the end of `text`? Returns { from, items } where `from` is the start of the word being typed.
export function suggest(text) {
  const toks = tokenize(text, true);
  const endsSpace = /\s$/.test(text) || text === '';
  const last = toks[toks.length - 1];
  const partialTok = !endsSpace && last && (last.t === 'word' || last.t === 'kw' || last.t === 'str') ? last : null;
  const done = partialTok ? toks.slice(0, -1) : toks;
  const from = partialTok ? partialTok.pos : text.length;
  const partial = partialTok ? partialTok.v.toLowerCase() : '';

  // walk the finished tokens to find what we expect next
  let state = 'field'; let key = null; let inList = false; let order = false;
  for (let i = 0; i < done.length; i += 1) {
    const t = done[i]; const w = t.v.toLowerCase();
    if (order) { if (t.t === 'comma') state = 'orderfield'; else if (w === 'asc' || w === 'desc') state = 'orderjoin'; else if (t.t === 'word') state = 'orderdir'; else if (w === 'by') state = 'orderfield'; continue; }
    if (state === 'field' || state === 'join') {
      if (w === 'order') { order = true; state = 'by'; continue; }
      if (t.t === 'lp') { state = 'field'; continue; }
      if (t.t === 'rp') { state = 'join'; continue; }
      if (w === 'not' && state === 'field') continue;
      if ((w === 'and' || w === 'or') && state === 'join') { state = 'field'; continue; }
      if (state === 'field' && ALIAS[w]) { key = ALIAS[w]; state = 'op'; continue; }
      continue;
    }
    if (state === 'op') {
      if (t.t === 'op') { state = 'value'; continue; }
      if (w === 'in') { state = 'lp'; continue; }
      if (w === 'not') { state = 'op'; continue; }
      if (w === 'is') { state = 'isempty'; continue; }
      continue;
    }
    if (state === 'lp') { if (t.t === 'lp') { inList = true; state = 'value'; } continue; }
    if (state === 'isempty') { if (w === 'empty') state = 'join'; continue; }
    if (state === 'value') {
      if (t.t === 'word' || t.t === 'str' || w === 'empty') { state = inList ? 'listjoin' : 'join'; }
      continue;
    }
    if (state === 'listjoin') { if (t.t === 'comma') state = 'value'; else if (t.t === 'rp') { inList = false; state = 'join'; } continue; }
  }
  if (order && state === 'by') { return { from, items: ['BY'].filter((x) => x.toLowerCase().startsWith(partial)).map((v) => ({ label: v, insert: v })) }; }

  const mk = (list, meta = {}) => list.filter((x) => (x.label || x).toString().toLowerCase().startsWith(partial))
    .map((x) => (typeof x === 'string' ? { label: x, insert: quoteIf(x) } : { insert: quoteIf(x.label), ...x })).map((x) => ({ ...meta, ...x }));
  let items = [];
  if (state === 'field') items = [...mk(FIELD_NAMES.map((n) => ({ label: n, insert: n, hint: FIELDS[n].help })), {}), ...mk([{ label: 'NOT', insert: 'NOT' }])];
  else if (state === 'op') items = mk(OPERATORS.map((o) => ({ label: o, insert: o })));
  else if (state === 'lp') items = mk([{ label: '(', insert: '(' }]);
  else if (state === 'value' && key) {
    const f = FIELDS[key];
    const vals = f.type === 'date' ? ['today', '-7d', '-14d', '-28d'] : f.values || [];
    items = mk(vals.map((v) => ({ label: v, insert: quoteIf(v) })));
    if (f.type === 'user') items = items.concat(mk([{ label: 'EMPTY', insert: 'EMPTY' }]));
  } else if (state === 'join' || state === 'listjoin') items = state === 'listjoin' ? mk([',', ')'].map((x) => ({ label: x, insert: x }))) : mk(['AND', 'OR', 'ORDER BY'].map((x) => ({ label: x, insert: x })));
  else if (state === 'orderfield') items = mk(FIELD_NAMES.map((n) => ({ label: n, insert: n, hint: FIELDS[n].help })));
  else if (state === 'orderdir') items = mk(['ASC', 'DESC', ','].map((x) => ({ label: x, insert: x })));
  else if (state === 'orderjoin') items = [];
  // do not offer exactly what is already typed
  items = items.filter((x) => x.insert.toLowerCase() !== partial || partial === '');
  return { from, items: items.slice(0, state === 'op' ? 12 : 8), state };
}

// Saved filters shown as chips above the queue.
export const PRESETS = [
  { label: 'All', q: '' },
  { label: 'Mine', q: 'assignee = me' },
  { label: 'Unassigned', q: 'assignee = unassigned' },
  { label: 'With others', q: 'assignee IS NOT EMPTY AND assignee != me' },
  { label: 'Past target', q: 'left < 0 ORDER BY waiting DESC' },
  { label: 'Certificate not current', q: 'certification = "not current"' },
  { label: 'High priority', q: 'priority = high AND status = open' },
];

export const EXAMPLES = [
  { title: 'My cases that have waited more than two weeks', q: 'assignee = me AND waiting > 14' },
  { title: 'Unassigned, newest requests first', q: 'asked >= -14d AND assignee IS EMPTY ORDER BY waiting DESC' },
  { title: 'High or normal priority with a certificate problem', q: 'priority IN (high, normal) AND certification = "not current"' },
  { title: 'Find a person or a plate', q: 'customer ~ "kelly" OR plate = RED777' },
  { title: 'Red-light cases still open', q: 'program ~ "red-light" AND NOT status = decided' },
];

// Sort rows by an ORDER BY list, e.g. [{ key: 'waiting', dir: 'desc' }].
export function orderRows(rows, order) {
  const val = (key, r) => { const f = FIELDS[key]; return f.sortVal ? f.sortVal(r) : f.get(r); };
  return [...rows].sort((a, b) => {
    for (const { key, dir } of order) {
      const x = val(key, a); const y = val(key, b);
      if (x < y) return dir === 'asc' ? -1 : 1;
      if (x > y) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
}
