// A small JQL-style query language for the Stories, Questions and ADR lists (owner, 25 Nov 2026).
//   user = "Revenue NSW officer" AND path = exception AND ready = no
//   status IN ("Assumption to validate", "Confirmation required") AND NOT owner ~ CMCS
//   brd = BR_01 OR brd = BR_09
// Operators: = (equals, case-insensitive), != , ~ (contains), !~ (does not contain), IN (...), NOT IN (...).
// NOT negates the next clause or bracket. AND binds tighter than OR; brackets group. Anything that is not a
// clause is free text, matched against every field. Unknown fields are reported, never silently ignored.

const TOKEN = /\s*(\(|\)|,|"[^"]*"?|!=|!~|=|~|[^\s(),=!~"]+)/y;
export const OPS = ['=', '!=', '~', '!~', 'IN', 'NOT IN'];
const KW = (s, k) => String(s || '').toUpperCase() === k;

export function tokens(q) {
  const out = []; TOKEN.lastIndex = 0; let m;
  while (TOKEN.lastIndex < q.length && (m = TOKEN.exec(q))) { if (m[1] === undefined) break; out.push(m[1]); }
  return out;
}

const unq = (s) => (s && s[0] === '"' ? s.replace(/^"|"$/g, '') : s);

export function compile(query, fields) {
  const t = tokens(query.trim());
  let i = 0;
  const errors = [];
  const peek = () => t[i];
  const isOp = (k) => ['=', '!=', '~', '!~'].includes(t[k]) || KW(t[k], 'IN') || (KW(t[k], 'NOT') && KW(t[k + 1], 'IN'));
  const looksLikeField = (k) => t[k] && !['(', ')', ','].includes(t[k]) && isOp(k + 1);
  function clause() {
    const a = t[i]; const field = a.toLowerCase(); i++;
    let op = t[i]; i++;
    if (KW(op, 'NOT')) { op = 'NOT IN'; i++; } else if (KW(op, 'IN')) op = 'IN';
    let vals = [];
    if (op === 'IN' || op === 'NOT IN') {
      if (peek() !== '(') { errors.push(`${op} needs a list in brackets, e.g. ${a} ${op} (x, y)`); return () => true; }
      i++;
      while (i < t.length && peek() !== ')') { if (peek() !== ',') vals.push(unq(peek()).toLowerCase()); i++; }
      if (peek() === ')') i++; else errors.push('Missing )');
    } else vals = [unq(t[i++] || '').toLowerCase()];
    const get = fields[field];
    if (!get) { errors.push(`Unknown field “${a}”. Fields: ${Object.keys(fields).join(', ')}`); return () => true; }
    return (it) => {
      const have = [].concat(get(it) ?? '').map((v) => String(v).toLowerCase());
      const v = vals[0];
      if (op === '=') return have.some((h) => h === v);
      if (op === '!=') return have.every((h) => h !== v);
      if (op === '~') return have.some((h) => h.includes(v));
      if (op === '!~') return have.every((h) => !h.includes(v));
      if (op === 'IN') return have.some((h) => vals.includes(h));
      return have.every((h) => !vals.includes(h));
    };
  }
  function atom() {
    if (KW(peek(), 'NOT') && !KW(t[i + 1], 'IN')) { i++; const e = atom(); return (it) => !e(it); }
    if (peek() === '(') { i++; const e = or(); if (peek() === ')') i++; else errors.push('Missing )'); return e; }
    if (looksLikeField(i)) return clause();
    const word = unq(t[i++] || '').toLowerCase();
    return (it) => Object.values(fields).some((g) => [].concat(g(it) ?? '').some((v) => String(v).toLowerCase().includes(word)));
  }
  function and() {
    let l = atom();
    while (i < t.length && peek() !== ')' && !KW(peek(), 'OR')) {
      if (KW(peek(), 'AND')) i++;
      if (i >= t.length) break;
      const r = atom(); const a = l; l = (it) => a(it) && r(it);
    }
    return l;
  }
  function or() {
    let l = and();
    while (KW(peek(), 'OR')) { i++; const r = and(); const a = l; l = (it) => a(it) || r(it); }
    return l;
  }
  const fn = t.length ? or() : () => true;
  return { test: fn, errors };
}

// Autocomplete: what can come next at the cursor. `fields` maps name -> getter; `values` maps name -> list.
// Returns { from, items: [{ label, insert, kind }] } where `from` is where the partial word starts.
export function suggest(text, fields, values) {
  const endsInSpace = /\s$/.test(text) || text === '';
  const t = tokens(text);
  let partial = '';
  if (!endsInSpace && t.length && !['(', ')', ','].includes(t[t.length - 1])) partial = t.pop();
  const from = text.length - partial.length;
  const p = unq(partial).toLowerCase();
  const last = t[t.length - 1];
  const prev = t[t.length - 2];
  const names = Object.keys(fields);
  const quote = (v) => (/[\s(),=!~]/.test(v) ? `"${v}"` : v);
  const match = (list, kind, fmt = (x) => x) => list.filter((x) => String(x).toLowerCase().startsWith(p) && String(x).toLowerCase() !== p).map((x) => ({ label: String(x), insert: `${fmt(String(x))} `, kind }));
  // Inside an IN list? Walk back to an unclosed "(" preceded by IN.
  let depth = 0;
  for (let k = t.length - 1; k >= 0; k--) {
    if (t[k] === ')') depth++;
    else if (t[k] === '(') {
      if (depth === 0) { if (KW(t[k - 1], 'IN')) { const f = (KW(t[k - 2], 'NOT') ? t[k - 3] : t[k - 2] || '').toLowerCase(); if (last === '(' || last === ',') return { from, items: match(values[f] || [], 'value', quote).map((x) => ({ ...x, insert: x.insert.trimEnd() })) }; return { from, items: match([',', ')'], 'syntax') }; } break; }
      depth--;
    }
  }
  const isCmp = (s) => ['=', '!=', '~', '!~'].includes(s);
  if (isCmp(last)) { const f = String(prev || '').toLowerCase(); return { from, items: match(values[f] || [], 'value', quote) }; }
  if (KW(last, 'IN')) return { from, items: [{ label: '(', insert: '(', kind: 'syntax' }] };
  if (last && names.includes(last.toLowerCase())) return { from, items: match(OPS, 'operator') };
  if (!last || last === '(' || KW(last, 'AND') || KW(last, 'OR') || (KW(last, 'NOT') && !names.includes(String(prev).toLowerCase()))) {
    return { from, items: [...match(names, 'field'), ...match(['NOT', '('], 'keyword')] };
  }
  if (KW(last, 'NOT')) return { from, items: match(['IN'], 'operator') };
  return { from, items: match(['AND', 'OR', ')'], 'keyword') };
}

export function unknownField(text, fields) {
  const t = tokens(text);
  for (let k = 0; k < t.length - 1; k++) {
    const nextIsOp = ['=', '!=', '~', '!~'].includes(t[k + 1]) || KW(t[k + 1], 'IN') || (KW(t[k + 1], 'NOT') && KW(t[k + 2], 'IN'));
    if (nextIsOp && !['(', ')', ','].includes(t[k]) && !fields[t[k].toLowerCase()]) return t[k];
  }
  return null;
}
