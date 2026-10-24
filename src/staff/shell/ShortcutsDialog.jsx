import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Kbd } from '@nswds/ui';
import { setSingleKeys, useSingleKeys } from '../hooks/useHotkeys.js';

export const SHORTCUTS = [
  { group: 'Anywhere', rows: [[['Ctrl', 'K'], 'Search and commands'], [['/'], 'Search and commands'], [['Ctrl', '/'], 'Show this list'], [['?'], 'Show this list'], [['g', 'h'], 'Go to the dashboard'], [['g', 'r'], 'Go to reviews'], [['g', 'c'], 'Go to court elections'], [['g', 'e'], 'Go to the certificate register'], [['g', 'a'], 'Go to approvals (program managers)']] },
  { group: 'In a queue', rows: [[['↑'], 'Previous row (or k)'], [['↓'], 'Next row (or j)'], [['Home'], 'First row'], [['End'], 'Last row'], [['PgUp'], 'Up eight rows'], [['PgDn'], 'Down eight rows'], [['Enter'], 'Review evidence and certification'], [['o'], 'Open the full case (optional)'], [['Space'], 'Select or clear the row (or x)'], [['Ctrl', 'A'], 'Select every row'], [['a'], 'Assign selected rows to me'], [['Ctrl', 'Z'], 'Undo the last assignment'] , [['f'], 'Filter with a query'], [['Esc'], 'Close the review, then clear selection']] },
  { group: 'Reviewing a case', rows: [[['←'], 'Previous image or video'], [['→'], 'Next image or video'], [['d'], 'Jump to the decision'], [['Ctrl', 'Enter'], 'Record it and move to the next case'], [['↑', '↓'], 'Move to the previous or next case']] },
];

export default function ShortcutsDialog({ open, onOpenChange }) {
  const singles = useSingleKeys();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts pause while you are typing in a field or have a dialog open.</DialogDescription>
        </DialogHeader>
        <label className="st-keys__switch">
          <input type="checkbox" checked={singles} onChange={(e) => setSingleKeys(e.target.checked)} />
          <span><strong>Single-key shortcuts</strong> (j, k, x, a, f, o, p, ? and g then a letter). Turn these off if they clash with a screen reader, voice control or your browser. Arrows, Enter, Esc and Ctrl or Cmd shortcuts keep working.</span>
        </label>
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
        <p className="st-keys__note">Ctrl is Cmd on a Mac. We never take Ctrl or Cmd with F, T, N, W, L, R, P or S, so find-in-page and your browser tabs always work. The search palette also opens from the search button, and this list from the account menu.</p>
      </DialogContent>
    </Dialog>
  );
}
