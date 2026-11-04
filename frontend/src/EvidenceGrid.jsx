import EvidenceItem from './EvidenceItem.jsx';

/** The grid of photos, videos and certificate files. Loaded on demand (its own chunk) so the notice details paint first. */
export default function EvidenceGrid({ items }) {
  return <ul className="grid">{items.map((e) => <EvidenceItem key={e.url} item={e} />)}</ul>;
}
