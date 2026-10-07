import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Power Apps Code Apps serve from a relative path; `pac code push` expects
// './' so assets resolve inside the iframe host shell.
export default defineConfig({
  base: "./",
  plugins: [react()],
  // When this bundle was built (ms) — services/app-build.ts uses it so a tab
  // left open on an older deploy stops applying shop-floor ticks.
  define: {
    __APP_BUILD__: JSON.stringify(Date.now()),
  },
  server: {
    port: 5174,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // The tour's screenshots are embedded as data URLs: the Power Apps host
    // doesn't serve loose image files next to the app (src/assets/tour).
    assetsInlineLimit: (file) => (/[\\/]assets[\\/]tour[\\/]/.test(file) ? true : undefined),
  },
});
