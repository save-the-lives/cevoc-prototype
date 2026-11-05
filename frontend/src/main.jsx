import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { isLiveCheckRoute } from './liveCheck.js';
import { isDemoHubRoute } from './demoHub.js';

// Hidden owner-only page: reachable by typing the path, never linked from the public UI.
const LiveCheck = lazy(() => import('./LiveCheck.jsx'));
// Demo hub: the page asks the backend for its list; with demo data off there is no list and it shows the normal app.
const DemoHub = lazy(() => import('./DemoHub.jsx'));

createRoot(document.getElementById('root')).render(
  isLiveCheckRoute(window.location) ? <Suspense fallback={null}><LiveCheck /></Suspense>
    : isDemoHubRoute(window.location) ? <Suspense fallback={null}><DemoHub /></Suspense> : <App />,
);
