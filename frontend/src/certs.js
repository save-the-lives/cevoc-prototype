// Pure helpers for the "Camera certificates" list. Contract per row:
// { description, type, periodText, certifiedDate: 'yyyy-MM-dd', expiryDate: 'yyyy-MM-dd', coversOffence: boolean }
// The server sends only the certificates that bear on the offence (the one in force, or the two either side of a gap), already
// in the order to show, with a coverage summary { status: 'covered'|'gap'|'none', side, gapDays, message }.
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
  return Array.isArray(result?.certificates) && result.certificates.length > 0;
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

/** Tone for a coverage summary: ok when a certificate was in force or the two either side meet, warn for a real gap, neutral when unknown. */
export function coverageTone(coverage) {
  if (!coverage) return 'neutral';
  if (coverage.status === 'covered') return 'ok';
  if (coverage.status === 'gap') return coverage.side === 'between' && coverage.gapDays === 0 ? 'ok' : 'warn';
  return 'neutral';
}

/** Short line above the cards. The server's message is the headline; this only says what the cards are. */
export function certificateSummary(list, coverage) {
  const n = list.filter((c) => c.coversOffence === true).length;
  if (n > 0) return n === 1 ? 'This is the certificate in force on the offence date.' : 'These are the certificates in force on the offence date.';
  if (coverage?.status === 'gap' && list.length === 2) return 'These are the certificates either side of the offence date.';
  if (coverage?.status === 'gap') return 'This is the nearest certificate to the offence date.';
  return 'None of these certificates was in force on the offence date.';
}
