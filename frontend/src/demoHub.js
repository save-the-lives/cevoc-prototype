// Pure helpers for the demo hub (docs/DEMO-DATA.md). The list itself comes from the backend (GET /api/demo/cases), which exists
// only while demo data is switched on; nothing here knows the cases. All values shown are fictitious.
export const HUB_PATHS = ['/demo-cases', '/test-cases'];

export function isDemoHubRoute(loc) {
  const path = String(loc?.pathname || '').replace(/\/+$/, '');
  return HUB_PATHS.includes(path);
}

/** The ten-digit demo number in `?demo=`, or null. The caller removes it from the address bar at once. */
export function demoCaseParam(search) {
  const v = new URLSearchParams(search || '').get('demo');
  return v && /^\d{10}$/.test(v) ? v : null;
}

export const INFO_LABELS = [
  ['images', 'Images'], ['certificates', 'Certificates'], ['video', 'Video'], ['details', 'Program details'],
];

/** A mark that does not rely on colour: the status word is always written next to it. */
export const STATUS_MARK = {
  available: '✓', partial: '◐', not_returned: '–', held_back: '⏸', failed: '✕', no_rules: 'i', not_applicable: '·',
};

export function statusMark(status) {
  return STATUS_MARK[status] || '?';
}

/** The case with this number in a catalog { programs: [{ groups: [{ cases: [...] }] }] }, or null. */
export function findCase(catalog, number) {
  for (const p of catalog?.programs || []) {
    for (const g of p.groups || []) {
      const hit = (g.cases || []).find((c) => c.number === number);
      if (hit) return hit;
    }
  }
  return null;
}

/** All listed cases in order. */
export function allCases(catalog) {
  return (catalog?.programs || []).flatMap((p) => (p.groups || []).flatMap((g) => g.cases || []));
}

/** `1000000001` -> `100000 0001`, easier to read: six-digit program prefix, four-digit sequence. */
export function spacedNumber(n) {
  return /^\d{10}$/.test(n || '') ? `${n.slice(0, 6)} ${n.slice(6)}` : String(n || '');
}

/** True when the backend says demo content could not be loaded (a configured bundle failed its checks): the hub then lists nothing. */
export function demoContentUnavailable(catalog) {
  return !!catalog && catalog.available === false;
}
