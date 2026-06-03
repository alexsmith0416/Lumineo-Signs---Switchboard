import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: './',
    server: {
      proxy: {
        // Proxy Airtable API calls — PAT injected here server-side, never exposed to browser
        '/api/airtable': {
          target: 'https://api.airtable.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/airtable/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.VITE_AIRTABLE_PAT ?? ''}`);
            });
          },
        },
      },
    },
  };
});
