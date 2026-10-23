import { createContext, useContext } from 'react';

// Shared prototype state: validated notice, signed-in officer, publication overrides,
// session audit log and demo toggles.
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// Build the mock API context from app state.
export const apiCtx = (app) => ({ outage: app.demo.outage, overrides: app.overrides });
