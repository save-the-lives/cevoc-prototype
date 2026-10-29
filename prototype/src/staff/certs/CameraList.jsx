import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { fmtDate, TODAY } from '../../lib/format.js';
import { daysBetween } from '../../lib/rules.js';
import { PROGRAMS } from '../../data.js';
import { useWorkload } from '../dashboard/useWorkload.js';

export default function CameraList({ user }) {
  const w = useWorkload(user.id);
  return (
    <>
      <div className="st-qhead"><h1>Cameras</h1><p className="st-muted">{w.cameras.length} cameras · certification health against open cases</p></div>
      <div className="st-grid-wrap">
        <Table aria-label="Cameras">
          <TableHeader><TableRow><TableHead>Camera</TableHead><TableHead>Program</TableHead><TableHead>Last inspection</TableHead><TableHead>Certificates</TableHead><TableHead>Open cases</TableHead><TableHead>At risk</TableHead></TableRow></TableHeader>
          <TableBody>
            {w.cameras.map(({ s, certs, withdrawn, cases, risk, lastInspect }) => {
              const age = lastInspect ? daysBetween(lastInspect, TODAY) : null;
              return (
                <TableRow key={s.code}>
                  <TableCell><Link to={`/staff/camera/${s.code}`}><strong>{s.code}</strong></Link><small className="st-sub">{s.name}</small></TableCell>
                  <TableCell>{PROGRAMS[s.program].label}</TableCell>
                  <TableCell>{lastInspect ? <>{fmtDate(lastInspect)} <Tag size="sm" color={age > 90 ? 'warning' : 'success'}>{age} days</Tag></> : '—'}</TableCell>
                  <TableCell><Link to="/staff/certificates">{certs}</Link>{withdrawn > 0 && <> <Tag size="sm" color="danger">{withdrawn} withdrawn</Tag></>}</TableCell>
                  <TableCell>{cases}</TableCell>
                  <TableCell>{risk > 0 ? <Tag size="sm" color="warning">{risk}</Tag> : <span className="st-muted">0</span>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
