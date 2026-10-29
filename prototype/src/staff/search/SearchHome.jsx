import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Tag } from '@nswds/ui';
import { Link } from '../../shared/ui.jsx';
import Proposed from '../../shared/Proposed.jsx';
import DateField from '../../public/DateField.jsx';
import { checkDate, isoToParts, partsToIso, todayIso } from '../../public/lookupValidation.js';
import { fmtDate } from '../../lib/format.js';
import { evaluate } from '../../lib/rules.js';
import { certRange, MAX_DAYS } from '../../lib/certRange.js';
import { useStore } from '../../lib/store.jsx';
import { useNow } from '../../lib/useNow.js';
import { CASES, CERTS, NOTICES, PROGRAMS, SITES, notice as findNotice, site as findSite, staff as findStaff } from '../../data.js';
import { CASE_STATE, REQUEST_STATUS, categoryLabel, escalation, isWithTransport, requestedAt, dueMs, human, validationOf } from '../../lib/workflow.js';
import { useRevenueRows } from '../ops/useRevenueRows.js';
import { Tile } from '../ops/Parts.jsx';

const RECENT = 'cevoc-recent-searches';
const LAST = 'cevoc-last-search';
const norm = (s) => String(s).toLowerCase().replace(/[\s-]/g, '');
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch (e) { return []; } };
const caseLink = (id) => `/staff/queue/reviews?q=${encodeURIComponent(`case = "${id}"`)}&open=1`;

