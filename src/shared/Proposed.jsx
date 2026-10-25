// Marks something in the prototype that is a proposal, not an approved capability. Hover or focus for what it would need.
export default function Proposed({ note = 'Shown for discussion. Not an approved capability; see the demo hub, Capability status.' }) {
  return <span className="proposed" tabIndex={0} title={note} aria-label={`Proposed, not yet approved. ${note}`}>Proposed</span>;
}
