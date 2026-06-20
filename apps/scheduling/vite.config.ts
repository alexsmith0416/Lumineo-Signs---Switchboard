import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Power Apps Code Apps serve from a relative path; `pac code push` expects
// './' so assets resolve inside the iframe host shell.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5174,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
