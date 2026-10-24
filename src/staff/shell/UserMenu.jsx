import { Avatar, AvatarFallback, DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@nswds/ui';
import { STAFF } from '../../data.js';

const CAN = { 'case:decide': 'Decide reviews and court elections', 'withdraw:request': 'Request certificate withdrawals', 'withdraw:approve': 'Approve certificate withdrawals', 'inspect:request': 'Add technical advice to cases' };

const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2);

export default function UserMenu({ user, onSwitch, onShortcuts, onSignOut }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="st-user" aria-label={`Account menu for ${user.name}`}>
        <Avatar><AvatarFallback>{initials(user.name)}</AvatarFallback></Avatar>
        <span className="st-user__who"><strong>{user.name}</strong><small>{user.role} · {user.org}</small></span>
        <span aria-hidden="true">▾</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="st-profile">
          <Avatar><AvatarFallback>{initials(user.name)}</AvatarFallback></Avatar>
          <div>
            <strong>{user.name}</strong>
            <span>{user.role}</span>
            <span>{user.org}</span>
          </div>
        </div>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your access</DropdownMenuLabel>
          <ul className="st-profile__can">
            {user.perms.map((p) => <li key={p}>{CAN[p]}</li>)}
            <li>View all evidence and certificates</li>
          </ul>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Switch user (demo)</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {STAFF.map((p) => (
              <DropdownMenuItem key={p.id} disabled={p.id === user.id} onClick={() => onSwitch(p.id)}>
                {p.name} · {p.role}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={onShortcuts}>Keyboard shortcuts<DropdownMenuShortcut>?</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