// The first thing a doer sees: one search box, the work that is theirs, and a way to check a camera's certification
// over a date range. Revenue NSW searches by penalty notice first; Transport starts from the camera and its certificates.
export default function SearchHome({ user, query }) {
  const { state, statusOf } = useStore();
  const now = useNow();
  const rnsw = user.agency === 'rnsw';
  const last = (() => { try { return JSON.parse(sessionStorage.getItem(LAST) || '{}'); } catch (e) { return {}; } })();
  const start = query.q !== undefined || query.site !== undefined ? query : last;
  const [q, setQ] = useState(start.q || '');
  const [recent, setRecent] = useState(readRecent);
  const inputRef = useRef(null);
  useEffect(() => { if (!q) inputRef.current?.focus(); }, []); // eslint-disable-line

  // Certificate check by location and date range
  const [site, setSite] = useState(start.site || '');
  const [from, setFrom] = useState(isoToParts(start.from || ''));
  const [to, setTo] = useState(isoToParts(start.to || ''));
  const [rangeErr, setRangeErr] = useState({});
  const [ran, setRan] = useState(start.site && start.from && start.to ? { site: start.site, from: start.from, to: start.to } : null);
  const result = useMemo(() => (ran ? certRange(ran.site, ran.from, ran.to, statusOf) : null), [ran, statusOf]);

  // Keep the search in the address and in this tab, so coming back from a record restores it (no page reload, no jump).
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (ran) { p.set('site', ran.site); p.set('from', ran.from); p.set('to', ran.to); }
    const text = p.toString();
    try { window.history.replaceState(null, '', `#/staff/search${text ? `?${text}` : ''}`); sessionStorage.setItem(LAST, JSON.stringify(Object.fromEntries(p))); } catch (e) { /* ignore */ }
  }, [q, ran]);

  const remember = (text) => {
    const t = text.trim(); if (!t) return;
    const next = [t, ...readRecent().filter((x) => x !== t)].slice(0, 6);
    try { localStorage.setItem(RECENT, JSON.stringify(next)); } catch (e) { /* ignore */ }
    setRecent(next);
  };

  const runRange = (e) => {
    e.preventDefault();
    const errs = {};
    if (!site) errs.site = 'Choose a camera location code';
    const a = checkDate(from, '2019-01-01', todayIso(), 'start date'); const b = checkDate(to, '2019-01-01', todayIso(), 'end date');
    if (a) errs.from = a.msg; if (b) errs.to = b.msg;
    if (!a && !b && partsToIso(from) > partsToIso(to)) errs.to = 'The end date must be on or after the start date';
    setRangeErr(errs);
    if (Object.keys(errs).length) return;
    setRan({ site, from: partsToIso(from), to: partsToIso(to) });
  };

  // Search every record type; the order of the groups depends on who is asking.
  const groups = useMemo(() => {
    const t = norm(q); if (!t) return [];
    const has = (text) => norm(text).includes(t);
    const notices = NOTICES.filter((n) => has(`${n.number} ${n.rego} ${rnsw ? n.holder : ''} ${n.offence} ${n.site}`)).map((n) => {
      const ev = evaluate(n, statusOf); const c = CASES.find((x) => x.notice === n.number);
      return { key: n.number, title: `Penalty notice (${n.number})`, sub: `${n.rego} · ${rnsw ? `${n.holder} · ` : ''}${n.offence}`, to: `/staff/notice/${n.number}`, v: validationOf(ev), act: c ? ['Open review', caseLink(c.id)] : null };
    });
    const reviews = CASES.filter((c) => has(`${c.id} ${c.notice} ${c.category} ${rnsw ? findNotice(c.notice).holder : ''}`)).map((c) => ({ key: c.id, title: c.id, sub: `${c.type === 'court' ? 'Court election' : 'Review'} · ${c.category} · penalty notice (${c.notice})`, to: caseLink(c.id) }));
    const cameras = SITES.filter((s) => has(`${s.code} ${s.name} ${s.suburb} ${s.serial} ${PROGRAMS[s.program].label}`)).map((s) => ({ key: s.code, title: `${s.code} · ${s.name}`, sub: `${PROGRAMS[s.program].label} · limit ${s.limit}`, to: `/staff/camera/${s.code}`, act: ['Check certificates', null, s.code] }));
    const certs = CERTS.filter((c) => has(`${c.id} ${c.section} ${c.site}`)).map((c) => ({ key: c.id, title: c.id, sub: `${c.site} · section ${c.section.replace('s', '')} · ${fmtDate(c.date)} · ${statusOf(c) === 'withdrawn' ? 'withdrawn' : 'on record'}`, to: `/staff/cert/${c.id}` }));
    const reqs = state.tech.filter((r) => has(`${r.id} ${r.caseId} ${r.site} ${r.summary} ${categoryLabel(r.category)}`)).map((r) => ({ key: r.id, title: `${r.id} · ${categoryLabel(r.category)}`, sub: `${r.site} · ${r.summary}`, to: `/staff/request/${r.id}`, tag: REQUEST_STATUS[r.status] }));
    const all = rnsw
      ? [['Penalty notices', notices], ['Reviews and court elections', reviews], ['Cameras', cameras], ['Certificates', certs], ['Referrals', reqs]]
      : [['Cameras and sites', cameras], ['Certificates', certs], ['Referrals', reqs], ['Penalty notices', notices]];
    return all.filter(([, l]) => l.length);
  }, [q, rnsw, statusOf, state.tech]);
  const total = groups.reduce((n, [, l]) => n + l.length, 0);

  const rows = useRevenueRows();
  const mine = rows.filter((r) => !r.decided && r.assignee === user.id);
  const needs = rows.filter((r) => !r.decided && r.st !== 'AWAITING_TRANSPORT').sort((a, b) => a.sla.left - b.sla.left);
  const work = (mine.length ? mine : needs).slice(0, 6);
  const live = state.tech.filter((r) => isWithTransport(r.status));
  const tmine = live.filter((r) => r.assignee === user.id || !r.assignee).slice(0, 6);

  const chips = rnsw
    ? [['My unresolved work', '/staff/queue/reviews'], ['Referred to Transport', '/staff/queue/reviews?view=awaiting'], ['Determination received', '/staff/queue/reviews?view=advice'], ['Nearing target', '/staff/queue/reviews?view=risk']]
    : [['New referrals', '/staff/requests?view=new'], ['Unassigned', '/staff/requests?view=unassigned'], ['Under assessment', '/staff/requests?view=progress'], ['Awaiting determination', '/staff/requests?view=determine']];

  const rangeCard = (
    <details className="sh-card sh-range" open={!rnsw || !!ran}>
      <summary><strong>Check a camera’s certification by location and dates</strong> <Proposed note="Searching certificates by location code and date range is a proposal. It needs certificate effective dates from the certificate register." /></summary>
      <form onSubmit={runRange} noValidate className="sh-form">
        <label className="adv-f"><span>Camera location code</span>
          <select value={site} onChange={(e) => setSite(e.target.value)} aria-invalid={!!rangeErr.site || undefined}>
            <option value="">Choose…</option>
            {SITES.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
          </select>
          {rangeErr.site && <small className="sh-err" role="alert">{rangeErr.site}</small>}
        </label>
        <DateField id="rf" legend="From" hint="For example, 1 7 2026" parts={from} onChange={(p) => { setFrom(p); setRangeErr((e) => ({ ...e, from: undefined })); }} error={rangeErr.from} min="2019-01-01" max={todayIso()} />
        <DateField id="rt" legend="To" hint={`Up to ${MAX_DAYS} days after the start`} parts={to} onChange={(p) => { setTo(p); setRangeErr((e) => ({ ...e, to: undefined })); }} error={rangeErr.to} min="2019-01-01" max={todayIso()} />
        <Button type="submit">Check certificates</Button>
      </form>
      {result && (
        <div className="sh-res" aria-live="polite">
          <h3>{result.site.code} · {result.site.name}</h3>
          <p className="st-muted">{fmtDate(ran.from)} to {fmtDate(ran.to)} · {PROGRAMS[result.site.program].label}</p>
          <ul className="sh-spans">
            {result.spans.map((s) => (
              <li key={s.key + s.from} className={s.current ? 'is-ok' : 'is-bad'}>
                <Tag size="sm" color={s.current ? 'success' : 'danger'}>{s.current ? 'Current' : 'Not current'}</Tag>
                <span>{fmtDate(s.from)}{s.to !== s.from ? ` to ${fmtDate(s.to)}` : ''}{!s.current && s.lapsed.length ? `: ${s.lapsed.join(', ')}` : ''}</span>
              </li>))}
          </ul>
          {result.truncated && <p className="st-muted">Showing the first {MAX_DAYS} days only.</p>}
          <table className="otable">
            <thead><tr><th>Certificate</th><th>Section</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>{result.certs.map((c) => <tr key={c.id}><td><Link to={`/staff/cert/${c.id}`}>{c.id}</Link></td><td>{c.section.replace('s', '')}{c.point ? ` (${c.point})` : ''}{c.session ? ' session' : ''}</td><td>{fmtDate(c.date)}</td><td>{c.status === 'withdrawn' ? <Tag size="sm" color="danger">Withdrawn</Tag> : 'On record'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </details>
  );

  const hour = new Date().getHours();
  const greeting = `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, ${user.name.split(' ')[0]}`;
  const casesOpen = rows.filter((r) => !r.decided);
  const tiles = rnsw
    ? [
      { label: 'Needs triage', n: casesOpen.filter((r) => r.st === 'OPEN').length, sub: 'New, no owner yet', to: `/staff/queue/reviews?q=${encodeURIComponent('state = open')}`, tone: 'primary' },
      { label: 'Referred to Transport', n: casesOpen.filter((r) => r.st === 'AWAITING_TRANSPORT').length, sub: 'Not yet determined', to: '/staff/queue/reviews?view=awaiting', tone: 'grey' },
      { label: 'Determinations back', n: casesOpen.filter((r) => r.st === 'ADVICE_RECEIVED' || r.st === 'MORE_INFORMATION_REQUIRED').length, sub: 'Needs your action', to: `/staff/queue/reviews?q=${encodeURIComponent('state IN (advice, more-info)')}`, tone: 'ok', urgent: true },
      { label: 'Court elections', n: casesOpen.filter((r) => r.c.type === 'court').length, sub: 'Notify Transport', to: `/staff/queue/reviews?q=${encodeURIComponent('type = court AND status = open')}`, tone: 'primary' },
    ]
    : [
      { label: 'New referrals', n: live.filter((r) => r.status === 'AWAITING_TRANSPORT').length, sub: 'From Revenue NSW', to: '/staff/requests?view=new', tone: 'primary', urgent: true },
      { label: 'Under assessment', n: live.filter((r) => r.status === 'ACKNOWLEDGED' || r.status === 'INVESTIGATING').length, sub: 'Acknowledged or in progress', to: '/staff/requests?view=progress', tone: 'grey' },
      { label: 'Awaiting determination', n: live.filter((r) => r.status === 'AWAITING_DETERMINATION').length, sub: 'Needs an authorised role', to: '/staff/requests?view=determine', tone: 'warn', urgent: true },
      { label: 'Awaiting Revenue NSW', n: state.tech.filter((r) => r.status === 'MORE_INFORMATION_REQUIRED').length, sub: 'Information requested', to: '/staff/requests?view=revenue', tone: 'grey' },
    ];
  const quick = rnsw
    ? [['Check certification by location and dates', null], ['Camera sites', '/staff/cameras'], ['Certificate register', '/staff/certificates'], ['Referred to Transport', '/staff/queue/reviews?view=awaiting']]
    : [['Check certification by location and dates', null], ['Certificate register', '/staff/certificates'], ['Camera assets', '/staff/cameras'], ['Certificate requests and approvals', '/staff/queue/approvals']];
  const openRange = () => { const d = document.querySelector('.sh-range'); d?.setAttribute('open', ''); d?.scrollIntoView({ block: 'center' }); document.querySelector('.sh-range select')?.focus(); };

  return (
    <div className="sh">
      <div className="sh-top">
        <form className="sh-search" role="search" onSubmit={(e) => { e.preventDefault(); remember(q); }}>
          <h1>{greeting}</h1>
          <p className="sh-sub">{rnsw ? 'Search a penalty notice to respond to an enquiry, or refer it to Transport.' : 'Review referred matters, assess the evidence and certification, and record your outcome.'}</p>
          <label htmlFor="sh-q" className="sr-only">{rnsw ? 'Search penalty notices, reviews, cameras and certificates' : 'Search cameras, certificates, referrals and penalty notices'}</label>
          <div className="sh-box">
            <input id="sh-q" ref={inputRef} type="search" autoComplete="off" spellCheck="false" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={rnsw ? 'Penalty notice number, plate, customer name, review ID or camera code' : 'Camera location code, certificate ID, referral ID or penalty notice number'} aria-describedby="sh-hint" />
            <Button type="submit">Search</Button>
          </div>
          <p id="sh-hint" className="st-muted">Press <kbd>Ctrl</kbd>+<kbd>K</kbd> for the quick finder anywhere. Original evidence is never changed by searching.</p>
          {recent.length > 0 && <p className="sh-chips" aria-label="Recent searches">Recent: {recent.map((r) => <button key={r} type="button" className="sh-chip" onClick={() => setQ(r)}>{r}</button>)}</p>}
        </form>
        <aside className="sh-quick" aria-label="Quick links">
          <h2>Quick links</h2>
          <ul>{quick.map(([l, to]) => <li key={l}>{to ? <Link to={to}>{l}</Link> : <button type="button" className="st-link" onClick={openRange}>{l}</button>}</li>)}</ul>
        </aside>
      </div>
      {!q && <div className="otiles sh-tiles" role="group" aria-label="Your work">{tiles.map((t) => <Tile key={t.label} {...t} />)}</div>}

      <p className="sr-only" role="status" aria-live="polite">{q ? `${total} result${total === 1 ? '' : 's'} for ${q}` : ''}</p>
      {q ? (
        total ? groups.map(([title, list]) => (
          <section key={title} className="sh-card" aria-label={title}>
            <h2>{title} <span className="opanel-n">{list.length}</span></h2>
            <ul className="sh-list">{list.slice(0, 6).map((r) => (
              <li key={r.key}>
                <Link to={r.to} onClick={() => remember(q)}><strong>{r.title}</strong><small>{r.sub}</small></Link>
                {r.v && <Tag size="sm" color={r.v.tone}>{r.v.label}</Tag>}
                {r.tag && <Tag size="sm" color={r.tag.tone}>{r.tag.label}</Tag>}
                {r.act && (r.act[1] ? <Link className="obtn" to={r.act[1]}>{r.act[0]}</Link> : <button type="button" className="obtn" onClick={() => { setSite(r.act[2]); setRangeErr({}); document.querySelector('.sh-range')?.setAttribute('open', ''); document.querySelector('.sh-range select')?.focus(); }}>{r.act[0]}</button>)}
              </li>))}</ul>
          </section>
        )) : <p className="sh-none" role="status">No matches for “{q}”. Try a 10-digit penalty notice number, a plate or a camera code.</p>
      ) : (
        <div className="sh-work">
          <section className="sh-card" aria-label={rnsw ? 'Your enquiries' : 'Specialist work'}>
            <h2>{rnsw ? (mine.length ? 'Your outstanding enquiries' : 'Enquiries needing action') : 'Referrals for you'} <span className="opanel-n">{rnsw ? work.length : tmine.length}</span> <Link className="sh-more" to={rnsw ? '/staff/queue/reviews' : '/staff/requests'}>View all</Link></h2>
            {rnsw ? (work.length ? (
              <table className="otable">
                <thead><tr><th>Review ID</th><th>Penalty notice</th><th>Reason</th><th>Validation</th><th>Status</th><th>Due</th><th><span className="sr-only">Open</span></th></tr></thead>
                <tbody>{work.map((r) => (
                  <tr key={r.c.id}><td><Link to={caseLink(r.c.id)}><strong>{r.c.id}</strong></Link></td><td>{r.c.notice}</td><td>{r.c.category}</td>
                    <td><Tag size="sm" color={r.validation.tone}>{r.validation.label}</Tag></td><td><Tag size="sm" color={CASE_STATE[r.st].tone}>{CASE_STATE[r.st].label}</Tag></td><td>{fmtDate(r.sla.due)}</td>
                    <td><Link className="obtn" to={caseLink(r.c.id)}>{r.next.label}<span className="sr-only"> {r.c.id}</span></Link></td></tr>))}</tbody>
              </table>) : <p className="st-muted">Nothing outstanding.</p>
            ) : (tmine.length ? (
              <table className="otable">
                <thead><tr><th>Request</th><th>Camera</th><th>Category</th><th>Age</th><th>Status</th><th>Escalation</th><th><span className="sr-only">Open</span></th></tr></thead>
                <tbody>{tmine.map((r) => { const e = escalation(r, now, state.targets.tech); return (
                  <tr key={r.id}><td><Link to={`/staff/request/${r.id}`}><strong>{r.id}</strong></Link></td><td>{r.site}<small className="st-sub">{findSite(r.site).suburb}</small></td><td>{categoryLabel(r.category)}</td><td>{human(now - requestedAt(r))}</td>
                    <td><Tag size="sm" color={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Tag></td><td><Tag size="sm" color={e.tone}>{e.label}</Tag></td><td><Link className="obtn" to={`/staff/request/${r.id}`}>Open<span className="sr-only"> {r.id}</span></Link></td></tr>); })}</tbody>
              </table>) : <p className="st-muted">No referrals for you right now.</p>)}
          </section>
          {rangeCard}
          <section className={`sh-banner ${rnsw ? '' : 'is-tf'}`} aria-label={rnsw ? 'Need specialist advice' : 'Determinations'}>
            <div><strong>{rnsw ? 'Need Transport’s technical assessment?' : user.perms.includes('withdraw:determine') ? 'Issue a determination' : 'Assess a referred matter'}</strong>
              <p>{rnsw ? 'Refer to Transport when the matter turns on technical, certification or evidence issues. Transport holds the authority to determine whether enforcement stands.' : user.perms.includes('withdraw:determine') ? 'Review the assessment and evidence, then determine whether enforcement remains supportable or withdrawal is authorised.' : 'Review the evidence and certification, then record an assessment and recommendation for an authorised role.'}</p></div>
            <Link className="obtn" to={rnsw ? '/staff/queue/reviews?view=action' : user.perms.includes('withdraw:determine') ? '/staff/requests?view=determine' : '/staff/requests?view=new'}>{rnsw ? 'Open matters to review' : user.perms.includes('withdraw:determine') ? 'Open awaiting determination' : 'Open new referrals'}</Link>
          </section>
        </div>
      )}
      {q && rangeCard}
    </div>
  );
}
