import { Tag } from '@nswds/ui';

// Four separate questions, shown side by side and never merged: is the certification valid, is the evidence complete,
// where is the assessment, and is enforcement defensible. Only a Transport determination can speak to the last one,
// and it is never shown in green: a valid certificate does not make enforcement defensible.
const ROWS = [['certification', 'Certification validity'], ['evidence', 'Evidence completeness'], ['assessment', 'Assessment status'], ['defensibility', 'Enforcement defensibility']];

export default function MatterStatus({ status, compact }) {
  return (
    <dl className={`ms4 ${compact ? 'is-compact' : ''}`} aria-label="Matter status">
      {ROWS.map(([k, label]) => (
        <div key={k}><dt>{label}</dt><dd><Tag size="sm" color={status[k].tone}>{status[k].label}</Tag><small>{status[k].short}</small></dd></div>
      ))}
    </dl>
  );
}
