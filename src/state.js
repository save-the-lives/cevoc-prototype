import { createContext, useContext } from 'react';

// Shared prototype state: validated notice, signed-in officer, publication overrides,
// session audit log, review decisions, adjudication outcomes and demo toggles.
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// Simulated response times (ms). "timeout" waits, then fails.
export const LATENCY = { fast: 120, normal: 450, slow: 2600, timeout: 0 };

// Build the mock API context from app state.
export const apiCtx = (app) => ({
  outage: app.demo.outage,
  overrides: app.overrides,
  latency: LATENCY[app.demo.latency] ?? LATENCY.normal,
  timeout: app.demo.latency === 'timeout',
  certOutage: app.demo.certOutage,
  imageOutage: app.demo.imageOutage,
});
