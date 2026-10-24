import { useId } from 'react';

// Small chart pieces for the dashboard. Each mark is a real button, so every visual can be clicked,
// focused and read by keyboard and screen reader, and clicking one filters the rest of the dashboard.

export function Tip({ children }) { return <span className="tip" aria-hidden="true">{children}</span>; }

export function Spark({ values, tone = 'ac' }) {
  const id = useId();
  const max = Math.max(...values, 1);
  const w = 100; const h = 28;
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * w, h - 3 - (v / max) * (h - 8)]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg className={`spark is-${tone}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Trend over ${values.length} weeks, now ${values[values.length - 1]}`}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".28" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Vertical columns with an optional target line. items: [{ key, label, value, tone, tip }]
export function Columns({ items, target, selected, onPick, height = 150, unit = '' }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="cols" style={{ height }} role="group">
      {target !== undefined && <i className="cols-target" style={{ bottom: `${(target / max) * 100}%` }} />}
      {items.map((i) => (
        <button key={i.key} type="button" className={`col is-${i.tone || 'ac'} ${selected === i.key ? 'is-sel' : ''} ${selected != null && selected !== i.key ? 'is-dim' : ''}`} aria-pressed={selected === undefined ? undefined : selected === i.key}
          aria-label={`${i.value} ${i.label}${unit ? ` ${unit}` : ''}`} onClick={() => onPick?.(selected === i.key ? null : i.key)}>
          <b>{i.value || ''}</b>{' '}
          <span className="col-bar" style={{ height: `${(i.value / max) * 100}%` }} />
          <small>{i.label}</small>
          {i.tip && <Tip>{i.tip}</Tip>}
        </button>
      ))}
    </div>
  );
}

