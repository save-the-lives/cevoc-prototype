export const TODAY = new Date().toISOString().slice(0, 10);

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtDateTime(iso) {
  const d = new Date(iso);
  return `${fmtDate(iso)}, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`;
}
