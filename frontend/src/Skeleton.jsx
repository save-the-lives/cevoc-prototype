// Placeholders that reserve the space a section will take, so the page does not jump when the real content arrives.
export function PhotoSkeleton({ count = 2, label = 'Loading the photos' }) {
  return (
    <div className="skel-wrap" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <ul className="grid skel-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li className="card" key={i}><div className="skel skel-photo" /><div className="skel skel-line" /></li>
        ))}
      </ul>
    </div>
  );
}

export function ListSkeleton({ rows = 2, label = 'Loading' }) {
  return (
    <div className="skel-wrap" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div className="skel-row" key={i}><div className="skel skel-line short" /><div className="skel skel-line" /><div className="skel skel-line" /></div>
        ))}
      </div>
    </div>
  );
}
