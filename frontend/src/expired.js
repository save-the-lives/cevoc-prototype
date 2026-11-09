import { createContext } from 'react';

/**
 * Shared by the page and every image. `expired` is true once any image link has timed out, `report()` says one has, and `rerun()`
 * takes the person back to the form (notice number and date kept, vehicle registration number asked for again). `rerun` is null when there is nothing to re-run.
 */
export const ExpiredContext = createContext({ rerun: null, expired: false, report: () => {} });
