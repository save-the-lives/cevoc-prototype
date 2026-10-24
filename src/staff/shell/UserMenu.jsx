import { Avatar, AvatarFallback, DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@nswds/ui';
import { STAFF } from '../../data.js';

const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2);

export default function UserMenu({ user, onSwitch, onShortcuts, onSignOut }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="st-user" aria-label={`Account menu for ${user.name}`}>
        <Avatar><AvatarFallback>{initials(user.name)}</AvatarFallback></Avatar>
        <span className="st-user__who"><strong>{user.name}</strong><small>{user.role}</small></span>
        <span aria-hidden="true">▾</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{user.org}</DropdownMenuLabel>
        </DropdownMenuGroup>
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
