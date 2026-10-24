import { Button, Checkbox, Popover, PopoverContent, PopoverTrigger } from '@nswds/ui';
import { COLUMN_BY_ID } from './columns.jsx';

// Pick which columns show and put them in order. Dragging a header also reorders; the arrows do the same from the keyboard.
export default function ColumnChooser({ cols }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" variant="outline">Columns</Button>} />
      <PopoverContent align="end" className="st-cols">
        <p className="st-cols__h">Show and order columns</p>
        <ul>
          {cols.order.map((id, i) => {
            const c = COLUMN_BY_ID[id];
            return (
              <li key={id}>
                <label><Checkbox checked={!cols.hidden.includes(id)} disabled={c.locked} onCheckedChange={() => cols.toggle(id)} /> <span>{c.label}</span></label>
                <span className="st-cols__move">
                  <button type="button" aria-label={`Move ${c.label} earlier`} disabled={i === 0} onClick={() => cols.nudge(id, -1)}>↑</button>
                  <button type="button" aria-label={`Move ${c.label} later`} disabled={i === cols.order.length - 1} onClick={() => cols.nudge(id, 1)}>↓</button>
                </span>
              </li>
            );
          })}
        </ul>
        <Button size="sm" variant="ghost" onClick={cols.reset}>Reset to default</Button>
      </PopoverContent>
    </Popover>
  );
}
