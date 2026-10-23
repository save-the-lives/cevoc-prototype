import React, { useEffect, useState } from 'react';
import { Alert, Button, ErrorState } from './ui.jsx';

// Skeleton placeholders keep the layout steady while data loads.
export function Skeleton({ lines = 3, media = false, label = 'Loading' }) {
  return (
    <div className="cevoc-skeleton" role="status" aria-busy="true">
      <span className="sr-only">{label}…</span>
      {media && <div className="cevoc-skeleton__media" />}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="cevoc-skeleton__line" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function useSlow(active, ms = 2000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return undefined;
    }
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return slow;
}

// Appears only if loading goes past ~2 seconds.
export function SlowNote({ active }) {
  const slow = useSlow(active);
  return slow ? (
    <p className="cevoc-slow" role="status">
      This is taking longer than usual. There’s no need to refresh, we’re still trying.
    </p>
  ) : null;
}

// Error presentation by failure type. Partial failures explain what still works.
export function Problem({ error, onRetry }) {
  if (error?.kind === 'timeout')
    return (
      <Alert type="error" title="This is taking too long">
        <p>We stopped waiting so you’re not left looking at a spinner. Your details are fine. Try again in a moment.</p>
        {onRetry && <Button variant="dark-outline" onClick={onRetry}>Try again</Button>}
      </Alert>
    );
  if (error?.kind === 'cert')
    return (
      <Alert type="warning" title="We can’t check the camera’s certification right now">
        <p>The rest of this page is still correct. Certification comes from a separate system that isn’t responding. Try again shortly.</p>
        {onRetry && <Button variant="dark-outline" onClick={onRetry}>Try again</Button>}
      </Alert>
    );
  if (error?.kind === 'evidence')
    return (
      <Alert type="warning" title="Additional evidence is unavailable">
        <p>The evidence store isn’t responding. The notice evidence above is unaffected.</p>
        {onRetry && <Button variant="dark-outline" onClick={onRetry}>Try again</Button>}
      </Alert>
    );
  return <ErrorState error={error} onRetry={onRetry} />;
}
