import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Power Apps Code Apps serve from a relative path; pac code push expects
// './' so assets resolve inside the iframe host.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
