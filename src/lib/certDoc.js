import { PROGRAMS } from '../data.js';

// Sample certificate documents for the prototype. A real service would serve the signed PDF from the certificate store.
const SECTION = { s132: 'Distance between cameras surveyed', s137: 'Speed device tested and sealed', s138: 'Camera inspected' };
export const certTitle = (c) => (c.session ? 'Camera checked before the session' : SECTION[c.section] || c.section);

export function certLines(c, site) {
  return [
    ['SAMPLE ONLY. Fictitious record for a design prototype.', 'warn'],
    [certTitle(c), 'h'],
    [`Certificate number: ${c.id}`],
    [`Camera: ${site.code}, ${site.name}`],
    [`Program: ${PROGRAMS[site.program].label}`],
    [`Device: ${site.serial}`],
    [`Date: ${c.date}${c.time ? ` at ${c.time}` : ''}`],
    [`Made by: ${c.officer}`],
    [`Status: ${c.status === 'withdrawn' ? 'Withdrawn' : 'On record'}`],
    ['This is a plain-English summary created for the prototype. It is not the legal certificate and is not legal advice.', 'note'],
  ];
}

const ascii = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '');
const esc = (s) => ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

// A tiny one-page PDF (Helvetica text only), enough for a downloadable sample.
export function certPdf(c, site) {
  let y = 780;
  const ops = [];
  certLines(c, site).forEach(([text, kind]) => {
    const size = kind === 'h' ? 18 : kind === 'warn' ? 11 : 12;
    const font = kind === 'h' || kind === 'warn' ? '/F2' : '/F1';
    const words = ascii(text).split(' ');
    let line = '';
    const flush = () => { if (line) { ops.push(`BT ${font} ${size} Tf 56 ${y} Td (${esc(line)}) Tj ET`); y -= size + 8; line = ''; } };
    words.forEach((w) => { if ((line + ' ' + w).length > 78) flush(); line = line ? `${line} ${w}` : w; });
    flush();
    y -= kind === 'h' ? 10 : 2;
  });
  const stream = ops.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: 'application/pdf' });
}

export function downloadCert(c, site) {
  const url = URL.createObjectURL(certPdf(c, site));
  const a = document.createElement('a');
  a.href = url; a.download = `${c.id}-SAMPLE.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
