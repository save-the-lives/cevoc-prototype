// Pure helpers for the "Camera certificates" list. Contract per row:
// { description, type, periodText, certifiedDate: 'yyyy-MM-dd', expiryDate: 'yyyy-MM-dd', coversOffence: boolean }
export const LABEL_VALID = 'Valid on the offence date';
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

/** Covering rows first, then the rest; within each group the latest certified date first. Does not mutate the input. */
export function orderCertificates(list) {
  return [...list].sort((a, b) => {
    if ((b.coversOffence === true) !== (a.coversOffence === true)) return b.coversOffence === true ? 1 : -1;
    return String(b.certifiedDate || '').localeCompare(String(a.certifiedDate || ''));
  });
}

/** View model for rendering. */
export function certificateRows(list) {
  return orderCertificates(list).map((c) => ({
    ...c,
    covers: c.coversOffence === true,
    label: certificateLabel(c),
    certifiedText: formatDate(c.certifiedDate),
    expiryText: formatDate(c.expiryDate),
  }));
}

/** Short sentence for the section intro. */
export function certificateSummary(list) {
  const n = list.filter((c) => c.coversOffence === true).length;
  if (n === 0) return 'None of these certificates is marked as valid on the offence date.';
  return n === 1 ? '1 certificate was valid on the offence date.' : `${n} certificates were valid on the offence date.`;
}
