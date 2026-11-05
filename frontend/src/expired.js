import { createContext } from 'react';

/**
 * Shared by the page and every photo. `expired` is true once any photo link has timed out, `report()` says one has, and `rerun()`
 * takes the person back to the form (notice number and date kept, plate asked for again). `rerun` is null when there is nothing to re-run.
 */
export const ExpiredContext = createContext({ rerun: null, expired: false, report: () => {} });
