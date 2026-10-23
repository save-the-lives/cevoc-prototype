// Works out which statutory certificates a notice needs and whether each one is satisfied.
import { LEGAL_CERTS } from '../data/evidence.js';
import { RULES, requiredFor } from '../config/evidenceRules.js';

const day = (iso) => new Date(iso.slice(0, 10) + 'T00:00:00');
const daysBetween = (a, b) => Math.round((day(b) - day(a)) / 86400000);

function matches(cert, req, site) {
  const ruleId = req.rule === 's138session' ? 's138' : req.rule;
  if (cert.rule !== ruleId || cert.site !== site) return false;
  if (req.rule === 's138session' && !cert.session) return false;
  if (req.rule === 's138' && cert.session) return false;
  if (req.point && cert.point !== req.point) return false;
  if (req.purpose && cert.purpose !== req.purpose) return false;
  return true;
}

// status: ok | lapsed | missing | on-request
export function evaluatePack(notice) {
  const { list, known } = requiredFor(notice.program);
  const offenceDate = notice.dateTime.slice(0, 10);
  const offenceTime = notice.dateTime.slice(11, 16);

  const items = list.map((req) => {
    const rule = RULES[req.rule];
    const candidates = LEGAL_CERTS.filter((c) => matches(c, req, notice.site) && c.date <= offenceDate).sort((a, b) =>
      (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))
    );
    const cert = candidates[0] || null;
    const title = req.label ? `${rule.title} (${req.label})` : rule.title;
    if (!cert) return { req, rule, title, cert: null, status: 'missing', age: null };
    const age = daysBetween(cert.date, offenceDate);
    let status = 'ok';
    if (rule.onRequest) status = 'on-request';
    else if (rule.sameDay) status = age === 0 && (!cert.time || cert.time <= offenceTime) ? 'ok' : 'lapsed';
    else if (rule.windowDays != null && age > rule.windowDays) status = 'lapsed';
    return { req, rule, title, cert, status, age };
  });

  const problems = items.filter((i) => i.status === 'lapsed' || i.status === 'missing');
  return { items, known, complete: problems.length === 0, problems };
}
