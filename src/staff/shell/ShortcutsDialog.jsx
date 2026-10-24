import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Kbd } from '@nswds/ui';

export const SHORTCUTS = [
  { group: 'Anywhere', rows: [[['Ctrl', 'K'], 'Search and commands'], [['/'], 'Search and commands'], [['g', 'h'], 'Go to workspace home'], [['g', 'r'], 'Go to reviews'], [['g', 'c'], 'Go to court elections'], [['g', 'a'], 'Go to approvals'], [['?'], 'Show this list']] },
  { group: 'In a queue', rows: [[['j'], 'Next row'], [['k'], 'Previous row'], [['Enter'], 'Open the case'], [['p'], 'Quick view in a flyout'], [['x'], 'Select or clear the row'], [['a'], 'Assign selected rows to me'], [['Esc'], 'Clear selection']] },
];

export default function ShortcutsDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts pause while you are typing in a field.</DialogDescription>
        </DialogHeader>
        <div className="st-keys">
          {SHORTCUTS.map((g) => (
            <section key={g.group}>
              <h3>{g.group}</h3>
              <dl>
                {g.rows.map(([keys, what]) => (
                  <div key={keys.join('+') + what}><dt>{keys.map((k, i) => <span key={k}>{i > 0 && <i> then </i>}<Kbd>{k}</Kbd></span>)}</dt><dd>{what}</dd></div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
