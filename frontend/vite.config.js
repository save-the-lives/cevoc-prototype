import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5174, proxy: { '/api': 'http://127.0.0.1:8080' } },
  test: {
    // Forward deployment smoke test env vars to Vitest (process.env is otherwise stripped by Vite).
    env: {
      ...(process.env.LIVE_CASES_PASS && { LIVE_CASES_PASS: process.env.LIVE_CASES_PASS }),
      ...(process.env.LIVE_CASES_FAIL && { LIVE_CASES_FAIL: process.env.LIVE_CASES_FAIL }),
      ...(process.env.PDVT_BASE_URL && { PDVT_BASE_URL: process.env.PDVT_BASE_URL }),
      ...(process.env.PDVT_TAGS && { PDVT_TAGS: process.env.PDVT_TAGS }),
    },
  },
});
