import { useMemo } from 'react';
import { CASES, PROGRAMS, notice as findNotice, site as findSite } from '../../data.js';
import { evaluate } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';
import { slaOf } from '../queue/sla.js';
import { caseState, nextAction, validationOf } from '../../lib/workflow.js';

// Every Revenue NSW case with its workflow state, validation and target, for the operations dashboard.
export function useRevenueRows() {
  const { state, statusOf } = useStore();
  return useMemo(() => CASES.map((c) => {
    const n = findNotice(c.notice);
    const ev = evaluate(n, statusOf);
    const assignee = c.id in state.assign ? state.assign[c.id] : c.assignee;
    const st = caseState(c.id, state, assignee);
    const validation = validationOf(ev);
    return { c, n, ev, assignee, st, validation, sla: slaOf(c), next: nextAction(st, validation), program: PROGRAMS[findSite(n.site).program].label, decided: !!state.decisions[c.id] };
  }), [state.assign, state.decisions, state.tech, state.reopened, state.targets, statusOf]); // eslint-disable-line
}
