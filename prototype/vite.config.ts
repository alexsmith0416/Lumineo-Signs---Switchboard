import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `STANDALONE=1` builds a single self-contained HTML for the dashboard
// mockup (no splash, no router). Without the flag, the regular splash
// app builds normally (multi-asset for use behind a static host).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isStandalone = (globalThis as any).process?.env?.STANDALONE === "1";

export default defineConfig({
  base: "./",
  plugins: isStandalone ? [react(), viteSingleFile()] : [react()],
  build: {
    outDir: isStandalone ? "dist-standalone" : "dist",
    rollupOptions: {
      input: isStandalone ? "./standalone.html" : "./index.html",
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
});
