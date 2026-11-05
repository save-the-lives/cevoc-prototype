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
