import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { go } from '../../lib/router.js';
import { useStore } from '../../lib/store.jsx';
import { staff as findStaff } from '../../data.js';

export default function ApprovalsQueue({ canApprove = true, user }) {
  const { state } = useStore();
  return (
    <>
      <div className="st-qhead"><h1>{canApprove ? 'Certificate approvals' : 'Certificate requests'}</h1><p className="st-muted">{state.pending.length ? `${state.pending.length} waiting for a program manager${canApprove ? '' : '. You can follow progress here; a program manager approves.'}` : canApprove ? 'Nothing waiting.' : 'Nothing waiting. Requests you make from a certificate page appear here.'}</p></div>
      <div className="st-grid-wrap">
        <Table aria-label="Approvals">
          <TableHeader><TableRow><TableHead>Certificate</TableHead><TableHead>Change</TableHead><TableHead>Requested by</TableHead><TableHead>Notices affected</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {state.pending.map((p) => (
              <TableRow key={p.id} className="st-qrow" onClick={() => go(`/staff/cert/${p.cert}`)}>
                <TableCell><Link to={`/staff/cert/${p.cert}`}><strong>{p.cert}</strong></Link></TableCell>
                <TableCell><Tag size="sm" color="warning">{p.kind}</Tag></TableCell>
                <TableCell>{findStaff(p.by)?.name}</TableCell>
                <TableCell>{p.affected}</TableCell>
                <TableCell><Link to={`/staff/cert/${p.cert}`}>{canApprove && p.by !== user?.id ? 'Review' : 'View'}</Link></TableCell>
              </TableRow>
            ))}
            {!state.pending.length && <TableRow><TableCell colSpan={5} className="st-muted">Nothing waiting. Withdrawal requests from camera operations show up here.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
