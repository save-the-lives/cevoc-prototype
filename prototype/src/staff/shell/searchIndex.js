import { NOTICES, CASES, SITES, CERTS, PROGRAMS } from '../../data.js';
import { fmtDate } from '../../lib/format.js';

// One flat list of everything a staff member can jump to.
export const INDEX = [
  ...NOTICES.map((n) => ({ type: 'Notice', id: n.number, label: `${n.number} · ${n.rego}`, sub: n.offence, to: `/staff/notice/${n.number}`, text: `${n.number} ${n.rego} ${n.holder}` })),
  ...CASES.map((c) => ({ type: 'Case', id: c.id, label: c.id, sub: `${c.type === 'court' ? 'Court election' : 'Review'} · ${c.notice}`, to: `/staff/case/${c.id}`, text: `${c.id} ${c.notice}` })),
  ...SITES.map((s) => ({ type: 'Camera', id: s.code, label: `${s.code} · ${s.name}`, sub: PROGRAMS[s.program].label, to: `/staff/camera/${s.code}`, text: `${s.code} ${s.name} ${s.serial}` })),
  ...CERTS.map((c) => ({ type: 'Certificate', id: c.id, label: c.id, sub: `${c.section} · ${fmtDate(c.date)}`, to: `/staff/cert/${c.id}`, text: c.id })),
];
