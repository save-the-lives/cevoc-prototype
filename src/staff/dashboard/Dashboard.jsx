import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import { go } from '../../lib/router.js';
import { TODAY } from '../../lib/format.js';
import { daysBetween } from '../../lib/rules.js';
import { REQUIRED } from '../../lib/rules.js';
import { useStore } from '../../lib/store.jsx';
import { CERTS, SITES, STAFF, staff as findStaff } from '../../data.js';
import { Columns, Heat, Pie, Scatter } from './charts.jsx';
import { useWorkload } from './useWorkload.js';

// A visual overview. Every chart is also a filter: click a bar, a cell or a dot and the rest of the dashboard
// follows, then open exactly that set in the queue.

const BUCKETS = [{ key: 0, label: '0–7', lo: 0, hi: 7 }, { key: 1, label: '8–14', lo: 8, hi: 14 }, { key: 2, label: '15–21', lo: 15, hi: 21 }, { key: 3, label: '22–28', lo: 22, hi: 28 }, { key: 4, label: '29+', lo: 29, hi: 999 }];
const bucketOf = (r) => BUCKETS.find((b) => r.sla.waited >= b.lo && r.sla.waited <= b.hi).key;
const initials = (n) => n.split(' ').map((p) => p[0]).join('').slice(0, 2);
const LIMIT = { s137: 365, s138: 90 };

function passes(r, f, skip) {
  const on = (k) => f[k] != null && f[k] !== false && !skip.includes(k);
  if (on('kpi')) {
    if (f.kpi === 'late' && !(r.sla.left < 0)) return false;
    if (f.kpi === 'risk' && r.ev.current) return false;
    if (f.kpi === 'none' && r.assignee) return false;
  }
  if (on('assignee') && (f.assignee === 'none' ? !!r.assignee : r.assignee !== f.assignee)) return false;
  if (on('program') && r.program !== f.program) return false;
  if (on('camera') && r.n.site !== f.camera) return false;
  if (on('bucket') && bucketOf(r) !== f.bucket) return false;
  if (on('type') && r.c.type !== f.type) return false;
  return true;
}

function Card({ title, span, children, hint }) {
  return (
    <section className={`vz-card ${span ? `span-${span}` : ''}`}>
      <header><h2>{title}</h2>{hint && <span>{hint}</span>}</header>
      {children}
    </section>
  );
}

function Kpi({ label, value, tone, onClick, children, sub }) {
  return (
    <button type="button" className={`kpi is-${tone || 'ac'}`} onClick={onClick}>
      <span className="kpi-l">{label}</span>
      <b className="kpi-v">{value}</b>
      {sub && <small>{sub}</small>}
      {children}
    </button>
  );
}

