import './demo.css';

/** Shown on every page that is driven by demo data (and on the demo hub itself). */
export default function DemoBanner({ hub = false }) {
  return (
    <div className="demo-banner" role="note" data-testid="demo-banner">
      <div className="wrap">
        <strong>Demo data, not a real notice.</strong>{' '}
        {hub ? 'Every number, place and image on these pages is fictitious.' : 'Everything on this page is fictitious. It appears only while the prototype’s demo data is switched on.'}
      </div>
    </div>
  );
}
