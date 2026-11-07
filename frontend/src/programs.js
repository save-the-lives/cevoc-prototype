// Per-program display configuration: which program a notice belongs to, which version applies on the offence date, and which
// returned details to show with what label. Pure functions. Config is plain JSON in the repo (programs.json).
// Nothing here knows about a provider: it reads the result's flexible details map (decision record 0009).
import config from './programs.json';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Fail-fast checks for one program's versions: valid dates, one open end, no overlap, no gap. Returns a list of problems. */
export function checkVersions(program) {
  const problems = [];
  const v = [...(program.versions || [])].sort((a, b) => a.from.localeCompare(b.from));
  if (!v.length) problems.push(`${program.id}: no versions`);
  v.forEach((x, i) => {
    if (!DAY.test(x.from) || (x.to != null && !DAY.test(x.to))) problems.push(`${program.id}: bad date in ${x.version}`);
    if (x.to != null && x.from > x.to) problems.push(`${program.id}: ${x.version} starts after it ends`);
    if (x.to == null && i !== v.length - 1) problems.push(`${program.id}: ${x.version} has no end but is not the last`);
    const next = v[i + 1];
    if (next && x.to != null) {
      const after = nextDay(x.to);
      if (next.from < after) problems.push(`${program.id}: ${x.version} overlaps ${next.version}`);
      if (next.from > after) problems.push(`${program.id}: gap between ${x.version} and ${next.version}`);
    }
  });
  return problems;
}

function nextDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The program for a result, from the offence text first, then from details keys; null when nothing matches. */
export function pickProgram(result, cfg = config) {
  const text = String(result?.notice?.offenceDescription || '').toLowerCase();
  const offenceText = String(result?.details?.offenceText || '').toLowerCase();
  const keys = Object.keys(result?.details || {});
  for (const p of cfg.programs) {
    const m = p.match || {};
    if ((m.offenceTextContains || []).some((t) => text.includes(t) || offenceText.includes(t))) return p;
    if ((m.detailKeysAny || []).some((k) => keys.includes(k))) return p;
  }
  return null;
}

/** The version covering an offence date ('yyyy-MM-dd'), or null. Both ends inclusive; no end means current. */
export function pickVersion(program, offenceDate) {
  if (!program || !DAY.test(offenceDate || '')) return null;
  return program.versions.find((v) => v.from <= offenceDate && (v.to == null || offenceDate <= v.to)) || null;
}

/**
 * Rows to show for a result. Always returns a plain object: { state, title, rows, message }.
 * state: 'rows' (a program and version matched), 'no-version' (program known, no version covers the date), 'default' (no program).
 * A configured detail the notice did not return is a row with `missing: true` (the page says so plainly, it is never hidden silently);
 * a number gets its configured unit.
 */
export function detailRows(result, cfg = config) {
  const program = pickProgram(result, cfg);
  if (!program) return { state: 'default', title: null, rows: [], message: cfg.default.message };
  const version = pickVersion(program, result?.notice?.offenceDate);
  if (!version) {
    return { state: 'no-version', title: program.label, rows: [], message: 'We do not have display rules for an offence on this date, so these details are not shown.' };
  }
  const details = result?.details || {};
  const rows = version.details
    .map((d) => {
      const raw = details[d.key];
      if (raw === undefined || raw === null || String(raw).trim() === '') return { key: d.key, label: d.label, first: !!d.first, value: null, missing: true };
      const value = d.unit && typeof raw === 'number' ? `${raw} ${d.unit}` : String(raw);
      return { key: d.key, label: d.label, first: !!d.first, value };
    })
  ;
  return { state: 'rows', title: program.label, rows, message: null, version: version.version, types: version.types };
}

/** Evaluate one condition against a details map. Supported ops: >, >=, <, <=, ==, !=. */
function evalCondition(cond, details) {
  if (!cond || !details) return false;
  const val = details[cond.field];
  if (val === undefined || val === null) return false;
  switch (cond.op) {
    case '>': return val > cond.value;
    case '>=': return val >= cond.value;
    case '<': return val < cond.value;
    case '<=': return val <= cond.value;
    case '==': return val == cond.value; // eslint-disable-line eqeqeq
    case '!=': return val != cond.value; // eslint-disable-line eqeqeq
    default: return false;
  }
}

/**
 * The road-safety message for a result, or null. Evaluates the program's message rules against the result's details,
 * picks the highest-priority match (lowest number wins), and returns { text, priority }. Falls back to the default
 * block's messages when the program has none of its own. Returns null when the messages switch is off, when no rule
 * matches, or when no messages are configured.
 */
export function pickMessage(result, cfg = config) {
  const sw = resolveSwitches(result, cfg).types.messages || {};
  if (sw.mode && sw.mode !== 'on') return null;

  const details = result?.details || {};
  const date = result?.notice?.offenceDate;
  const program = pickProgram(result, cfg);
  const version = program ? pickVersion(program, date) : null;

  // Program's own messages, then default block's messages as fallback.
  const rules = version?.messages || defaultVersion(date, cfg).messages || [];

  let best = null;
  for (const rule of rules) {
    if (!evalCondition(rule.condition, details)) continue;
    if (best === null || rule.priority < best.priority) best = rule;
  }
  return best ? { text: best.text, priority: best.priority } : null;
}

const SWITCH_OFF_TEXT = 'Video is not available for this program.';

/** The default block's version for an offence date. It never fails: with no covering version the open (or latest) one is used. */
export function defaultVersion(offenceDate, cfg = config) {
  const d = cfg.default || {};
  const list = d.versions || [];
  return pickVersion(d, offenceDate) || [...list].sort((a, b) => b.from.localeCompare(a.from))[0] || { types: {} };
}

/**
 * The effective switches for a result (images, certificates, video, evidence_pack, messages). A program's own block always wins;
 * a switch the program does not set is inherited from the default block. An unknown program, or a program with no version for the
 * offence date, gets the default block's switches. Returns { source: 'program' | 'default', types: { name: { mode, message?, messageNone? } } }.
 */
export function resolveSwitches(result, cfg = config) {
  const date = result?.notice?.offenceDate;
  const base = defaultVersion(date, cfg).types || {};
  const version = pickVersion(pickProgram(result, cfg), date);
  if (!version) return { source: 'default', types: { ...base } };
  return { source: 'program', types: { ...base, ...(version.types || {}) } };
}

/**
 * What to do about video for a result: { render, message }. Video on and returned: render it. Video on and none returned: say so plainly.
 * Video off, not applicable or not yet (the program's own choice): do not render or fetch it, show the program's message
 * (or a fixed plain one). Never a download, never in the evidence pack.
 */
export function videoView(result, cfg = config) {
  const sw = resolveSwitches(result, cfg).types.video || { mode: 'on' };
  if (sw.mode !== 'on') return { render: false, message: sw.message || SWITCH_OFF_TEXT };
  const returned = (result?.evidence || []).some((e) => e.kind === 'VIDEO');
  return returned ? { render: true, message: null } : { render: false, message: sw.messageNone || 'Video is not available yet for this notice.' };
}
