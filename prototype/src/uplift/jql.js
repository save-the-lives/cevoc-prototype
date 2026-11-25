// A small JQL-style query language for the Stories and Questions lists (owner, 25 Nov 2026).
//   user = "Revenue NSW officer" AND path = exception AND ready = no
//   status = "Assumption to validate" AND owner ~ CMCS
//   brd = BR_01 OR brd = BR_09
// Operators: = (equals, case-insensitive), != , ~ (contains), !~ (does not contain).
// AND binds tighter than OR; parentheses group. Anything that is not a clause is free text, matched against every
// field. Unknown fields are reported, never silently ignored.

const TOKEN = /\s*(\(|\)|"[^"]*"|!=|!~|=|~|[^\s()=!~"]+)/y;

function tokens(q) {
  const out = []; TOKEN.lastIndex = 0; let m;
  while (TOKEN.lastIndex < q.length && (m = TOKEN.exec(q))) out.push(m[1]);
  return out;
}

export function compile(query, fields) {
  const t = tokens(query.trim());
  let i = 0;
  const errors = [];
  const peek = () => t[i];
  const unq = (s) => (s && s[0] === '"' ? s.slice(1, -1) : s);
  const isOp = (s) => ['=', '!=', '~', '!~'].includes(s);
  function atom() {
    if (peek() === '(') { i++; const e = or(); if (peek() === ')') i++; else errors.push('Missing )'); return e; }
    const a = t[i];
    if (a && isOp(t[i + 1])) {
      const field = a.toLowerCase(); const op = t[i + 1]; const val = unq(t[i + 2] || '').toLowerCase(); i += 3;
      const get = fields[field];
      if (!get) { errors.push(`Unknown field “${a}”. Fields: ${Object.keys(fields).join(', ')}`); return () => true; }
      return (it) => {
        const vals = [].concat(get(it) ?? '').map((v) => String(v).toLowerCase());
        if (op === '=') return vals.some((v) => v === val);
        if (op === '!=') return vals.every((v) => v !== val);
        if (op === '~') return vals.some((v) => v.includes(val));
        return vals.every((v) => !v.includes(val));
      };
    }
    i++;
    const word = unq(a || '').toLowerCase();
    return (it) => Object.values(fields).some((g) => [].concat(g(it) ?? '').some((v) => String(v).toLowerCase().includes(word)));
  }
  function and() {
    let l = atom();
    while (i < t.length && peek() !== ')' && peek()?.toUpperCase() !== 'OR') {
      if (peek()?.toUpperCase() === 'AND') i++;
      const r = atom(); const a = l; l = (it) => a(it) && r(it);
    }
    return l;
  }
  function or() {
    let l = and();
    while (peek()?.toUpperCase() === 'OR') { i++; const r = and(); const a = l; l = (it) => a(it) || r(it); }
    return l;
  }
  const fn = t.length ? or() : () => true;
  return { test: fn, errors };
}
