import { useMemo } from 'react';
import { CASES, CERTS, NOTICES, PROGRAMS, SITES, STAFF, notice as findNotice, site as findSite } from '../../data.js';
import { evaluate } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';
import { slaOf } from '../queue/sla.js';

// Everything the dashboard needs: where cases are, who has them, and how healthy each camera is.
export function useWorkload(userId) {
  const { state, statusOf } = useStore();
  return useMemo(() => {
    const rows = CASES.map((c) => {
      const n = findNotice(c.notice);
      return { c, n, ev: evaluate(n, statusOf), sla: slaOf(c), program: PROGRAMS[findSite(n.site).program].label, assignee: c.id in state.assign ? state.assign[c.id] : c.assignee, decided: !!state.decisions[c.id] };
    });
    const open = rows.filter((r) => !r.decided);
    const queue = (type) => {
      const r = open.filter((x) => x.c.type === type);
      return {
        type, open: r.length,
        mine: r.filter((x) => x.assignee === userId).length,
        others: r.filter((x) => x.assignee && x.assignee !== userId).length,
        unassigned: r.filter((x) => !x.assignee).length,
        past: r.filter((x) => x.sla.left < 0).length,
        risk: r.filter((x) => !x.ev.current).length,
      };
    };
    const people = STAFF.filter((p) => p.perms.includes('case:decide')).map((p) => ({ p, n: open.filter((x) => x.assignee === p.id).length, past: open.filter((x) => x.assignee === p.id && x.sla.left < 0).length }));
    const cameras = SITES.map((s) => {
      const certs = CERTS.filter((c) => c.site === s.code);
      const cases = open.filter((x) => x.n.site === s.code);
      const lastInspect = certs.filter((c) => c.section === 's138' && statusOf(c) !== 'withdrawn').map((c) => c.date).sort().pop();
      return { s, certs: certs.length, withdrawn: certs.filter((c) => statusOf(c) === 'withdrawn').length, cases: cases.length, risk: cases.filter((x) => !x.ev.current).length, lastInspect };
    });
    const attention = open.filter((x) => x.sla.left < 0 || !x.ev.current).sort((a, b) => (b.sla.left < 0) - (a.sla.left < 0) || a.sla.left - b.sla.left).slice(0, 5);
    return { rows, open, statusOf, review: queue('review'), court: queue('court'), people, cameras, attention, noticeCount: NOTICES.length };
  }, [state.assign, state.decisions, state.certStatus, state.targets, userId, statusOf]);
}
