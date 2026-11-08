import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5174, proxy: { '/api': 'http://127.0.0.1:8080' } },
  test: {
    passWithNoTests: true,
    pool: 'forks',
    envPrefix: '', // Expose all vars from .env.test via import.meta.env
  },
});