// Horizontal stacked bars. items: [{ key, label, parts: [{ v, tone }], total, tip }]
export function HBars({ items, selected, onPick }) {
  const max = Math.max(...items.map((i) => i.total), 1);
  return (
    <ul className="hbars">
      {items.map((i) => (
        <li key={i.key}>
          <button type="button" className={`hbar ${selected === i.key ? 'is-sel' : ''} ${selected != null && selected !== i.key ? 'is-dim' : ''}`} aria-pressed={selected === undefined ? undefined : selected === i.key}
            aria-label={`${i.label}: ${i.total}`} onClick={() => onPick?.(selected === i.key ? null : i.key)}>
            <span className="hbar-l">{i.icon}{i.label}</span>
            <span className="hbar-t"><span className="hbar-fill" style={{ width: `${(i.total / max) * 100}%` }}>{i.parts.map((p, k) => p.v > 0 && <i key={k} className={`is-${p.tone}`} style={{ flex: p.v }} />)}</span></span>
            <b>{i.total}</b>
            {i.tip && <Tip>{i.tip}</Tip>}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Matrix heat map. rows: [{ key, label }], cols: [labels], cells[rowKey][colIdx] = { text, tone, tip } | null
export function Heat({ rows, cols, cells, selected, onPick }) {
  return (
    <div className="heat" role="table" aria-label="Certification by camera" style={{ gridTemplateColumns: `76px repeat(${cols.length}, minmax(72px, 1fr))` }}>
      <div className="heat-row" role="row">
        <span role="columnheader"><span className="sr-only">Camera</span></span>
        {cols.map((c) => <span key={c} className="heat-h" role="columnheader">{c}</span>)}
      </div>
      {rows.map((r) => (
        <div key={r.key} className="heat-row" role="row">
          <span className="heat-cell" role="rowheader"><button type="button" className={`heat-l ${selected === r.key ? 'is-sel' : ''}`} aria-pressed={selected === undefined ? undefined : selected === r.key} onClick={() => onPick?.(selected === r.key ? null : r.key)}>{r.label}</button></span>
          {cols.map((c, i) => {
            const cell = cells[r.key]?.[i];
            return cell
              ? <span key={c} className="heat-cell" role="cell"><button type="button" className={`heat-c is-${cell.tone} ${selected != null && selected !== r.key ? 'is-dim' : ''}`} aria-label={`${r.label}, ${c}: ${cell.text}. ${cell.tip}`} onClick={() => onPick?.(selected === r.key ? null : r.key)}>{cell.text}<Tip>{cell.tip}</Tip></button></span>
              : <span key={c} className="heat-cell" role="cell"><span className="heat-c is-none">–<span className="sr-only"> not required</span></span></span>;
          })}
        </div>
      ))}
    </div>
  );
}

// Scatter: x = share of the target reply time used, y = certification risks. Each dot is a case. Top right is urgent.
export function Scatter({ points, xMax, yMax, onPick, selected }) {
  return (
    <div className="scat" role="group" aria-label="Cases by waiting time and certification risk">
      <i className="scat-zone" aria-hidden="true" />
      <i className="scat-v" style={{ left: `${(1 / xMax) * 100}%` }} aria-hidden="true"><em>target</em></i>
      {points.map((p) => (
        <button key={p.key} type="button" className={`dot is-${p.tone} ${selected === p.key ? 'is-sel' : ''}`} aria-label={p.label}
          style={{ left: `${Math.min(p.x / xMax, 1) * 100}%`, bottom: `${Math.min(p.y / yMax, 1) * 100}%`, '--s': `${p.size}px` }} onClick={() => onPick?.(p)}>
          <Tip>{p.tip}</Tip>
        </button>
      ))}
      <span className="scat-x" aria-hidden="true">waiting →</span>
      <span className="scat-y" aria-hidden="true">cert risk →</span>
    </div>
  );
}

// Pie chart. The legend carries the real controls (one button per item, with count and share), so keyboard and
// screen-reader users get the same filter as a mouse click on a slice. Slices are a mouse shortcut only.
const PIE = ['#2f6db5', '#1c3f73', '#6aa0d8', '#4f5f82', '#8fb8e6', '#35547f'];
const GREY = '#b0b8c4';
const arc = (cx, cy, r, a0, a1) => {
  const p = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0); const [x1, y1] = p(a1);
  return `M${cx} ${cy}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
};
export function Pie({ items, selected, onPick }) {
  const sum = items.reduce((t, i) => t + i.total, 0);
  let k = 0; let a = 0;
  const rows = items.map((i) => ({ ...i, color: i.key === 'none' ? GREY : PIE[k++ % PIE.length] }));
  const slices = rows.filter((r) => r.total > 0).map((r) => { const a0 = a; a += (r.total / (sum || 1)) * Math.PI * 2; return { ...r, a0, a1: a }; });
  const toggle = (key) => onPick?.(selected === key ? null : key);
  return (
    <div className="pie">
      <svg className="pie-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        {slices.length === 1
          ? <circle cx="60" cy="60" r="56" fill={slices[0].color} onClick={() => toggle(slices[0].key)} />
          : slices.map((s) => <path key={s.key} d={arc(60, 60, 56, s.a0, s.a1)} fill={s.color} stroke="#fff" strokeWidth="1.5" className={`pie-s ${selected === s.key ? 'is-sel' : ''} ${selected != null && selected !== s.key ? 'is-dim' : ''}`} onClick={() => toggle(s.key)} />)}
      </svg>
      <ul className="pie-key">
        {rows.map((r) => (
          <li key={r.key}>
            <button type="button" className={`pie-b ${selected === r.key ? 'is-sel' : ''} ${selected != null && selected !== r.key ? 'is-dim' : ''}`} aria-pressed={selected === undefined ? undefined : selected === r.key}
              onClick={() => toggle(r.key)}>
              <i style={{ background: r.color }} />
              <span className="pie-l">{r.label}</span>
              <b>{r.total}</b>
              <small>{sum ? Math.round((r.total / sum) * 100) : 0}%</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