export default function Dashboard({ user, canApprove }) {
  const { state } = useStore();
  const w = useWorkload(user.id);
  const [f, setF] = useState({});
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const rows = (...skip) => w.open.filter((r) => passes(r, f, skip));
  const all = rows();
  const noKpi = rows('kpi');
  const filtered = Object.values(f).some((v) => v != null && v !== false);
  const myRequests = state.pending.filter((p) => p.by === user.id).length;

  // KPIs
  const late = noKpi.filter((r) => r.sla.left < 0).length;
  const risk = noKpi.filter((r) => !r.ev.current).length;
  const none = noKpi.filter((r) => !r.assignee).length;
  const mine = noKpi.filter((r) => r.assignee === user.id).length;
  const others = noKpi.length - mine - none;

  // weekly arrivals and backlog, from the real lodged dates
  const weeks = useMemo(() => {
    const out = [];
    for (let i = 7; i >= 0; i -= 1) {
      const end = new Date(`${TODAY}T00:00:00`); end.setDate(end.getDate() - i * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6);
      const iso = (d) => d.toISOString().slice(0, 10);
      out.push({ key: i, label: i === 0 ? 'now' : `-${i}w`, from: iso(start), to: iso(end), arrived: w.rows.filter((r) => r.c.lodged >= iso(start) && r.c.lodged <= iso(end)).length, backlog: noKpi.filter((r) => r.c.lodged <= iso(end)).length });
    }
    return out;
  }, [w.rows, noKpi]);

  // visuals (each ignores its own filter so you can change your pick)
  const hist = BUCKETS.map((b) => {
    const rs = rows('bucket').filter((r) => bucketOf(r) === b.key);
    const l = rs.filter((r) => r.sla.left < 0).length;
    return { key: b.key, label: b.label, value: rs.length, tone: l > rs.length / 2 && rs.length ? 'bad' : l ? 'warn' : 'ac', tip: `${rs.length} waiting ${b.label} days${l ? `, ${l} past target` : ''}` };
  });
  const people = [...STAFF.filter((p) => p.perms.includes('case:decide')).map((p) => ({ id: p.id, label: p.id === user.id ? `${p.name} (you)` : p.name, icon: <Avatar><AvatarFallback>{initials(p.name)}</AvatarFallback></Avatar> })), { id: 'none', label: 'Unassigned', icon: <span className="hbar-none" /> }].map((p) => {
    const rs = rows('assignee').filter((r) => (p.id === 'none' ? !r.assignee : r.assignee === p.id));
    const l = rs.filter((r) => r.sla.left < 0).length;
    return { key: p.id, label: p.label, icon: p.icon, total: rs.length, parts: [{ v: rs.length - l, tone: p.id === 'none' ? 'grey' : 'ac' }, { v: l, tone: 'bad' }], tip: `${rs.length} open${l ? `, ${l} late` : ''}` };
  });
  const programs = [...new Set(w.open.map((r) => r.program))].map((pg) => {
    const rs = rows('program').filter((r) => r.program === pg);
    const rk = rs.filter((r) => !r.ev.current).length;
    return { key: pg, label: pg.replace(' camera', ''), total: rs.length, parts: [{ v: rs.length - rk, tone: 'ac' }, { v: rk, tone: 'warn' }], tip: `${rs.length} open${rk ? `, ${rk} with a certification risk` : ''}` };
  }).sort((a, b) => b.total - a.total);
  const arrivals = weeks.map((x) => ({ key: x.key, label: x.label, value: x.arrived, tone: 'ac', tip: `${x.arrived} new, ${x.from} to ${x.to}` }));

  const maxRisk = Math.max(2, ...all.map((r) => r.ev.notCurrent));
  const points = all.map((r, i) => {
    const target = r.sla.target;
    return {
      key: r.c.id, x: r.sla.waited / target, y: (r.ev.notCurrent + 0.5 + ((i % 3) - 1) * 0.12) / (maxRisk + 1) * maxRisk, c: r,
      tone: r.sla.left < 0 ? 'bad' : r.ev.current ? 'ac' : 'warn', size: { high: 20, normal: 15, low: 11 }[r.c.priority],
      label: `${r.c.id}, ${r.n.holder}, waiting ${r.sla.waited} days${r.ev.current ? '' : `, ${r.ev.notCurrent} certification risk`}`,
      tip: <><b>{r.c.id}</b> {r.n.holder}<br />{r.sla.waited} days · {r.ev.current ? 'certs ok' : `${r.ev.notCurrent} not current`}</>,
    };
  });

  // camera heat map
  const cameraRows = SITES.map((s) => ({ key: s.code, label: s.code }));
  const cells = {};
  SITES.forEach((s) => {
    const req = REQUIRED[s.program];
    const forSection = (sec) => CERTS.filter((c) => c.site === s.code && c.section === sec && !c.session);
    const cell = (sec) => {
      if (!req.some((x) => x.section === sec)) return null;
      if (req.some((x) => x.section === sec && x.session)) return { text: 'session', tone: 'ok', tip: 'Checked before every session' };
      const list = forSection(sec);
      const valid = list.filter((c) => w.statusOf(c) !== 'withdrawn');
      const withdrawn = list.filter((c) => w.statusOf(c) === 'withdrawn');
      const pts = [...new Set(valid.map((c) => c.point || ''))];
      const latest = pts.map((p) => valid.filter((c) => (c.point || '') === p).sort((a, b) => b.date.localeCompare(a.date))[0]);
      if (!latest.length) return { text: 'none', tone: 'bad', tip: 'No certificate on record' };
      const oldest = latest.sort((a, b) => a.date.localeCompare(b.date))[0];
      const age = daysBetween(oldest.date, TODAY);
      const lim = LIMIT[sec];
      const wd = withdrawn.length ? ' · one withdrawn' : '';
      if (!lim) return { text: 'on file', tone: 'ok', tip: `${oldest.id}${wd}` };
      const ratio = age / lim;
      return { text: `${age}d`, tone: ratio > 1 ? 'bad' : ratio > 0.75 ? 'warn' : 'ok', tip: `${oldest.id} · ${age} of ${lim} days${wd}` };
    };
    cells[s.code] = [cell('s137'), cell('s138'), cell('s132')];
  });

  // Every widget is a doorway: clicking it opens the queue already filtered to what was clicked.
  const queryOf = (g) => {
    const q = [];
    if (g.kpi === 'late') q.push('left < 0');
    if (g.kpi === 'risk') q.push('certification = "not current"');
    if (g.kpi === 'none') q.push('assignee IS EMPTY');
    if (g.assignee) q.push(g.assignee === 'none' ? 'assignee IS EMPTY' : `assignee = "${findStaff(g.assignee).name}"`);
    if (g.program) q.push(`program = "${g.program}"`);
    if (g.camera) q.push(`camera = ${g.camera}`);
    if (g.bucket != null) { const b = BUCKETS[g.bucket]; q.push(b.hi > 900 ? `waiting >= ${b.lo}` : `waiting >= ${b.lo} AND waiting <= ${b.hi}`); }
    return q.join(' AND ');
  };
  const type = f.type || (all.filter((r) => r.c.type === 'court').length > all.length / 2 ? 'court' : 'reviews');
  const drill = (g) => go(`/staff/queue/${type}?q=${encodeURIComponent(queryOf(g))}`);

  if (user.agency === 'tfnsw') {
    return (
      <div className="vz">
        <div className="vz-top"><h1>Insights</h1></div>
        <p className="vz-hint">Camera certification at a glance. Select a camera to open its record.</p>
        <div className="vz-grid">
          <Card title="Camera certification" span="12" hint="age against the limit">
            <Heat rows={cameraRows} cols={['Test & seal', 'Inspection', 'Survey']} cells={cells} onPick={(k) => go(`/staff/camera/${k}`)} />
            <ul className="vz-key" aria-hidden="true"><li><i className="is-ok" />in date</li><li><i className="is-warn" />nearing limit</li><li><i className="is-bad" />past limit</li></ul>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="vz">
      <div className="vz-top">
        <h1>Insights</h1>
        <div className="seg2" role="group" aria-label="Case type">
          {[['', 'All'], ['review', 'Reviews'], ['court', 'Court']].map(([v, l]) => <button key={l} type="button" aria-pressed={(f.type || '') === v} onClick={() => set('type', v || null)}>{l}</button>)}
        </div>
      </div>
      <p className="vz-hint">Select anything to open those cases in the queue.</p>

      <div className="vz-grid">
        <section className="vz-card span-12 vz-primary" aria-labelledby="vz-pri-h">
          <div className="kstrip" role="group" aria-label="Open cases">
            <Kpi label="Open" value={noKpi.length} tone="ac" onClick={() => drill({})}>
              <span className="kpi-split" role="img" aria-label={`${mine} yours, ${others} with others, ${none} unassigned`}><i className="is-ac" style={{ flex: mine }} /><i className="is-grey2" style={{ flex: others }} /><i className="is-grey" style={{ flex: none }} /></span>
            </Kpi>
            <Kpi label="Late" value={late} tone="bad" onClick={() => drill({ kpi: 'late' })} />
            <Kpi label="Cert risk" value={risk} tone="warn" onClick={() => drill({ kpi: 'risk' })} />
            <Kpi label="Unassigned" value={none} tone="grey" onClick={() => drill({ kpi: 'none' })} />
            {canApprove
              ? <Link to="/staff/queue/approvals" className={`kpi is-warn ${state.pending.length ? '' : 'is-quiet'}`}><span className="kpi-l">Approvals</span><b className="kpi-v">{state.pending.length}</b></Link>
              : user.perms.includes('withdraw:request') && <Link to="/staff/certificates" className="kpi is-grey"><span className="kpi-l">My requests</span><b className="kpi-v">{myRequests}</b></Link>}
          </div>
          <header><h2 id="vz-pri-h">Needs attention</h2><span>Target reply: {state.targets.review} days for reviews, {state.targets.court} for court. Late and at risk: top right.</span></header>
          <Scatter points={points} xMax={1.6} yMax={maxRisk} selected={null} targetNote={`Target reply: ${state.targets.review} days for reviews, ${state.targets.court} for court elections.`} onPick={(p) => go(`/staff/queue/${p.c.c.type === 'court' ? 'court' : 'reviews'}?q=${encodeURIComponent(`case = ${p.c.c.id}`)}`)} />
        </section>
        <Card title="Who has it" span="4"><Pie items={people} onPick={(k) => drill({ assignee: k })} /></Card>
        <Card title="By camera type" span="4"><Pie items={programs} onPick={(k) => drill({ program: k })} /></Card>
        <Card title="Waiting" span="4" hint="days"><Columns items={hist} unit="days" onPick={(k) => drill({ bucket: k })} height={150} /></Card>
      </div>
    </div>
  );
}
