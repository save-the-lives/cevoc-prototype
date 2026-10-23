import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built site works from any folder or static host.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
});
