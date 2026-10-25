import { Fragment, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Kbd, Toaster, TooltipProvider } from '@nswds/ui';
import { AgencyLockup, Link } from '../../shared/ui.jsx';
import { go } from '../../lib/router.js';
import { kase } from '../../data.js';
import { useHotkeys } from '../hooks/useHotkeys.js';
import CommandPalette from './CommandPalette.jsx';
import ShortcutsDialog from './ShortcutsDialog.jsx';
import UserMenu from './UserMenu.jsx';
import Notifications from '../ops/Notifications.jsx';

const QUEUE_LABEL = { reviews: 'Review queue', court: 'Court elections', approvals: 'Approvals' };

// A trail only where it helps: a case sits under its queue. Queue and record pages already name themselves
// in the side menu and the page heading, so a "Workspace" crumb there would only repeat them.
function trail(parts) {
  const [, a, b] = parts;
  if (a === 'case') { const k = kase(b); const q = k?.type === 'court' ? 'court' : 'reviews'; return [{ label: QUEUE_LABEL[q], to: `/staff/queue/${q}` }, { label: b }]; }
  if (a === 'request') return [{ label: 'Technical requests', to: '/staff' }, { label: b }];
  if (a === 'cert') return [{ label: 'Certificate register', to: '/staff/certificates' }, { label: b }];
  if (a === 'camera') return [{ label: 'Cameras', to: '/staff/cameras' }, { label: b }];
  return [];
}

// Navigation differs by agency: Revenue NSW works customer cases; Transport works technical requests and camera assets.
export const AGENCY = {
  rnsw: { title: 'Revenue NSW | Review support' },
  tfnsw: { title: 'Transport for NSW | Technical assurance' },
};

function SideNav({ agency, active, counts, hot, canApprove, manager }) {
  const item = (to, key, label, n, isHot) => (
    <Link to={to} className={active === key ? 'on' : ''} aria-current={active === key ? 'page' : undefined}>{label} {n !== undefined && <span className={isHot ? 'hot' : ''}>{n}</span>}</Link>
  );
  return (
    <nav className="st-side" aria-label="Workspace">
      {manager ? <>{item('/staff', 'overview', 'Dashboard')}{item('/staff/search', 'search', 'Search')}</> : <>{item('/staff', 'search', 'Search')}{item('/staff/overview', 'overview', 'Dashboard')}</>}
      {agency === 'rnsw' ? (
        <>
          {item('/staff/queue/reviews', 'queue', 'Review queue', counts.mine)}
          {item('/staff/queue/reviews?view=awaiting', 'awaiting', 'Escalations awaiting advice', counts.awaiting)}
          {item('/staff/queue/reviews?view=completed', 'completed', 'Completed', counts.completed)}
        </>
      ) : (
        <>
          {item('/staff/requests', 'requests', 'Technical requests', counts.techOpen)}
          {item('/staff/certificates', 'certificates', 'Certificate register', counts.certs)}
          {item('/staff/cameras', 'cameras', 'Camera assets')}
          {item('/staff/queue/approvals', 'approvals', canApprove ? 'Certificate approvals' : 'Certificate requests', counts.approvals, hot)}
          {item('/staff/requests?view=history', 'history', 'Technical history')}
        </>
      )}
      <p className="st-side__h">More</p>
      {item('/staff/insights', 'insights', 'Trends')}
    </nav>
  );
}

