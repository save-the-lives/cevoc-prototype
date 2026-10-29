import EvidenceImage from './EvidenceImage.jsx';
import EvidenceVideo from './EvidenceVideo.jsx';
import ItemBoundary from './ItemBoundary.jsx';

const KIND = { IMAGE: 'Photo', VIDEO: 'Video', CERTIFICATE: 'Certificate' };

function EvidenceItemInner({ item }) {
  if (item.kind === 'CERTIFICATE') {
    return (
      <li className="card cert">
        <h4>{item.title}</h4>
        <p>PDF document</p>
        <a className="btn" href={item.url} target="_blank" rel="noopener noreferrer">
          Open certificate<span className="sr-only"> (PDF, opens in a new tab)</span>
        </a>
        {' '}
        <a className="dl" href={item.downloadUrl || item.url} download>Download original</a>
      </li>
    );
  }
  return (
    <li className={`card media-card ${item.kind === 'VIDEO' ? 'wide' : ''}`}>
      <h4><span className="tag">{KIND[item.kind] || 'File'}</span> {item.title}</h4>
      {item.kind === 'VIDEO' ? <EvidenceVideo item={item} /> : <EvidenceImage item={item} />}
    </li>
  );
}

export default function EvidenceItem({ item }) {
  return <ItemBoundary><EvidenceItemInner item={item} /></ItemBoundary>;
}
