import { Fragment, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Kbd, Toaster, TooltipProvider } from '@nswds/ui';
import { AgencyLockup, Link } from '../../shared/ui.jsx';
import { go } from '../../lib/router.js';
import { kase } from '../../data.js';
import { useHotkeys } from '../hooks/useHotkeys.js';
import CommandPalette from './CommandPalette.jsx';
import ShortcutsDialog from './ShortcutsDialog.jsx';
import UserMenu from './UserMenu.jsx';

const QUEUE_LABEL = { reviews: 'Reviews', court: 'Court elections', approvals: 'Approvals' };

// A trail only where it helps: a case sits under its queue. Queue and record pages already name themselves
// in the side menu and the page heading, so a "Workspace" crumb there would only repeat them.
function trail(parts) {
  const [, a, b] = parts;
  if (a === 'case') { const k = kase(b); const q = k?.type === 'court' ? 'court' : 'reviews'; return [{ label: QUEUE_LABEL[q], to: `/staff/queue/${q}` }, { label: b }]; }
  return [];
}

function SideNav({ active, counts, hot, cameras }) {
  const item = (to, key, label, n, isHot) => (
    <Link to={to} className={active === key ? 'on' : ''} aria-current={active === key ? 'page' : undefined}>{label} <span className={isHot ? 'hot' : ''}>{n}</span></Link>
  );
  return (
    <nav className="st-side" aria-label="Queues">
      <p className="st-side__h">Queues</p>
      {item('/staff/queue/reviews', 'reviews', 'Reviews', counts.review)}
      {item('/staff/queue/court', 'court', 'Court elections', counts.court)}
      {item('/staff/queue/approvals', 'approvals', 'Approvals', counts.approvals, hot)}
      <p className="st-side__h">Cameras</p>
      {cameras.map((s) => <Link key={s.code} to={`/staff/camera/${s.code}`} className={active === s.code ? 'on' : ''}>{s.code}</Link>)}
    </nav>
  );
}

// The frame around every staff page: top bar, search and commands, queues, breadcrumbs, toasts.
export default function StaffShell({ user, parts, counts, hotApprovals, cameras, onSwitch, onSignOut, children }) {
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [, a, b] = parts;
  const crumbs = trail(parts);

  const commands = useMemo(() => [
    { id: 'c-home', label: 'Go to home', keys: ['g', 'h'], run: () => go('/staff') },
    { id: 'c-rev', label: 'Go to reviews', keys: ['g', 'r'], run: () => go('/staff/queue/reviews') },
    { id: 'c-court', label: 'Go to court elections', keys: ['g', 'c'], run: () => go('/staff/queue/court') },
    { id: 'c-appr', label: 'Go to approvals', keys: ['g', 'a'], run: () => go('/staff/queue/approvals') },
    { id: 'c-keys', label: 'Show keyboard shortcuts', keys: ['?'], run: () => setHelp(true) },
    { id: 'c-out', label: 'Sign out', run: onSignOut },
  ], [onSignOut]);

  useHotkeys({
    'mod+k': () => setPalette(true), '/': () => setPalette(true), '?': () => setHelp(true),
    'g h': () => go('/staff'), 'g r': () => go('/staff/queue/reviews'), 'g c': () => go('/staff/queue/court'), 'g a': () => go('/staff/queue/approvals'),
  });

  const active = a === 'queue' ? b : a === 'case' ? (kase(b)?.type === 'court' ? 'court' : 'reviews') : a === 'camera' ? b : '';

  return (
    <TooltipProvider>
      <div className={`st st--${user.agency}`}>
        <header className="st-top">
          <Link to="/staff" className="st-brand" aria-label={`${user.org}, CEVOC staff home`}>
            <AgencyLockup agency={user.agency} />
            <span className="st-app">CEVOC <small>Staff</small></span>
          </Link>
          <button type="button" className="st-searchbtn" onClick={() => setPalette(true)} aria-label="Search records and commands">
            <span>Search notices, cases, cameras…</span><span className="st-searchbtn__keys"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
          </button>
          <UserMenu user={user} onSwitch={onSwitch} onShortcuts={() => setHelp(true)} onSignOut={onSignOut} />
        </header>
        <div className="st-body">
          <SideNav active={active} counts={counts} hot={hotApprovals} cameras={cameras} />
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
