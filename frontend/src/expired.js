import { createContext } from 'react';

/** Set by the page: re-runs the lookup when the stored photos have expired. Null when there is nothing to re-run. */
export const ExpiredContext = createContext(null);
