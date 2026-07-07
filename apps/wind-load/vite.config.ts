import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served standalone for now (outside the Switchboard shell); relative base
// keeps assets resolving if it is later hosted inside an iframe like the
// other sub-apps.
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
