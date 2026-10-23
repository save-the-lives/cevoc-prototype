import React, { useCallback, useMemo, useState } from 'react';
import { Header, Footer, DemoControls, ModeBar } from './components/Layout.jsx';
import { AppContext } from './state.js';
import { AssetContext, useManifestLoader } from './services/assets.js';
import { useHashRoute, segments } from './router.js';
import { Link } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import { NoticeLookup, NoticeResult } from './pages/Notice.jsx';
import { CameraSearch, CameraDetail } from './pages/Cameras.jsx';
import Certificate from './pages/Certificate.jsx';
import { OfficerSignIn, OfficerSearch, OfficerShell, OfficerHome } from './pages/Officer.jsx';
import { ReviewQueue, ReviewCase } from './pages/OfficerReview.jsx';
import AdjudicationQueue from './pages/OfficerAdjudication.jsx';
import About from './pages/About.jsx';
import Studio from './studio/Studio.jsx';
import './v4.css';

const DEMO_DEFAULT = { outage: false, media: true, latency: 'normal', certOutage: false, imageOutage: false };

function route(path) {
  const [a, b, c] = segments(path);
  if (!a) return <Home />;
  if (a === 'notice' && !b) return <NoticeLookup key={path} path={path} />;
  if (a === 'notice' && b === 'result') return <NoticeResult />;
  if (a === 'cameras' && !b) return <CameraSearch />;
  if (a === 'cameras') return <CameraDetail code={decodeURIComponent(b)} />;
  if (a === 'certificates' && b) return <Certificate id={decodeURIComponent(b)} />;
  if (a === 'officer' && !b) return <OfficerSignIn key={path} path={path} />;
  if (a === 'officer' && b === 'home') return <OfficerShell active="home"><OfficerHome /></OfficerShell>;
  if (a === 'officer' && b === 'search') return <OfficerShell active="search"><OfficerSearch /></OfficerShell>;
  if (a === 'officer' && b === 'review' && !c) return <OfficerShell active="review"><ReviewQueue /></OfficerShell>;
  if (a === 'officer' && b === 'review') return <OfficerShell active="review"><ReviewCase key={c} id={decodeURIComponent(c)} /></OfficerShell>;
  if (a === 'officer' && b === 'adjudication') return <OfficerShell active="adjudication"><AdjudicationQueue /></OfficerShell>;
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
  const [decisions, setDecisions] = useState({});
  const [adjudications, setAdjudications] = useState({});
  const [demo, setDemo] = useState(DEMO_DEFAULT);
  const [first, second] = segments(path);
  const studio = first === 'studio';

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
      decisions,
      adjudications,
      demo,
      setDemo,
      signIn: (role) => {
        setOfficer(role);
        audit(`Signed in via ${role.org} (mock federated identity)`, role.email || role.name);
      },
      signOut: () => {
        audit('Signed out', officer?.email || officer?.name);
        setOfficer(null);
        window.location.hash = '/';
      },
      audit: (what) => audit(what, officer?.email || officer?.name),
      setOverride: (id, status, what) => {
        setOverrides((o) => ({ ...o, [id]: status }));
        audit(`${what}: ${id}`, officer?.email || officer?.name);
      },
      setDecision: (id, d) => setDecisions((x) => ({ ...x, [id]: d })),
      setAdjudication: (id, outcome) =>
        setAdjudications((x) => {
          const next = { ...x };
          if (outcome) next[id] = outcome;
          else delete next[id];
          return next;
        }),
      resetDemo: () => {
        setNotice(null);
        setOfficer(null);
        setOverrides({});
        setAuditLog([]);
        setDecisions({});
        setAdjudications({});
        setDemo(DEMO_DEFAULT);
        window.location.hash = '/';
      },
    }),
    [notice, officer, overrides, auditLog, decisions, adjudications, demo, audit]
  );

  return (
    <AppContext.Provider value={app}>
      <AssetContext.Provider value={manifest}>
        <ModeBar studio={studio} />
        {studio ? (
          <Studio section={second} />
        ) : (
          <>
            <Header />
            <main id="main-content" tabIndex={-1}>
              {route(path)}
            </main>
            <Footer />
            <DemoControls />
          </>
        )}
      </AssetContext.Provider>
    </AppContext.Provider>
  );
}
