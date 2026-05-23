import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Power Apps Code apps serve the built bundle from /. When `pac code push`
// uploads the dist/ folder it expects relative asset paths, so keep base "./".
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
