import { useMemo, useState } from 'react';
import { Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { fmtDate, TODAY } from '../../lib/format.js';
import { daysBetween, evaluate } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';
import { CERTS, NOTICES, SITES, CASES } from '../../data.js';

const SECTION = { s132: 'Distance surveyed', s137: 'Speed device tested and sealed', s138: 'Camera inspected' };
const label = (c) => (c.session ? 'Camera checked before the session' : SECTION[c.section] || c.section);

// The well of certificates: every certificate on record, across all cameras, independent of any one case.
export default function CertificateRegister() {
  const { state, statusOf } = useStore();
  const [q, setQ] = useState('');
  const [camera, setCamera] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });

  // which open cases rely on each certificate
  const reliance = useMemo(() => {
    const m = {};
    CASES.filter((c) => !state.decisions[c.id]).forEach((c) => {
      const n = NOTICES.find((x) => x.number === c.notice);
      evaluate(n, statusOf).items.forEach((i) => { if (i.cert) (m[i.cert.id] = m[i.cert.id] || []).push(c.id); });
    });
    return m;
  }, [state.decisions, statusOf]);

  const rows = useMemo(() => CERTS.map((c) => ({
    c, st: statusOf(c), label: label(c), age: daysBetween(c.date, TODAY), cases: reliance[c.id] || [],
    requested: state.pending.some((p) => p.cert === c.id),
  })).filter((r) => (!camera || r.c.site === camera) && (!status || (status === 'requested' ? r.requested : r.st === status))
    && (!q.trim() || `${r.c.id} ${r.c.site} ${r.label} ${r.c.officer}`.toLowerCase().includes(q.trim().toLowerCase()))), [q, camera, status, reliance, statusOf, state.pending]);

  const val = { date: (r) => r.c.date, id: (r) => r.c.id, camera: (r) => r.c.site, label: (r) => r.label, cases: (r) => r.cases.length, st: (r) => r.st };
  const sorted = [...rows].sort((a, b) => (val[sort.key](a) < val[sort.key](b) ? -1 : val[sort.key](a) > val[sort.key](b) ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1));
  const head = (key, text) => (
    <TableHead aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="st-sort" onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}>{text}<span aria-hidden="true">{sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span></button>
    </TableHead>
  );

  return (
    <>
      <div className="st-qhead"><h1>Certificate register</h1><p className="st-muted">{rows.length} of {CERTS.length} certificates · every certificate on record, whichever case relies on it</p></div>
      <div className="st-toolbar" role="search">
        <div className="st-toolbar__chips">
          <Input className="st-toolbar__q" type="search" aria-label="Search certificates" placeholder="Search certificate, camera, type or officer" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="st-select">Camera <select value={camera} onChange={(e) => setCamera(e.target.value)}><option value="">All</option>{SITES.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}</select></label>
          <label className="st-select">Status <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="published">On record</option><option value="withdrawn">Withdrawn</option><option value="requested">Withdrawal requested</option></select></label>
        </div>
      </div>
      <div className="st-grid-wrap">
        <Table aria-label="Certificates">
          <TableHeader>
            <TableRow>{head('id', 'Certificate')}{head('camera', 'Camera')}{head('label', 'Type')}{head('date', 'Issued')}<TableHead>Officer</TableHead>{head('st', 'Status')}{head('cases', 'Open cases relying')}</TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.c.id}>
                <TableCell><Link to={`/staff/cert/${r.c.id}`}><strong>{r.c.id}</strong></Link></TableCell>
                <TableCell><Link to={`/staff/camera/${r.c.site}`}>{r.c.site}</Link></TableCell>
                <TableCell>{r.label}{r.c.point ? ` (point ${r.c.point})` : ''}</TableCell>
                <TableCell>{fmtDate(r.c.date)}<small className="st-sub">{r.age} days ago</small></TableCell>
                <TableCell>{r.c.officer}</TableCell>
                <TableCell>{r.requested ? <Tag size="sm" color="warning">Withdrawal requested</Tag> : <Tag size="sm" color={r.st === 'withdrawn' ? 'danger' : 'success'}>{r.st === 'withdrawn' ? 'Withdrawn' : 'On record'}</Tag>}</TableCell>
                <TableCell>{r.cases.length ? r.cases.map((id, i) => <span key={id}>{i > 0 && ', '}<Link to={`/staff/case/${id}`}>{id}</Link></span>) : <span className="st-muted">None</span>}</TableCell>
              </TableRow>
            ))}
            {!sorted.length && <TableRow><TableCell colSpan={7} className="st-muted">No certificates match.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
