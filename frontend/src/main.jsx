import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { isLiveCheckRoute } from './liveCheck.js';

// Hidden owner-only page: reachable by typing the path, never linked from the public UI.
const LiveCheck = lazy(() => import('./LiveCheck.jsx'));

createRoot(document.getElementById('root')).render(
  isLiveCheckRoute(window.location) ? <Suspense fallback={null}><LiveCheck /></Suspense> : <App />,
);