// The frame around every staff page: top bar, search and commands, queues, breadcrumbs, toasts.
export default function StaffShell({ user, parts, query = {}, counts, canApprove, hotApprovals, onSwitch, onSignOut, children }) {
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [, a, b] = parts;
  const crumbs = trail(parts);
  useEffect(() => { document.title = `${AGENCY[user.agency].title} · CEVOC`; }, [user.agency]);

  const commands = useMemo(() => [
    { id: 'c-home', label: 'Go to your home page', keys: ['g', 'h'], run: () => go('/staff') },
    { id: 'c-search', label: 'Go to search', keys: ['g', 's'], run: () => go('/staff/search') },
    { id: 'c-dash', label: 'Go to the dashboard', keys: ['g', 'd'], run: () => go('/staff/overview') },
    { id: 'c-main', label: user.agency === 'rnsw' ? 'Go to the review queue' : 'Go to technical requests', keys: ['g', user.agency === 'rnsw' ? 'r' : 't'], run: () => go(user.agency === 'rnsw' ? '/staff/queue/reviews' : '/staff/requests') },
    { id: 'c-ins', label: 'Go to trends', keys: ['g', 'i'], run: () => go('/staff/insights') },
    ...(user.agency === 'rnsw' ? [
      { id: 'c-await', label: 'Go to escalations awaiting advice', keys: ['g', 'w'], run: () => go('/staff/queue/reviews?view=awaiting') },
      { id: 'c-court', label: 'Go to court elections', keys: ['g', 'c'], run: () => go('/staff/queue/court') },
    ] : [
      { id: 'c-cert', label: 'Go to certificate register', keys: ['g', 'e'], run: () => go('/staff/certificates') },
      { id: 'c-cams', label: 'Go to camera assets', run: () => go('/staff/cameras') },
    ]),
    ...(canApprove ? [{ id: 'c-appr', label: 'Go to approvals', keys: ['g', 'a'], run: () => go('/staff/queue/approvals') }] : []),
    { id: 'c-keys', label: 'Show keyboard shortcuts', keys: ['?'], run: () => setHelp(true) },
    { id: 'c-out', label: 'Sign out', run: onSignOut },
  ], [onSignOut, canApprove, user.agency]);

  useHotkeys({
    'mod+k': () => setPalette(true), '/': () => setPalette(true), '?': () => setHelp(true), 'mod+/': () => setHelp(true),
    'g h': () => go('/staff'), 'g s': () => go('/staff/search'), 'g d': () => go('/staff/overview'), 'g i': () => go('/staff/insights'),
    ...(user.agency === 'rnsw' ? { 'g r': () => go('/staff/queue/reviews'), 'g w': () => go('/staff/queue/reviews?view=awaiting'), 'g c': () => go('/staff/queue/court') } : { 'g e': () => go('/staff/certificates'), 'g t': () => go('/staff/requests') }),
    ...(canApprove ? { 'g a': () => go('/staff/queue/approvals') } : {}),
  });

  const active = a === 'queue' && b === 'approvals' ? 'approvals' : a === 'queue' ? (query.view === 'awaiting' ? 'awaiting' : query.view === 'completed' ? 'completed' : 'queue')
    : a === 'case' ? 'queue' : a === 'camera' || a === 'cameras' ? 'cameras' : a === 'cert' || a === 'certificates' ? 'certificates' : a === 'insights' ? 'insights'
    : a === 'requests' ? (query.view === 'history' ? 'history' : 'requests') : a === 'request' ? 'requests' : a === 'search' ? 'search' : a === 'overview' ? 'overview' : (user.perms.includes('team:manage') ? 'overview' : 'search');

  return (
    <TooltipProvider>
      <div className={`st st--${user.agency}`}>
        <header className="st-top">
          <Link to="/staff" className="st-brand" aria-label={`${AGENCY[user.agency].title}, home`}>
            <AgencyLockup agency={user.agency} />
            <span className="st-app">{AGENCY[user.agency].title}</span>
          </Link>
          <button type="button" className="st-searchbtn" onClick={() => setPalette(true)}>
            <span>Search notices, cases, cameras…</span><span className="st-searchbtn__keys"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
          </button>
          <Notifications agency={user.agency} />
          <UserMenu user={user} onSwitch={onSwitch} onShortcuts={() => setHelp(true)} onSignOut={onSignOut} />
        </header>
        <div className="st-body">
          <SideNav agency={user.agency} active={active} counts={counts} hot={hotApprovals} canApprove={canApprove} manager={user.perms.includes('team:manage')} />
          <main className="st-main">
            {crumbs.length > 1 && <Breadcrumb className="st-crumbs">
              <BreadcrumbList>
                {crumbs.map((c, i) => (
                  <Fragment key={c.label}>
                    {i > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {c.to && i < crumbs.length - 1 ? <BreadcrumbLink href={`#${c.to}`}>{c.label}</BreadcrumbLink> : <BreadcrumbPage>{c.label}</BreadcrumbPage>}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>}
            {children}
          </main>
        </div>
        <CommandPalette open={palette} onOpenChange={setPalette} commands={commands} />
        <ShortcutsDialog open={help} onOpenChange={setHelp} />
        <Toaster position="bottom-right" />
      </div>
    </TooltipProvider>
  );
}
