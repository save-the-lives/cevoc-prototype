import React, { useCallback, useMemo, useState } from 'react';
import { Header, Footer, DemoControls } from './components/Layout.jsx';
import { AppContext } from './state.js';
import { AssetContext, useManifestLoader } from './services/assets.js';
import { useHashRoute, segments } from './router.js';
import { Link } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import { NoticeLookup, NoticeResult } from './pages/Notice.jsx';
import { CameraSearch, CameraDetail } from './pages/Cameras.jsx';
import Certificate from './pages/Certificate.jsx';
import { OfficerSignIn, OfficerSearch } from './pages/Officer.jsx';
import About from './pages/About.jsx';

const DEMO_DEFAULT = { outage: false, media: true };

function route(path) {
  const [a, b] = segments(path);
  if (!a) return <Home />;
  if (a === 'notice' && !b) return <NoticeLookup />;
  if (a === 'notice' && b === 'result') return <NoticeResult />;
  if (a === 'cameras' && !b) return <CameraSearch />;
  if (a === 'cameras') return <CameraDetail code={decodeURIComponent(b)} />;
  if (a === 'certificates' && b) return <Certificate id={decodeURIComponent(b)} />;
  if (a === 'officer' && !b) return <OfficerSignIn />;
  if (a === 'officer' && b === 'search') return <OfficerSearch />;
  if (a === 'about') return <About />;
  return (
    <div className="nsw-container cevoc-page">
      <h1>Page not found</h1>
      <p>
        The page you're looking for doesn't exist. <Link to="/">Go to the home page</Link>
      </p>
    </div>
  );
}

export default function App() {
  const path = useHashRoute();
  const manifest = useManifestLoader();
  const [notice, setNotice] = useState(null);
  const [officer, setOfficer] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [auditLog, setAuditLog] = useState([]);
  const [demo, setDemo] = useState(DEMO_DEFAULT);

  const audit = useCallback(
    (what, who) =>
      setAuditLog((log) => [
        { at: new Date().toLocaleTimeString('en-AU'), who: who || 'unknown', what },
        ...log,
      ]),
    []
  );

  const app = useMemo(
    () => ({
      notice,
      setNotice,
      officer,
      overrides,
      auditLog,
      demo,
      setDemo,
      signIn: (role) => {
        setOfficer(role);
        audit('Signed in (mock federated identity)', role.name);
      },
      signOut: () => {
        audit('Signed out', officer?.name);
        setOfficer(null);
        window.location.hash = '/';
      },
      audit: (what) => audit(what, officer?.name),
      setOverride: (id, status, what) => {
        setOverrides((o) => ({ ...o, [id]: status }));
        audit(`${what}: ${id}`, officer?.name);
      },
      resetDemo: () => {
        setNotice(null);
        setOfficer(null);
        setOverrides({});
        setAuditLog([]);
        setDemo(DEMO_DEFAULT);
        window.location.hash = '/';
      },
    }),
    [notice, officer, overrides, auditLog, demo, audit]
  );

  return (
    <AppContext.Provider value={app}>
      <AssetContext.Provider value={manifest}>
        <Header />
        <main id="main-content" tabIndex={-1}>
          {route(path)}
        </main>
        <Footer />
        <DemoControls />
      </AssetContext.Provider>
    </AppContext.Provider>
  );
}
