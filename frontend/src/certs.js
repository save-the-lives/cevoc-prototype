// Pure helpers for the "Camera certificates" list. Contract per row:
// { description, type, periodText, certifiedDate: 'yyyy-MM-dd', expiryDate: 'yyyy-MM-dd', coversOffence: boolean }
// The server sends only the certificates that bear on the offence (one per type, covering the offence date),
// plus uncoveredTypes: [{ description, gapDays, message }] for types with no covering certificate,
// and a coverage summary { status: 'covered'|'gap'|'none', side, gapDays, message }.
export const MAX_CARDS = 3;
export const LABEL_VALID = 'In force on the offence date';
export const LABEL_NOT_VALID = 'Not in force on the offence date';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'yyyy-MM-dd' -> '14 Mar 2026'. No Date object, so no time zone shifts. Unparseable input is returned as-is; empty gives 'Not given'. */
export function formatDate(iso) {
  if (!iso) return 'Not given';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return String(iso);
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : String(iso);
}

export function hasCertificateList(result) {
  return (Array.isArray(result?.certificates) && result.certificates.length > 0) ||
         (Array.isArray(result?.uncoveredTypes) && result.uncoveredTypes.length > 0);
}

export function certificateLabel(cert) {
  return cert.coversOffence === true ? LABEL_VALID : LABEL_NOT_VALID;
}

/** View model for rendering. */
export function certificateRows(list) {
  return list.slice(0, MAX_CARDS).map((c) => ({
    ...c,
    covers: c.coversOffence === true,
    label: certificateLabel(c),
    certifiedText: formatDate(c.certifiedDate),
    expiryText: formatDate(c.expiryDate),
  }));
}

/** Tone for a coverage summary: ok when all types covered, warn when any uncovered, neutral when unknown. */
export function coverageTone(coverage) {
  if (!coverage) return 'neutral';
  if (coverage.status === 'covered') return 'ok';
  if (coverage.status === 'gap') return coverage.side === 'between' && coverage.gapDays === 0 ? 'ok' : 'warn';
  return 'neutral';
}

/** Headline above the cards. Uses the server's coverage message directly. */
export function certificateSummary(list, coverage) {
  if (coverage?.message) return coverage.message;
  // Fallback for older server responses
  const n = list.filter((c) => c.coversOffence === true).length;
  if (n > 0) return 'This camera was certified at the time of the offence.';
  return 'None of these certificates was in force on the offence date.';
}
